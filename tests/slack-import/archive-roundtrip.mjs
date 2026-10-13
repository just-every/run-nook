import { createPortability, readArchive, makePart } from '../../src/base/modules/portability/index.mjs';
import { ArchiveVerifier, ContentVerifier } from '../../src/base/modules/portability/format.mjs';
import { normalizedPortability } from '../../src/platform/storage/portability.mjs';
import { teamFixture } from '../team-sql-support.mjs';
import { testBucket } from './sqlite-service.mjs';
const policy = { product: 'team-chat/team-workspace', replaceableTables: ['schema_migrations', 'nook_storage'], ...normalizedPortability };
export async function roundTrip(f, inspect, mutate) {
    const exporter = await createPortability({ db: f.adapter, buckets: { FILES: f.bucket }, policy }), id = await exporter.exports.create();
    let target;
    try {
        while ((await exporter.exports.advance(id, { maxParts: 16 })).phase === 'building') {}
        target = await teamFixture({ bootstrap: false });
        const bucket = testBucket(), importer = await createPortability({ db: target.adapter, buckets: { FILES: bucket }, policy });
        let input, close;
        const records=[]; for await (const r of readArchive(await exporter.exports.download(id))) records.push(r);
        if(mutate){mutate(records.flatMap(r=>r.items??[]));const verifier=new ContentVerifier(records[0]),archive=new ArchiveVerifier(records[0]);for(let i=0;i<records.length;i++)if(records[i].kind==='part'){records[i]=await makePart(records[i].index,records[i].items);archive.add(records[i]);for(const item of records[i].items)verifier.add(item)}records.at(-1).contentHash=verifier.digest();records.at(-1).archiveHash=archive.digest()}
        for (const r of records) {
            if (r.kind === 'manifest') input = await importer.imports.create(r);
            else if (r.kind === 'part') await importer.imports.uploadPart(input, r.index, r);
            else close = r;
        }
        await importer.imports.finalize(input, { contentHash: close.contentHash, archiveHash: close.archiveHash });
        await inspect(target, bucket);
    } finally { await exporter.exports.abort(id); target?.close(); }
}
