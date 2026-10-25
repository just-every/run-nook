import assert from 'node:assert/strict';
import {archiveContent,compareArchiveContent,restoreCounts} from '../scripts/local/archive-content.mjs';
import {restoreAuditDetails} from '../src/audit/restore.mjs';

export async function assertContentRoundTrip(beforePath,afterPath){
 const before=await archiveContent(beforePath),after=await archiveContent(afterPath);
 const result=compareArchiveContent(before,after);
 assert.equal(result.identicalContent,true,'export, import and export again carry identical content excluding audit history');
 assert.equal(result.auditHistoryRetained,true,'every original audit row survives unchanged');
 assert.equal(result.restoreRecorded,true,'one restore-origin audit row records actor, time, source digest and counts');
 assert.notEqual(before.closing.contentHash,after.closing.contentHash,'the whole-archive hash includes the new restore audit event');
 return result;
}

export function assertRestoreAudit(row,{manifest,closing,actor,started,finished}){
 assert.ok(row,'a committed restore retains its audit event');
 assert.equal(row.actor,actor,'restore records the importing actor id');
 assert.ok(row.at>=started&&row.at<=finished,'restore records its commit time');
 assert.equal(row.kind,'archive.import.complete');assert.equal(row.scope,'workspace');assert.equal(row.version,1);
 assert.equal(row.count,restoreCounts(manifest).rows);
 assert.deepEqual(restoreAuditDetails(row),{origin:'restore-origin',sourceContentHash:closing.contentHash,...restoreCounts(manifest)},'restore records only its source archive content digest and counts, without personal data beyond actor id');
}
