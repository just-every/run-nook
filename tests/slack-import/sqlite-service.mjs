// Focused integration harness: production Context/service/Base SQL on SQLite.
// Only the object-provider edge is in memory; no alternate application paths.
import { registerHooks } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import ts from 'typescript';
import { teamFixture } from '../team-sql-support.mjs';
import { slackFixture } from './fixture.mjs';
registerHooks({
    resolve(specifier, context, next) { try { return next(specifier, context); } catch (error) { if (specifier.startsWith('.') && existsSync(new URL(specifier + '.ts', context.parentURL))) return next(specifier + '.ts', context); throw error; } },
    load(url, context, next) { if (url.endsWith('.ts')) return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext } }).outputText }; if (url.endsWith('.json')) return next(url, { ...context, importAttributes: { type: 'json' } }); return next(url, context); }
});
export function testBucket() {
    const objects = new Map();
    return {
        async head(key) { const row = objects.get(key); return row ? { key, size: row.bytes.length, ...row.metadata } : null; },
        async get(key) { const row = objects.get(key); return row ? { ...await this.head(key), body: new Blob([row.bytes]).stream(), async arrayBuffer() { return Uint8Array.from(row.bytes).buffer; } } : null; },
        async put(key, value, metadata = {}) { const bytes = Buffer.from(await new Response(value).arrayBuffer()); objects.set(key, { bytes, metadata: structuredClone(metadata) }); return this.head(key); },
        async delete(key) { for (const k of Array.isArray(key) ? key : [key]) objects.delete(k); },
        async list({ prefix = '' } = {}) { return { objects: await Promise.all([...objects.keys()].filter(k => k.startsWith(prefix)).sort().map(k => this.head(k))), truncated: false }; }
    };
}
// The live hub is a Durable Object; undo only wakes it to drain queued object deletes.
export function testHub() { return { idFromName: () => '', get: () => ({ fetch: async () => new Response() }) }; }
export async function slackServiceFixture() {
    const f = await teamFixture(), bucket = testBucket();
    const { Context } = await import('../../src/platform/storage/context.ts'), service = await import('../../src/imports/service.ts'), list = await import('../../src/imports/list.ts'), custody = await import('../../src/imports/custody.ts');
    const c = new Context({ DB: f.adapter, SESSION_SECRET:'synthetic-test-secret-at-least-thirty-two-characters', FILES: bucket, CHAT_HUB: testHub() }, f.owner);
    const upload = () => custody.localUpload(c, new Request('https://fixture.test/upload', { method: 'POST', body: slackFixture() }));
    async function preview(uploadId, members = [f.owner.operatorId], namespace = 'archive-fixture') {
        const review = { namespace, channels: [{ sourceId: 'C1', name: 'Imported general', members }, { sourceId: 'C2', name: 'Imported engineering', members: [f.owner.operatorId] }], actors: { U1: f.owner.operatorId, U2: null, U404: null }, acceptedOmissions: [] };
        const omission = await service.previewImport(c, { upload: uploadId, review }); review.acceptedOmissions = [omission.omissionDigest];
        return service.previewImport(c, { upload: uploadId, review });
    }
    async function finish(preview) {
        let result = await service.applyReviewed(c, preview.review, preview.fingerprint);
        for (let n = 0; result.job.state !== 'completed' && n < 20; n++) result = await service.resumeReviewed(c, preview.review);
        if (result.job.state !== 'completed') throw Error('Fixture import did not complete'); return result;
    }
    return { ...f, bucket, c, service, list, custody, upload, preview, finish };
}
