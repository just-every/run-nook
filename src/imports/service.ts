import {inspectSource,captureSource,sourceKind,publicCampfire,summaryCampfire,campfireFileHashes} from './formats.mjs';
import { fail } from '../family/team-chat/domain';
import type { Context } from '../platform/storage/context';
import { importDigest } from '../family/team-chat/import-capture.mjs';
import { owner, ownerBatch, uploadBytes, stageFiles, cleanupImportObjects } from './custody.ts';
import { kitSource } from './source.ts';
import { captureNativeId } from './ids.mjs';
import { assertSlackCaptureAdmitted } from './policy.mjs';
import { importContext, importPredicate } from './authorization.ts';
import { budgeted, left } from './request-budget.ts';
import { reconcileReviewed } from './reconcile.ts';
import { statusView } from './status.ts';
import { planD1Import, preflightD1ImportJob, createD1ImportJob, resumeD1Import, readD1ImportJob, undoD1Import, rollbackD1Import } from './kit.ts';
async function people(c: Context) { return (await c.rows("SELECT o.id,o.email,o.display_name AS name,o.version,a.mode,a.generation FROM oa_operators o JOIN nook_access a ON a.user=o.id AND a.active=1 WHERE o.status='active' ORDER BY o.id")).map(u => ({ ...u, active: true })); }
function publicInspection(i: any) { return { channels: i.channels.map((c: any) => ({ sourceId: c.id, name: c.name, visibility: 'public' })), actors: i.actors, omissions: i.omissions, completeness: i.completeness, sourceAuthenticityVerified: false }; }
function summary(capture: any) { if(capture.sourceType==='campfire')return summaryCampfire(capture);return { reviewDigest: capture.reviewDigest, externalActors: capture.externalActors, skippedKinds: capture.skippedKinds, missingFiles: capture.missingFiles, missingFileInventoryDigest: capture.missingFileInventoryDigest, counts: capture.counts, omissions: capture.omissions, omissionDigest: capture.omissionDigest, omissionsAccepted: capture.omissionsAccepted, blockers: capture.blockers, blocked: capture.blocked, channels: capture.channels.map(({ sourceRecord, ...c }: any) => c), actors: capture.actors.map(({ sourceRecord, ...a }: any) => a), archiveDigest: capture.archiveDigest, captureDigest: capture.digest, completeness: 'unknown', sourceAuthenticityVerified: false }; }
async function inspectedUpload(c:Context,id:string,users:any[]){const upload=await c.one('SELECT object_key FROM nook_import_uploads WHERE id=? AND owner=?',[id,c.uid]);if(!upload)fail(404,'Import upload unavailable');return inspectSource(await uploadBytes(c,id),sourceKind(upload),users)}
export async function inspectUpload(c: Context, id: string) { c = budgeted(c); const users = await people(c), inspected = await inspectedUpload(c,id,users); await owner(c); return { upload: id, owner: c.uid, users, ...(inspected.source?.implementation==='once-campfire-express'?publicCampfire(inspected,users):publicInspection(inspected)) }; }
export async function previewImport(c: Context, input: any) {
    c = budgeted(c);
    await owner(c);
    if (!input || typeof input !== 'object' || Array.isArray(input) || typeof input.upload !== 'string')
        fail(400, 'Upload required');
    const users = await people(c), inspected = await inspectedUpload(c,input.upload,users), capture = captureSource(inspected,input.review,c.uid,users), result = summary(capture), preview = { ...result, ...(capture.sourceType==='campfire'?{fileHashes:campfireFileHashes(capture)}:{}), missingFileInventory: capture.missingFileInventory };
    if (capture.blocked)
        return { ...preview, needsOmissionReview: false };
    if (!capture.omissionsAccepted)
        return { ...preview, needsOmissionReview: true };
    const used = [...new Set<string>([c.uid, ...capture.channels.flatMap((x: any) => x.members), ...capture.actors.map((x: any) => x.association).filter(Boolean)])].sort(), authority = used.map(id => ({ id, version: users.find(u => u.id === id)?.version, mode: users.find(u => u.id === id)?.mode, generation: users.find(u => u.id === id)?.generation })), authorityJson = JSON.stringify(authority), id = importDigest([c.uid, input.upload, capture.digest, authority]), channelsJson = JSON.stringify(capture.channels.map((x: any) => ({ sourceId: x.sourceId, members: x.members }))), { source, mapping, domainJob } = kitSource(capture, c.uid, input.upload, id);
    let review = await c.one('SELECT * FROM nook_import_reviews WHERE id=? AND owner=?', [id, c.uid]);
    if (!review) {
        await ownerBatch(c, [c.sql("INSERT INTO nook_import_reviews VALUES(?,?,?,?,?,NULL,?,?,?,?,'reviewed',NULL,?)", id, c.uid, input.upload, capture.namespace, domainJob, authorityJson, channelsJson, JSON.stringify(input.review), JSON.stringify(result), Date.now())]);
        review = await c.one('SELECT * FROM nook_import_reviews WHERE id=? AND owner=?', [id, c.uid]);
    }
    if (review.state === 'discarded' || review.state === 'undone')
        fail(409, 'This reviewed import was discarded or undone');
    const ctx = importContext(c, review), plan = await planD1Import(source, mapping, ctx);
    preflightD1ImportJob(plan, { ...ctx, reviewedFingerprint: plan.fingerprint });
    if (review.fingerprint && review.fingerprint !== plan.fingerprint)
        fail(409, 'Reviewed import changed');
    if (!review.fingerprint)
        await ownerBatch(c, [c.sql('UPDATE nook_import_reviews SET fingerprint=? WHERE id=? AND fingerprint IS NULL', plan.fingerprint, id)]);
    return { ...preview, review: id, fingerprint: plan.fingerprint, kitCounts: plan.counts, needsOmissionReview: false };
}
async function reviewed(c: Context, id: string, requirePlan = true) { await owner(c); const row = await c.one('SELECT * FROM nook_import_reviews WHERE id=? AND owner=?', [id, c.uid]); if (row?.state === 'discarded') fail(409, 'This reviewed import was cancelled and its source upload withdrawn'); if (!row || requirePlan && !row.fingerprint)
    fail(404, 'Reviewed import unavailable'); return reconcileReviewed(c, row); }
