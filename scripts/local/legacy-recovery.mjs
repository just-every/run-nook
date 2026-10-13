import {lstat} from 'node:fs/promises';
import {policy} from '@runeditrun/rer/modules/portability/catalogue';
import {createPortability} from '@runeditrun/rer/modules/portability';
import {createImport,uploadPart,finalizeImport,abortImport} from '@runeditrun/rer/modules/portability/import';
import {readLegacyArchive,ArchiveVerifier} from '@runeditrun/rer/modules/portability/format';
import {fileRecords,exportArchive} from '@runeditrun/rer/modules/portability/files';
import {ensureLegacyAudit,legacyTargetState,requireLegacyEmpty} from '@runeditrun/rer/modules/portability/legacy-safety';
import {PortabilityError} from '@runeditrun/rer/modules/portability/storage';
// Base replays the destination's migrations to identify exact seeded rows and
// empty FTS storage. Those rows and every other table are guarded again in the
// restore transaction; product export exclusions never exempt live data.
export async function legacyRecovery({db,buckets,policy:input,migrations},path,output){
 if(await lstat(output).catch(error=>{if(error.code==='ENOENT')return null;throw error}))throw new PortabilityError('legacy_output_exists',409);
 for await(const record of fileRecords(path,readLegacyArchive)){}
 const context={db,buckets,config:policy(input),migrations},target=await legacyTargetState(db,migrations);
 await requireLegacyEmpty(context,target);
 let id,closing,integrity,status,complete=false;
 try{
  for await(const record of fileRecords(path,readLegacyArchive)){
   if(record.kind==='manifest'){
    // A local staging envelope, never an assertion of v1 provenance.
    const manifest={...record,version:2};integrity=new ArchiveVerifier(manifest);
    id=await createImport(context,manifest,'legacy-v1',{event:'legacy_v1_unverified_restore',acknowledgedUnverifiedMetadata:true,sourceIdentity:record.sourceIdentity,exportedAt:record.exportedAt,recoveryOutput:output,...target});
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
