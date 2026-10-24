import assert from 'node:assert/strict'
import {mkdtemp,readdir,rename,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {DatabaseSync} from 'node:sqlite'
import {createPortability,readArchive} from '@runeditrun/rer/modules/portability'
import {productPolicy} from '../src/platform/portability-policy.mjs'
import {recoverNormalized} from '../scripts/storage/recover-identities.mjs'
import {installation} from './push/fixture.mjs'
import {migrationHistory} from './migration-history.mjs'

// Exercise the ordinary archive export, offline import and documented identity
// recovery, then inspect through a newly signed-in emitted Worker. No sessions
// or credential rows are transplanted from the source installation.
export async function withRestoredArchive({request,owner},inspect){
 const temporary=await mkdtemp(join(tmpdir(),'nook-archive-roundtrip-'))
 let restored
 try{
  const exported=(await request('/api/portability/exports',{method:'POST',cookie:owner.cookie,body:{},status:201})).data.id
  const records=[]
  try{
   let status
   for(let n=0;n<200;n++){status=(await request('/api/portability/exports/'+exported+'/advance',{method:'POST',cookie:owner.cookie,body:{maxParts:16}})).data;if(status.phase!=='building')break}
   assert.equal(status.phase,'complete')
   const raw=(await request('/api/portability/exports/'+exported+'/download',{cookie:owner.cookie})).raw
   for await(const record of readArchive(new Blob([raw]).stream()))records.push(record)
  }finally{await request('/api/portability/exports/'+exported+'/abort',{method:'POST',cookie:owner.cookie,body:{}})}
  const workerOptions={resourcePersistencePath:temporary,assets:{directory:process.cwd()+'/dist/client',binding:'ASSETS',run_worker_first:true}}
  restored=await installation(undefined,{bootstrap:false,workerOptions})
  const policy=await productPolicy(restored.db),importer=await createPortability({db:restored.db,buckets:{FILES:await restored.mf.getR2Bucket('FILES')},policy,migrations:migrationHistory(policy)}),id=await importer.imports.create(records[0])
  for(const record of records)if(record.kind==='part')await importer.imports.uploadPart(id,record.index,record)
  const end=records.at(-1);await importer.imports.finalize(id,{contentHash:end.contentHash,archiveHash:end.archiveHash})
  const actors=(await restored.db.prepare("SELECT * FROM nook_actors WHERE role<>'app'").all()).results
  await restored.close();restored=undefined
  let source
  async function visit(path){for(const item of await readdir(path,{withFileTypes:true})){const file=join(path,item.name);if(item.isDirectory())await visit(file);else if(item.name.endsWith('.sqlite')){const db=new DatabaseSync(file,{readOnly:true});try{if(db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name='nook_actors'").get().n)source=file}finally{db.close()}}}}
  await visit(temporary);assert.ok(source,'restored D1 store exists')
  const recovered=join(temporary,'recovered.sqlite')
  await recoverNormalized(source,recovered,{owner:owner.user.id,users:actors.map(a=>({id:a.id,email:a.email,role:a.role}))})
  await rename(recovered,source)
  for(const suffix of ['-wal','-shm'])await rm(source+suffix,{force:true})
  restored=await installation(undefined,{bootstrap:false,migrate:false,workerOptions})
  const actor=async id=>{const person=actors.find(a=>a.id===id);assert.ok(person);return restored.signIn(person.email)}
  await inspect({...restored,actor,records,owner:await actor(owner.user.id)})
 }finally{await restored?.close();await rm(temporary,{recursive:true,force:true})}
}