// Nook's statements after the kit returns: the completion batch (6) or the
// reversal's owner batch (7). Undo's object cleanup takes only what is left.
const FINISH = 7;
// Creating the job leaves the first batches to this request only when at least
// this much budget remains; otherwise the next resume request starts them.
const ADVANCE_AFTER_CREATE = 300;
export async function applyReviewed(c: Context, id: string, fingerprint: string) {
    c = budgeted(c);
    const review = await reviewed(c, id);
    assertSlackCaptureAdmitted(JSON.parse(review.summary_json));
    if (review.erased) fail(409, 'This import was erased; resume its remaining entries using the current job');
    if (fingerprint !== review.fingerprint)
        fail(409, 'Reviewed plan changed');
    if (review.state === 'undone')
        fail(409, 'Import was undone');
    const predicate = importPredicate(c, review, 'apply');
    if (!await c.one(`SELECT 1 AS ok WHERE ${predicate.sql}`, predicate.params ?? []))
        fail(409, 'Reviewed authority changed or previous import cleanup is incomplete');
    let jobId = review.kit_job;
    if (!jobId) {
        const users = await people(c), capture = captureSource(await inspectedUpload(c,review.upload,users),JSON.parse(review.review_json),c.uid,users), { source, mapping } = kitSource(capture, c.uid, review.upload, review.id), plan = await planD1Import(source, mapping, importContext(c, review));
        if (plan.fingerprint !== fingerprint)
            fail(409, 'Reviewed source or mappings changed');
        const duplicate = await c.one('SELECT 1 AS present WHERE EXISTS(SELECT 1 FROM nook_import_records WHERE key IN (SELECT value FROM json_each(?))) OR EXISTS(SELECT 1 FROM nook_conversations WHERE id IN (SELECT value FROM json_each(?)))', [JSON.stringify(capture.messages.map((m: any) => m.key)), JSON.stringify(capture.channels.map((ch: any) => captureNativeId(capture, 'channel', ch.sourceId)))]);
        // Existing operation receipts remain resumable after a lost create ack.
        const prior = await c.one('SELECT id FROM ik_jobs WHERE operation_key=? AND principal_id=?', [review.id, c.uid]);
        if (duplicate && !prior) fail(409, 'Source history already belongs to another import');
        // Files are staged a chunk per request; apply again until all are ready.
        const files = await stageFiles(c, review.upload, capture, review.id);
        if (files.staged < files.total) return { review: id, job: null, files, summary: JSON.parse(review.summary_json) };
        // This envelope is visibility state, not a substitute for kit job/checkpoint.
        await reviewBatch(c, review, [c.sql("INSERT OR IGNORE INTO nook_imports(id,owner,intent,plan_digest,capture_digest,created,namespace,preview_digest,state) VALUES(?,?,?,?,?,?,?,?,'staging')", review.domain_job, c.uid, id, fingerprint, capture.digest, new Date().toISOString(), capture.namespace, capture.digest), c.sql("INSERT INTO nook_guard VALUES(?,CASE WHEN EXISTS(SELECT 1 FROM nook_imports WHERE id=? AND owner=? AND intent=? AND plan_digest=? AND capture_digest=? AND namespace=? AND preview_digest=?) THEN 1 ELSE 0 END)", 'envelope:' + id, review.domain_job, c.uid, id, fingerprint, capture.digest, capture.namespace, capture.digest), c.sql('DELETE FROM nook_guard WHERE id=?', 'envelope:' + id)]);
        const job = await createD1ImportJob(plan, importContext(c, review, 5));
        jobId = job.id;
        await ownerBatch(c, [c.sql("UPDATE nook_import_reviews SET kit_job=?,state='applying' WHERE id=? AND owner=? AND fingerprint=?", jobId, id, c.uid, fingerprint)]);
        if (left(c) < ADVANCE_AFTER_CREATE) return { review: id, job, summary: JSON.parse(review.summary_json) };
    }
    return advance(c, { ...review, kit_job: jobId });
}
async function reviewBatch(c: Context, review: any, statements: D1PreparedStatement[]) { const predicate = importPredicate(c, review, 'apply'); return ownerBatch(c, statements, predicate.sql, predicate.params); }
async function advance(c: Context, review: any) {
    assertSlackCaptureAdmitted(JSON.parse(review.summary_json));
    const job = await resumeD1Import(review.kit_job, importContext(c, review, FINISH));
    if (job.state === 'completed')
        await reviewBatch(c, review, [c.sql("UPDATE nook_imports SET state='complete' WHERE id=? AND owner=?", review.domain_job, c.uid), c.sql("UPDATE nook_import_reviews SET state='completed' WHERE id=? AND owner=?", review.id, c.uid)]);
    if (['undone', 'rolled_back'].includes(job.state)) await finishReversal(c, review);
    return { review: review.id, job, summary: JSON.parse(review.summary_json) };
}
export async function resumeReviewed(c: Context, id: string) { c = budgeted(c); const review = await reviewed(c, id); if (!review.kit_job)
    fail(409, 'Apply this reviewed plan first'); if (review.state === 'undone')
    fail(409, 'Import was undone'); return advance(c, review); }
