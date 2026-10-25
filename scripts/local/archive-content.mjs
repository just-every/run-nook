import {createReadStream} from 'node:fs';
import {Readable} from 'node:stream';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readArchive} from '@runeditrun/rer/modules/portability';
import {canonicalJson,StreamHash} from '../../src/base/modules/portability/hash.mjs';
import {restoreAuditDetails} from '../../src/audit/restore.mjs';

// Archive integrity remains Base's complete manifest/parts/content verification.
// This additional identity compares Nook content, excluding only nook_audit
// history. Every other table, file byte/metadata, payload and erasure fact stays.
export async function archiveContent(source){
 const input=typeof source==='string'?Readable.toWeb(createReadStream(source)):source;
 const hash=new StreamHash(),audit=[];let manifest,closing;
 for await(const record of readArchive(input)){
  if(record.kind==='manifest'){
   manifest=record;
   const {exportedAt,partCount,...identity}=manifest;
   hash.update(canonicalJson({...identity,
    // Base's excluded scratch/recovery inventory can grow on import; those
    // tables carry no exported rows. Keep every product exclusion declaration.
    excludedTables:identity.excludedTables.filter(name=>!name.startsWith('rer_portability_')),
    tables:identity.tables.map(table=>table.name==='nook_audit'?{...table,count:0}:table)}));
  }else if(record.kind==='part'){
   for(const item of record.items)if(item.kind==='row'){
    if(item.table==='nook_audit')audit.push(item.row);
    else hash.update('\n'+canonicalJson({table:item.table,row:item.row,...(item.rowid===undefined?{}:{rowid:item.rowid})}));
   }
   // readArchive independently verifies actual binary bytes against every
   // object/payload digest in the manifest already included in this identity.
  }else closing=record;
 }
 return {contentIdentity:hash.digest(),manifest,closing,audit};
}

export function restoreCounts(manifest){
 return {tables:manifest.tables.length,rows:manifest.tables.reduce((sum,t)=>sum+t.count,0),
  objects:manifest.objects.length,objectBytes:manifest.objects.reduce((sum,o)=>sum+o.size,0),
  payloads:manifest.payloads.length,payloadBytes:manifest.payloads.reduce((sum,p)=>sum+p.size,0)};
}

export function compareArchiveContent(before,after){
 const previous=new Map(before.audit.map(row=>[row.id,row])),current=new Map(after.audit.map(row=>[row.id,row]));
 const added=after.audit.filter(row=>!previous.has(row.id));
 const expected={origin:'restore-origin',sourceContentHash:before.closing.contentHash,...restoreCounts(before.manifest)};
 const retained=before.audit.every(row=>current.has(row.id)&&canonicalJson(current.get(row.id))===canonicalJson(row));
 const restore=added.length===1?added[0]:undefined;
 const restoreRecorded=Boolean(restore&&restore.actor&&Number.isSafeInteger(restore.at)&&restore.at>0&&
  canonicalJson(restoreAuditDetails(restore))===canonicalJson(expected));
 return {identicalContent:before.contentIdentity===after.contentIdentity,auditHistoryRetained:retained,restoreRecorded,
  contentIdentity:after.contentIdentity,beforeAuditRows:before.audit.length,afterAuditRows:after.audit.length,
  sourceContentHash:before.closing.contentHash,restoredArchiveContentHash:after.closing.contentHash};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [before,after,...extra]=process.argv.slice(2);
 if(!before||!after||extra.length)throw Error('Usage: node scripts/local/archive-content.mjs BEFORE.rer AFTER.rer');
 const result=compareArchiveContent(await archiveContent(before),await archiveContent(after));
 console.log(JSON.stringify(result,null,2));
 if(!result.identicalContent||!result.auditHistoryRetained||!result.restoreRecorded)process.exitCode=1;
}
