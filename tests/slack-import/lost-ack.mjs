import assert from 'node:assert/strict';
import { slackServiceFixture } from './sqlite-service.mjs';

export async function lostAckFlow(inspectReversed) {
    const f = await slackServiceFixture();
    try {
        await f.accept(await f.invite('lost-ack-reader@example.test'));
        const reader = f.db.prepare("SELECT id FROM oa_operators WHERE email='lost-ack-reader@example.test'").get().id;
        const upload = await f.upload(), members = [f.owner.operatorId, reader], preview = await f.preview(upload, members);
        const batch = f.adapter.batch.bind(f.adapter);
        let dropped = false;
        f.adapter.batch = async statements => {
            const result = await batch(statements);
            if (!dropped && statements.some(s => /INSERT INTO ik_jobs\(/.test(s.sql))) { dropped = true; throw Error('Lost create acknowledgement'); }
            return result;
        };
        await assert.rejects(f.service.applyReviewed(f.c, preview.review, preview.fingerprint), /Lost create acknowledgement/);
        f.adapter.batch = batch;
        assert.equal(dropped, true);
        const raw = f.db.prepare('SELECT * FROM ik_jobs').get();
        assert.equal(raw.state, 'queued'); assert.equal(raw.checkpoint, 0);
        assert.equal(f.db.prepare('SELECT kit_job FROM nook_import_reviews').get().kit_job, null);
        f.db.prepare("UPDATE oa_operators SET role='admin' WHERE id=?").run(reader);
        // A matching operation key alone cannot adopt a changed receipt.
        for (const column of ['fingerprint', 'namespace', 'mapping_version']) {
            f.db.prepare(`UPDATE ik_jobs SET ${column}=? WHERE id=?`).run('forged-binding', raw.id);
            await assert.rejects(f.service.importStatus(f.c, preview.review));
            assert.equal(f.db.prepare('SELECT kit_job FROM nook_import_reviews').get().kit_job, null);
            f.db.prepare(`UPDATE ik_jobs SET ${column}=? WHERE id=?`).run(raw[column], raw.id);
        }
        const status = await f.service.importStatus(f.c, preview.review);
        assert.equal(status.job.id, raw.id); assert.equal(status.job.checkpoint, 0);
        assert.equal(status.forwardAuthority, false); assert.equal(status.reversalSafe, true);
        assert.equal((await f.list.listImports(f.c)).jobs.find(r => r.review === preview.review).job.id, raw.id);
        await assert.rejects(f.service.applyReviewed(f.c, preview.review, preview.fingerprint), /authority changed/);
        await assert.rejects(f.service.resumeReviewed(f.c, preview.review), /IMPORT_ATOMIC_GUARD/);
        assert.equal(f.db.prepare('SELECT count(*) AS n FROM nook_import_records').get().n, 0);
        const result = await f.service.undoReviewed(f.c, preview.review);
        assert.equal(result.job.state, 'rolled_back');
        assert.equal(f.db.prepare('SELECT count(*) AS n FROM nook_imports').get().n, 0);
        assert.equal((await f.service.importStatus(f.c, preview.review)).canReviewAgain, true);
        await inspectReversed?.(f, preview);
        assert.equal((await f.service.reviewAgain(f.c, preview.review)).source.upload, upload);
        const fresh = await f.preview(upload, members);
        assert.notEqual(fresh.review, preview.review);
        await f.finish(fresh);
        await f.service.undoReviewed(f.c, preview.review);
        assert.equal(f.db.prepare('SELECT intent FROM nook_imports').get().intent, fresh.review);
        assert.equal(f.db.prepare('SELECT count(*) AS n FROM nook_import_records').get().n, fresh.counts.messages);
        return { durable: {state: raw.state, checkpoint: raw.checkpoint, total: raw.total}, recovered: status.job.state, staleForward: 'refused', reversal: result.job.state, replacement: 'completed', forgedBindings: 3 };
    } finally { f.close(); }
}