export async function importStatus(c: Context, id: string) {
    c = budgeted(c);
    const review = await reviewed(c, id, false), job = review.kit_job ? await readD1ImportJob(review.kit_job, importContext(c, review)) : null;
    const uploadReady = !!await c.one("SELECT 1 FROM nook_import_uploads WHERE id=? AND owner=? AND state='ready'", [review.upload, c.uid]);
    return statusView(c, review, job, uploadReady);
}
export async function undoReviewed(c: Context, id: string) {
    c = budgeted(c);
    const review = await reviewed(c, id);
    if (!review.kit_job) fail(409, 'Import has no applied job');
    const current = await readD1ImportJob(review.kit_job, importContext(c, review));
    const undo = ['completed', 'undoing', 'undone'].includes(current.state);
    const job = await (undo ? undoD1Import : rollbackD1Import)(review.kit_job, importContext(c, review, FINISH));
    if (['undone', 'rolled_back'].includes(job.state)) await finishReversal(c, review);
    return { review: id, job };
}
async function finishReversal(c: Context, review: any) {
    const prefix = `private/imports/${c.uid}/${review.upload}/files/${review.domain_job}/`;
    await ownerBatch(c, [
        c.sql('DELETE FROM nook_imports WHERE id=? AND owner=? AND intent=?', review.domain_job, c.uid, review.id),
        c.sql("INSERT OR IGNORE INTO nook_object_deletes(object_key,created) SELECT object_key,? FROM nook_import_objects WHERE owner=? AND state<>'deleted' AND substr(object_key,1,length(?))=? AND NOT EXISTS(SELECT 1 FROM nook_attachments a WHERE a.object_key=nook_import_objects.object_key) AND EXISTS(SELECT 1 FROM nook_import_reviews WHERE id=? AND owner=? AND state<>'undone')", Date.now(), c.uid, prefix, prefix, review.id, c.uid),
        c.sql("UPDATE nook_import_reviews SET state='undone' WHERE id=? AND owner=?", review.id, c.uid)
    ]);
    await cleanupImportObjects(c);
    // Wake the hub so its alarm drains the rest of the queued object deletes.
    await c.hint();
}

export async function reviewAgain(c: Context, id: string) {
    c = budgeted(c);
    const review = await reviewed(c, id);
    if (review.state !== 'undone') fail(409, 'Finish guarded reversal before reviewing this import again');
    return { source: await inspectUpload(c, review.upload), review: JSON.parse(review.review_json) };
}
