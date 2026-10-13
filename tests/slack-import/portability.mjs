import assert from 'node:assert/strict';
import { makePart } from '../../src/base/modules/portability/index.mjs';
import { ArchiveVerifier, ContentVerifier } from '../../src/base/modules/portability/format.mjs';
import { slackServiceFixture, testBucket } from './sqlite-service.mjs';
import { reverseRestored } from './restored-reversal.mjs';
import { lostAckFlow } from './lost-ack.mjs';

export async function slackPortabilityFlow({ exportedArchive, restoredArchive }) {
    const f = await slackServiceFixture();
    try {
        await f.accept(await f.invite('archive-reader@example.test'));
        const reader = f.db.prepare("SELECT id FROM oa_operators WHERE email='archive-reader@example.test'").get().id, members = [f.owner.operatorId, reader];
        const upload = await f.upload(), preview = await f.preview(upload, members), result = await f.finish(preview);
        assert.equal(result.job.state, 'completed');
        const records = await exportedArchive(f, f.bucket);
        const rowItems = records.flatMap(r => r.items ?? []).filter(r => r.kind === 'row');
        const review = rowItems.find(i => i.table === 'nook_import_reviews').row;
        const verifyRows = target => {
            assert.equal(target.db.prepare('SELECT count(*) AS n FROM nook_import_records').get().n, preview.counts.messages);
            assert.equal(target.db.prepare('SELECT count(*) AS n FROM nook_import_records WHERE parent IS NOT NULL').get().n, preview.counts.threads);
            assert.equal(target.db.prepare('SELECT count(*) AS n FROM nook_import_files').get().n, preview.counts.files);
            assert.equal(target.db.prepare('SELECT state FROM ik_jobs WHERE id=?').get(review.kit_job).state, 'completed');
            assert.equal(target.db.prepare('SELECT kit_job FROM nook_import_reviews WHERE id=?').get(review.id).kit_job, review.kit_job);
        };
        const restoredBucket = testBucket();
        await restoredArchive(records, { bucket: restoredBucket, inspect: verifyRows });
        for (const object of records[0].objects) assert.deepEqual(Buffer.from(await (await restoredBucket.get(object.key)).arrayBuffer()), Buffer.from(await (await f.bucket.get(object.key)).arrayBuffer()));
        const undoBucket = testBucket();
        await restoredArchive(records, {bucket: undoBucket, inspect: target => reverseRestored(target, undoBucket, preview.review, f.owner.operatorId)});
        for (const [name, mutate, rejection] of [
            ['completed review missing job', rows => { rows('nook_import_reviews')[0].kit_job = null; }, /slack_review_requires_job/],
            ['completed review with no Base custody', rows => { rows('nook_import_reviews')[0].kit_job = null; }, /slack_review_requires_job/],
            ['completed review missing plan', rows => { rows('ik_jobs')[0].plan_json = '{}'; }, /slack_plan_changed/],
            ['completed review queued job', rows => { rows('ik_jobs')[0].state = 'queued'; }, /invalid_slack_job_binding/],
            ['draft review cannot publish', rows => { rows('nook_import_reviews')[0].state = 'reviewed'; }, /invalid_slack_review_state/],
            ['fabricated completion checkpoint', rows => { rows('ik_jobs')[0].checkpoint--; }, /invalid_slack_plan_binding/],
            ['changed publication provenance', rows => { rows('ik_provenance')[0].record_json = '{}'; }, /slack_publication_provenance_changed/],
            ['changed retained source', rows => { rows('ik_d1_original_chunks')[0].bytes = 'e30='; }, /slack_original_custody_changed/],
            ['changed review choices', rows => { const row = rows('nook_import_reviews')[0], choices = JSON.parse(row.review_json); choices.channels[0].name = 'Unreviewed choice'; row.review_json = JSON.stringify(choices); }, /slack_review_choices_changed/],
            ['changed review summary', rows => { const row = rows('nook_import_reviews')[0], summary = JSON.parse(row.summary_json); summary.actors[0].association = null; row.summary_json = JSON.stringify(summary); }, /slack_review_summary_changed/],
            ['strict reversal cursor', rows => { rows('ik_jobs')[0].reversal_cursor = 1; }, /slack_reversal_integrity/],
            ['strict reversal hash', rows => { rows('ik_jobs')[0].reversal_hash = 'changed'; }, /slack_reversal_integrity/],
            ['strict reversal binding', rows => { rows('ik_jobs')[0].reversal_policy_hash = 'changed'; }, /slack_reversal_integrity/],
            ['missing apply journal', () => {}, /slack_journal_mismatch/],
            ['changed journal fence', rows => { rows('ik_batches')[0].fence++; }, /slack_journal_mismatch/],
            ['changed job fence', rows => { rows('ik_jobs')[0].fence++; }, /slack_journal_mismatch/],
            ['changed plan index', rows => { rows('ik_d1_plan_index')[0].source_identity = 'changed'; }, /slack_plan_index_changed/],
            ['missing custody state', () => {}, /slack_custody_state_changed/]
        ]) {
            const forged = structuredClone(records), items = forged.flatMap(r => r.items ?? []);
            mutate(table => items.filter(i => i.kind === 'row' && i.table === table).map(i => i.row));
            if (['completed review with no Base custody', 'missing apply journal', 'missing custody state'].includes(name)) {
                const remove = table => name === 'completed review with no Base custody' ? table.startsWith('ik_') : table === (name === 'missing apply journal' ? 'ik_batches' : 'ik_d1_custody_states');
                for (const part of forged.filter(r => r.kind === 'part')) part.items = part.items.filter(i => i.kind !== 'row' || !remove(i.table));
                for (const table of forged[0].tables) if (remove(table.name)) table.count = 0;
                for (let i = forged.length - 2; i > 0; i--) if (!forged[i].items.length) forged.splice(i, 1);
                const parts = forged.filter(r => r.kind === 'part');
                parts.forEach((part, index) => { part.index = index; });
                forged[0].partCount = forged.at(-1).partCount = parts.length;
            }
            const verifier = new ContentVerifier(forged[0]), binding = new ArchiveVerifier(forged[0]);
            for (let i = 0; i < forged.length; i++) if (forged[i].kind === 'part') { forged[i] = await makePart(forged[i].index, forged[i].items); binding.add(forged[i]); for (const item of forged[i].items) verifier.add(item); }
            forged.at(-1).contentHash = verifier.digest(); forged.at(-1).archiveHash = binding.digest();
            const bucket = testBucket();
            await restoredArchive(forged, { bucket, rejection, label: name });
            assert.deepEqual((await bucket.list()).objects, [], name + ' wrote provider bytes');
        }
        // A reviewed draft can survive beside a completed job without claiming
        // that job. Undone jobs keep their Base provenance but no domain rows.
        await f.preview(upload, [f.owner.operatorId], 'draft-fixture');
        await restoredArchive(await exportedArchive(f, f.bucket), { bucket: testBucket(), inspect: verifyRows });
        let reversed = await f.service.undoReviewed(f.c, preview.review);
        for (let n = 0; !['undone','rolled_back'].includes(reversed.job.state) && n < 20; n++) reversed = await f.service.undoReviewed(f.c, preview.review);
        assert.equal(reversed.job.state, 'undone');
        await restoredArchive(await exportedArchive(f, f.bucket), { bucket: testBucket(), inspect: target => {
            assert.equal(target.db.prepare('SELECT count(*) AS n FROM nook_import_records').get().n, 0);
            assert.equal(target.db.prepare("SELECT count(*) AS n FROM nook_import_reviews WHERE state='reviewed'").get().n, 1);
            assert.equal(target.db.prepare("SELECT count(*) AS n FROM nook_import_reviews WHERE state='undone'").get().n, 1);
        } });
        const repeatedBucket = testBucket();
        await restoredArchive(await exportedArchive(f, f.bucket), {bucket: repeatedBucket, inspect: target => reverseRestored(target, repeatedBucket, preview.review, f.owner.operatorId)});
        f.db.prepare("UPDATE oa_operators SET role='admin' WHERE id=?").run(reader);
        const fresh = await f.preview(upload, members);
        assert.notEqual(fresh.review, preview.review);
        await f.finish(fresh);
        await f.service.undoReviewed(f.c, preview.review);
        await restoredArchive(await exportedArchive(f, f.bucket), { bucket: testBucket(), inspect: target => {
            assert.equal(target.db.prepare('SELECT count(*) AS n FROM nook_import_records').get().n, fresh.counts.messages);
            assert.equal(target.db.prepare('SELECT intent FROM nook_imports').get().intent, fresh.review);
            assert.equal(target.db.prepare("SELECT count(*) AS n FROM nook_import_reviews WHERE state='undone'").get().n, 1);
        } });
        const replacementBucket = testBucket();
        await restoredArchive(await exportedArchive(f, f.bucket), {bucket: replacementBucket, inspect: target => reverseRestored(target, replacementBucket, fresh.review, f.owner.operatorId)});
        let final = await f.service.undoReviewed(f.c, fresh.review);
        for (let n = 0; final.job.state !== 'undone' && n < 20; n++) final = await f.service.undoReviewed(f.c, fresh.review);
        assert.equal(final.job.state, 'undone');
        await f.custody.discardUpload(f.c, upload);
        await restoredArchive(await exportedArchive(f, f.bucket), { bucket: testBucket(), inspect: target => {
            assert.equal(target.db.prepare("SELECT count(*) AS n FROM nook_import_reviews WHERE state='discarded'").get().n, 1);
            assert.equal(target.db.prepare('SELECT count(*) AS n FROM nook_import_records').get().n, 0);
        } });
    } finally { f.close(); }
    await lostAckFlow(async (source, preview) => {
        const bucket = testBucket();
        await restoredArchive(await exportedArchive(source, source.bucket), {bucket, inspect: target => reverseRestored(target, bucket, preview.review, source.owner.operatorId, 'rolled_back')});
    });
}
