import { fail } from '../family/team-chat/domain';
import type { Context } from '../platform/storage/context';
import { owner, ownerBatch } from './owner';
import { putCustodyObjects, cleanupImportObjects } from './object-store';
import { budgeted, left } from './request-budget';
export { owner, ownerBatch } from './owner';
export { cleanupImportObjects } from './object-store';
import { sha256, ZIP_LIMITS } from './zip.mjs';
import { captureNativeId, captureJobId, fileObjectKey } from './ids.mjs';
import { inspectSource,sourceKind } from './formats.mjs';
import {assertCampfireFileSize} from './campfire-effects.mjs';
import { assertSlackCaptureAdmitted, assertSlackFileSize } from './policy.mjs';
export async function localUpload(c: Context, request: Request,kind='slack') {
    c = budgeted(c);
    await owner(c);
    const reader = request.body?.getReader() ?? fail(400, 'ZIP upload required');
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
        const { value, done } = await reader.read();
        if (done)
            break;
        size += value.length;
        if (size > ZIP_LIMITS.archive) {
            await reader.cancel();
            fail(413, 'ZIP upload too large');
        }
        chunks.push(value);
    }
    const bytes = Buffer.concat(chunks), archiveDigest = sha256(bytes);
    // Reject invalid archives before retaining any owner custody objects.
    await inspectSource(bytes,kind,[]);
    let upload = await c.one("SELECT * FROM nook_import_uploads WHERE owner=? AND archive_digest=? AND state<>'discarded'", [c.uid, archiveDigest]);
    if (!upload) {
        const id = crypto.randomUUID(), key = `private/imports/${c.uid}/${id}/${kind==='campfire'?'archive.campfire.tar.gz':'archive.zip'}`;
        await ownerBatch(c, [c.sql("INSERT INTO nook_import_uploads VALUES(?,?,?,?,?,'reserved',?)", id, c.uid, archiveDigest, key, bytes.length, Date.now())]);
        upload = await c.one('SELECT * FROM nook_import_uploads WHERE id=? AND owner=?', [id, c.uid]);
    }
    if (upload.state === 'reserved') {
        await putCustodyObjects(c, [{ key: upload.object_key, bytes, mime: kind==='campfire'?'application/gzip':'application/zip', sha256: archiveDigest }],
            [c.sql("UPDATE nook_import_uploads SET state='ready' WHERE id=? AND owner=? AND state='reserved'", upload.id, c.uid)],
            "EXISTS(SELECT 1 FROM nook_import_uploads WHERE id=? AND owner=? AND state IN ('reserved','ready'))", [upload.id, c.uid]);
    }
    return upload.id as string;
}
export async function uploadBytes(c: Context, id: string) { await owner(c); const upload = await c.one("SELECT * FROM nook_import_uploads WHERE id=? AND owner=? AND state='ready'", [id, c.uid]); if (!upload)
    fail(404, 'Import upload unavailable'); const object = await c.env.FILES.get(upload.object_key); if (!object || object.size !== upload.size || object.size > ZIP_LIMITS.archive)
    fail(409, 'Import upload bytes unavailable'); const bytes = Buffer.from(await object!.arrayBuffer()); if (bytes.length !== upload.size || sha256(bytes) !== upload.archive_digest)
    fail(409, 'Import upload integrity changed'); await owner(c); return bytes; }
// Each request stages at most this many files: one file is at most 1 MiB and
// takes three object-store calls, while the statements per chunk stay fixed.
const FILES_PER_REQUEST = 100, STAGE_STATEMENTS = 20;
/** Stage the next chunk of the reviewed files in owner custody. Returns how
 * many of the capture's files are ready; apply creates the job once all are. */
