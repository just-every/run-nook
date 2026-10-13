import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { recoverNormalized } from '../../scripts/storage/recover-identities.mjs';
import { teamFixture } from '../team-sql-support.mjs';
import { rebuildSearch } from '../../src/platform/storage/portability.mjs';
import { testHub } from './sqlite-service.mjs';

// Exercise the actual offline identity recovery and a newly authenticated
// owner's Base reversal against the restored database and restored file bytes.
export async function reverseRestored(target, bucket, reviewId, ownerId, expectedState = 'undone') {
    const directory = mkdtempSync(join(tmpdir(), 'slack-restored-reversal-'));
    let recovered;
    try {
        // The product transfer command rebuilds derived search after Base finalize.
        await rebuildSearch(target.adapter);
        const source = join(directory, 'source.sqlite'), destination = join(directory, 'recovered.sqlite');
        target.db.prepare('VACUUM INTO ?').run(source);
        const actors = target.db.prepare('SELECT * FROM nook_actors').all();
        await recoverNormalized(source, destination, { owner: ownerId, users: actors.map(a => ({id: a.id, email: a.email, role: a.role})) });
        recovered = await teamFixture({bootstrap: false, database: destination});
        const session = await recovered.signIn(actors.find(a => a.id === ownerId).email);
        const { Context } = await import('../../src/platform/storage/context.ts');
        const service = await import('../../src/imports/service.ts');
        const c = new Context({DB: recovered.adapter, FILES: bucket, CHAT_HUB: testHub()}, session);
        const status = await service.importStatus(c, reviewId);
        assert.ok(status.job);
        let result = await service.undoReviewed(c, reviewId);
        for (let n = 0; !['undone','rolled_back'].includes(result.job.state) && n < 20; n++) result = await service.undoReviewed(c, reviewId);
        assert.equal(result.job.state, expectedState);
        assert.equal(recovered.db.prepare('SELECT count(*) AS n FROM nook_import_records').get().n, 0);
        assert.equal(recovered.db.prepare('SELECT count(*) AS n FROM nook_imports').get().n, 0);
        assert.equal(recovered.db.prepare('SELECT count(*) AS n FROM nook_attachments WHERE object_key IS NOT NULL').get().n, 0);
        assert.equal((await service.undoReviewed(c, reviewId)).job.state, expectedState);
        return {status: status.job.state, reversal: result.job.state, remainingMessages: 0};
    } finally { recovered?.close(); rmSync(directory, {recursive: true, force: true}); }
}
