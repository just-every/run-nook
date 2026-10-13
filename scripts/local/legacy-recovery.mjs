import {lstat} from 'node:fs/promises';
import {policy} from '@runeditrun/rer/modules/portability/catalogue';
import {createPortability} from '@runeditrun/rer/modules/portability';
import {createImport,uploadPart,finalizeImport,abortImport} from '@runeditrun/rer/modules/portability/import';
import {readLegacyArchive,ArchiveVerifier} from '@runeditrun/rer/modules/portability/format';
import {fileRecords,exportArchive} from '@runeditrun/rer/modules/portability/files';
import {ensureLegacyAudit,legacyEmptyTables,requireLegacyEmpty} from '@runeditrun/rer/modules/portability/legacy-safety';
import {PortabilityError} from '@runeditrun/rer/modules/portability/storage';
// Base's backup-only v1 recovery (modules/portability/legacy-files.mjs), with
// one difference: which tables a new Nook installation leaves non-empty. Base
// requires every table to be empty, but a fresh Nook has rows that are not data:
// the two replaceable tables its migrations seed (the schema ledger and the
// storage authority row), which every restore replaces atomically, and the
// internal FTS5 shadow tables of the empty search index, which SQLite fills
// when the index is created. Everything else, including identities, the
// excluded tables and the bucket, must be empty, and Base's finalize guards
// re-check exactly that list inside the restore batch. The steps after the
// check are Base's: unverified-metadata audit, v2 staging and a fresh v2 export.
const seeded={
 schema_migrations:"SELECT count(*)=5 AS ok FROM schema_migrations WHERE (version,name) IN (VALUES(1,'workspace-document-v1'),(2,'private-attachments-v2'),(3,'calm-attention-v3'),(4,'immutable-imports-v4'),(5,'normalized-storage-v5'))",
 nook_storage:"SELECT count(*)=1 AS ok FROM nook_storage WHERE id=1 AND authority='normalized' AND phase='ready'",
};
async function emptyTables(db){
 const fts=(await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND sql LIKE 'CREATE VIRTUAL TABLE%USING fts5%'").all()).results.map(row=>row.name);
 const shadow=name=>fts.some(table=>['data','idx','content','docsize','config'].some(suffix=>name===table+'_'+suffix));
 return (await legacyEmptyTables(db)).filter(name=>!Object.hasOwn(seeded,name)&&!shadow(name));
}
export async function legacyRecovery({db,buckets,policy:input,migrations},path,output){
 if(await lstat(output).catch(error=>{if(error.code==='ENOENT')return null;throw error}))throw new PortabilityError('legacy_output_exists',409);
 for await(const record of fileRecords(path,readLegacyArchive)){}
 const context={db,buckets,config:policy(input),migrations},empty=await emptyTables(db);
 await requireLegacyEmpty(context,empty);
 for(const [table,check] of Object.entries(seeded))if(await db.prepare(`SELECT 1 FROM ${table} LIMIT 1`).first()&&!(await db.prepare(check).first())?.ok)throw new PortabilityError('legacy_target_not_empty:'+table,409);
 let id,closing,integrity,status,complete=false;
 try{
  for await(const record of fileRecords(path,readLegacyArchive)){
   if(record.kind==='manifest'){
    // A local staging envelope, never an assertion of v1 provenance.
    const manifest={...record,version:2};integrity=new ArchiveVerifier(manifest);
    id=await createImport(context,manifest,'legacy-v1',{event:'legacy_v1_unverified_restore',acknowledgedUnverifiedMetadata:true,sourceIdentity:record.sourceIdentity,exportedAt:record.exportedAt,recoveryOutput:output,emptyTables:empty});
    await ensureLegacyAudit(db);
   }else if(record.kind==='part'){integrity.add(record);await uploadPart(context,id,record.index,record)}
   else closing=record;
  }
  status=await finalizeImport(context,id,{contentHash:closing.contentHash,archiveHash:integrity.digest()});complete=true;
 }finally{if(id&&!complete)await abortImport(context,id)}
 try{
  const recovered=await exportArchive(await createPortability({db,buckets,policy:input}),output,[]);
  return {...recovered,legacyRecovery:true,unverifiedMetadata:true,restoredContentHash:closing.contentHash,...(status.bridged?{bridged:status.bridged}:{})};
 }catch{throw new PortabilityError('legacy_restored_export_failed',500)}
}