export async function stageFiles(c: Context, upload: string, capture: any, reviewId: string) {
    assertSlackCaptureAdmitted(capture);
    const files = capture.messages.flatMap((message: any) => message.files.map((file: any) => {
        if(capture.sourceType==='campfire')assertCampfireFileSize(file.size);else assertSlackFileSize(file.size);
        return { ...file, key: fileObjectKey(c.uid, upload, captureJobId(capture, upload), reviewId, captureNativeId(capture, 'file', `${message.key}:${file.sourceId}`)) };
    }));
    if (!files.length) return { staged: 0, total: 0 };
    const rows = new Map((await c.rows('SELECT k.value AS object_key,o.state,EXISTS(SELECT 1 FROM nook_object_deletes d WHERE d.object_key=k.value) AS queued FROM json_each(?) k LEFT JOIN nook_import_objects o ON o.object_key=k.value AND o.owner=?', [JSON.stringify(files.map((f: any) => f.key)), c.uid])).map(row => [row.object_key, row]));
    if (files.some((f: any) => ['deleting', 'deleted'].includes(rows.get(f.key)?.state))) fail(409, 'Imported file was removed');
    if (files.some((f: any) => rows.get(f.key)?.queued)) fail(409, 'Imported file cleanup is pending');
    const pending = files.filter((f: any) => rows.get(f.key)?.state !== 'ready'), chunk = pending.slice(0, FILES_PER_REQUEST);
    if (!chunk.length || left(c) < STAGE_STATEMENTS) return { staged: files.length - pending.length, total: files.length };
    const keys = JSON.stringify(chunk.map((f: any) => f.key));
    await ownerBatch(c, [c.sql("INSERT OR IGNORE INTO nook_import_objects SELECT json_extract(value,'$.key'),?,?,json_extract(value,'$.sha256'),json_extract(value,'$.size'),json_extract(value,'$.mime'),'reserved' FROM json_each(?)", upload, c.uid, JSON.stringify(chunk.map((f: any) => ({ key: f.key, sha256: f.sha256, size: f.size, mime: f.mime }))))], "EXISTS(SELECT 1 FROM nook_import_uploads WHERE id=? AND owner=? AND state='ready')", [upload, c.uid]);
    await putCustodyObjects(c, chunk.map((f: any) => ({ key: f.key, bytes: f.bytes, mime: f.mime, sha256: f.sha256 })),
        [c.sql("UPDATE nook_import_objects SET state='ready' WHERE owner=? AND state='reserved' AND object_key IN (SELECT value FROM json_each(?))", c.uid, keys)],
        "NOT EXISTS(SELECT 1 FROM json_each(?) k WHERE NOT EXISTS(SELECT 1 FROM nook_import_objects o JOIN nook_import_uploads u ON u.id=o.upload AND u.owner=o.owner WHERE o.object_key=k.value AND o.owner=? AND o.state IN ('reserved','ready') AND u.state='ready'))", [keys, c.uid]);
    for (const file of chunk) {
        const actual = await c.env.FILES.get(file.key);
        if (!actual || actual.size !== file.size || sha256(new Uint8Array(await actual.arrayBuffer())) !== file.sha256)
            fail(409, 'Imported file integrity changed');
    }
    return { staged: files.length - pending.length + chunk.length, total: files.length };
}
export async function discardUpload(c: Context, id: string) { c = budgeted(c); await owner(c); const upload = await c.one('SELECT * FROM nook_import_uploads WHERE id=? AND owner=?', [id, c.uid]); if (!upload)
    fail(404, 'Import upload unavailable'); await ownerBatch(c, [c.sql("DELETE FROM nook_imports WHERE owner=? AND state='staging' AND id IN (SELECT domain_job FROM nook_import_reviews WHERE upload=? AND owner=? AND kit_job IS NULL)", c.uid, id, c.uid), c.sql("UPDATE nook_import_uploads SET state='discarded' WHERE id=? AND owner=?", id, c.uid), c.sql("UPDATE nook_import_reviews SET state='discarded' WHERE upload=? AND owner=? AND kit_job IS NULL", id, c.uid), c.sql('INSERT OR IGNORE INTO nook_object_deletes(object_key,created) VALUES(?,?)', upload.object_key, Date.now()), c.sql("INSERT OR IGNORE INTO nook_object_deletes(object_key,created) SELECT object_key,? FROM nook_import_objects WHERE upload=? AND owner=? AND NOT EXISTS(SELECT 1 FROM nook_attachments a WHERE a.object_key=nook_import_objects.object_key)", Date.now(), id, c.uid)], "NOT EXISTS(SELECT 1 FROM nook_import_reviews r WHERE r.upload=? AND r.state<>'undone' AND (r.kit_job IS NOT NULL OR EXISTS(SELECT 1 FROM ik_jobs j WHERE j.operation_key=r.id AND j.principal_id=r.owner)))", [id]); await cleanupImportObjects(c); return { discarded: true }; }
