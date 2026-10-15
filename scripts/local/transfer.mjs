import {journalEnvelope,readJournal} from './erasure-journal.mjs';
import {open,mkdir,unlink,readFile} from 'node:fs/promises';
import {constants} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {Readable} from 'node:stream';
import {getPlatformProxy,unstable_splitSqlQuery} from 'wrangler';
import {createPortability,readArchive,PortabilityError,MAX_PART_BYTES} from '@runeditrun/rer/modules/portability';
import {readLegacyArchive} from '@runeditrun/rer/modules/portability/format';
import {migrationReplay} from '@runeditrun/rer/modules/portability/migration-history';
import {recoverLegacyArchive} from '@runeditrun/rer/internal/modules/portability/legacy-files.mjs';
import {absent,privateFile,promote} from '@runeditrun/rer/modules/portability/cli-options';
import {rebuildSearch} from '../../src/platform/storage/portability.mjs';
import {productPolicy} from '../../src/platform/portability-policy.mjs';
async function* records(path,reader=readArchive){const file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);try{yield* reader(Readable.toWeb(file.createReadStream({autoClose:false})))}finally{await file.close()}}
// The applied migrations, in order, so a restore can place an archive made before later additive migrations.
async function migrations(root,db){const names=(await db.prepare('SELECT name FROM d1_migrations ORDER BY id').all()).results.map(row=>row.name);return migrationReplay(await Promise.all(names.map(async name=>({name,statements:unstable_splitSqlQuery(await readFile(resolve(root,'migrations',name),'utf8'))}))),await productPolicy(db))}
export async function transfer(direction,path,{root=process.cwd(),legacyOutput,laterArchive}={}){
 if(!['export','import'].includes(direction)||(legacyOutput||laterArchive)&&direction!=='import')throw Error('invalid_direction');
 // The public CLI admits legacyOutput only after explicit acknowledgement; Base owns recovery and its exact migration-seed guards.
 if(legacyOutput){for await(const record of records(path,readLegacyArchive)){}const proxy=await getPlatformProxy({configPath:resolve(root,'wrangler.jsonc'),persist:{path:resolve(root,'.wrangler/state/v3')},remoteBindings:false});try{const result=await recoverLegacyArchive({db:proxy.env.DB,buckets:{FILES:proxy.env.FILES},policy:await productPolicy(proxy.env.DB),migrations:()=>migrations(root,proxy.env.DB)},path,legacyOutput,[],true);await rebuildSearch(proxy.env.DB);for await(const record of records(legacyOutput))if(record.kind==='manifest'){const journal=await privateFile(legacyOutput+'.journal.rer',false);try{await journal.writeFile(JSON.stringify(journalEnvelope(record))+'\n');await journal.sync()}finally{await journal.close()}}return {...result,journal:legacyOutput+'.journal.rer',identityRecovery:'Follow OPERATIONS.md#restoring-a-local-archive: snapshot the stopped D1 with SQLite backup, recover every actor, and replace the original binding file before rer setup'}}finally{await proxy.dispose()}}
 const journalPath=process.env.NOOK_ERASURE_JOURNAL;let suppliedJournal=direction==='import'&&journalPath?await readJournal(resolve(root,journalPath)):null;
 // rer import --journal names a later archive of the same installation; its manifest carries the latest erasure journal.
 if(laterArchive)for await(const record of records(laterArchive))if(record.kind==='manifest')suppliedJournal=journalEnvelope(record);
 if(journalPath&&direction==='import'&&!suppliedJournal)throw Object.assign(Error('invalid_erasure_journal'),{code:'invalid_erasure_journal'});
 if(direction==='export'){await absent(path);await absent(path+'.journal.rer')}else for await(const record of records(path)){}
 const proxy=await getPlatformProxy({configPath:resolve(root,'wrangler.jsonc'),persist:{path:resolve(root,'.wrangler/state/v3')},remoteBindings:false});
 let service,id,complete=false,manifest,closing,created=false,journalCreated=false,journalPromoted=false;const temporary=path+'.partial',journalTemporary=path+'.journal.rer.partial';
 try{
  // New exports use smaller parts; retain the format's admission limit for
  // archives written before that change.
  service=await createPortability({db:proxy.env.DB,buckets:{FILES:proxy.env.FILES},policy:{...await productPolicy(proxy.env.DB),...(direction==='import'?{partBytes:MAX_PART_BYTES}:{})},...(direction==='import'?{migrations:()=>migrations(root,proxy.env.DB)}:{})});
  if(direction==='export'){
   // Dev personas are local-only people and never travel: suspend them through the product's own deactivation (it revokes their sessions and grants) so the archive holds them inactive. The next dev sign-in as a persona reactivates it.
   await proxy.env.DB.prepare("UPDATE oa_operators SET status='inactive' WHERE lower(email) LIKE '%@dev.localhost' AND status='active'").run();
   await mkdir(dirname(path),{recursive:true,mode:0o700});const file=await privateFile(temporary,false);created=true;
   try{id=await service.exports.create();while((await service.exports.advance(id,{maxParts:16})).phase==='building'){}
    const reader=(await service.exports.download(id)).getReader();try{for(;;){const {done,value}=await reader.read();if(done)break;await file.writeFile(value)}}finally{await reader.cancel();reader.releaseLock()}await file.sync();
   }finally{await file.close()}
   for await(const record of records(temporary)){if(record.kind==='manifest')manifest=record;if(record.kind==='closing')closing=record}
   const journal=await privateFile(journalTemporary,false);journalCreated=true;try{await journal.writeFile(JSON.stringify(journalEnvelope(manifest))+'\n');await journal.sync()}finally{await journal.close()}await promote(journalTemporary,path+'.journal.rer');journalPromoted=true;await promote(temporary,path);complete=true;
  }else{
   // Auth exclusions must not allow restoring private identities under a fresh owner.
   if((await proxy.env.DB.prepare('SELECT COUNT(*) AS n FROM oa_operators').first()).n)throw Error('restore_requires_empty_auth');
   for await(const record of records(path)){if(record.kind==='manifest'){manifest=record;id=await service.imports.create(manifest)}else if(record.kind==='part')await service.imports.uploadPart(id,record.index,record);else closing=record}
   await service.imports.finalize(id,{contentHash:closing.contentHash,archiveHash:closing.archiveHash,...(suppliedJournal?{laterJournal:suppliedJournal}:{})});await rebuildSearch(proxy.env.DB);complete=true;
  }
  return {contentHash:closing.contentHash,tables:manifest.tables.map(({name,count})=>({name,count})),requiredConfiguration:manifest.requiredConfiguration,journal:direction==='export'?path+'.journal.rer':undefined,identityRecovery:direction==='import'?'Follow OPERATIONS.md#restoring-a-local-archive: snapshot the stopped D1 with SQLite backup, recover every actor, and replace the original binding file before rer setup':undefined};
 }finally{try{if(id){if(direction==='export')await service.exports.abort(id);else if(!complete)await service.imports.abort(id)}}finally{try{if(created)await unlink(temporary).catch(error=>{if(error.code!=='ENOENT')throw error});if(journalCreated)await unlink(journalTemporary).catch(error=>{if(error.code!=='ENOENT')throw error});if(journalPromoted&&!complete)await unlink(path+'.journal.rer')}finally{await proxy.dispose()}}}
}
if(process.argv[1]===new URL(import.meta.url).pathname){try{console.log(JSON.stringify({ok:true,...await transfer(process.argv[2],process.argv[3],Object.fromEntries([['--legacy-output','legacyOutput'],['--later-archive','laterArchive']].map(([flag,key])=>[key,process.argv.includes(flag)?process.argv[process.argv.indexOf(flag)+1]:undefined])))}))}catch(error){console.log(JSON.stringify({ok:false,reason:error instanceof PortabilityError?error.code.split(':')[0]:error.code??'transfer_refused'}));process.exitCode=4}}
