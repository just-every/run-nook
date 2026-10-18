import assert from 'node:assert/strict'
import {readFile,mkdtemp,rm,unlink} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {DatabaseSync} from 'node:sqlite'
import {createHash} from 'node:crypto'
import {invite} from '../auth-support.mjs'
const exec=promisify(execFile),fixture=new URL('./fixtures/once-campfire-express.tar.gz',import.meta.url)
export async function campfireJourney({origin,owner,restart,sql,validateArchive,check}){
 const backup=await readFile(fixture),manifest=JSON.parse(await readFile(new URL('./fixtures/manifest.json',import.meta.url))),population=JSON.parse(await readFile(new URL('./fixtures/population.json',import.meta.url))),suffix=crypto.randomUUID().slice(0,8)
 const sourceMessages=JSON.parse(await readFile(new URL('./fixtures/source-messages.json',import.meta.url)))
 const people=[owner,...await Promise.all(['Leo','Aisha','Sam'].map(name=>invite(origin,owner.cookie,'Campfire'+name+suffix)))],outsider=await invite(origin,owner.cookie,'CampfireOutsider'+suffix),mapped=Object.fromEntries(people.map((p,i)=>[String(i+1),p.user.id]))
 async function call(path,{body,bytes,actor=owner,status=200,method}={}){
  const response=await fetch(origin+path,{method:method??(body!==undefined||bytes?'POST':'GET'),headers:{Connection:'close',origin,cookie:actor.cookie,...(bytes?{'Content-Type':'application/gzip'}:body!==undefined?{'Content-Type':'application/json'}:{})},body:bytes??(body!==undefined?JSON.stringify(body):undefined)}),raw=await response.text()
  assert.equal(response.status,status,`${path}: ${raw}`);return response.headers.get('content-type')?.includes('json')?JSON.parse(raw):raw
 }
 const operatorCount=(await sql('SELECT COUNT(*) AS n FROM oa_operators'))[0].n
 const base='/api/campfire-imports',upload=await call(base+'/upload',{bytes:backup}),review={namespace:'campfire-'+suffix,actors:mapped,acceptedOmissions:[]}
 let preview=await call(base+'/preview',{body:{upload:upload.upload,review}})
 if(preview.needsOmissionReview){review.acceptedOmissions=[preview.omissionDigest];preview=await call(base+'/preview',{body:{upload:upload.upload,review}})}
 await check('NOOK-044 genuine Campfire backup review reconciles all rooms, messages, files and mapped audiences',async()=>{
  assert.equal(preview.counts.channels,manifest.rooms.length);assert.equal(preview.counts.actors,manifest.counts.users);assert.equal(preview.counts.messages,manifest.counts.messages)
  assert.equal(preview.counts.files,manifest.files.length);assert.equal(preview.counts.bytes,manifest.files.reduce((n,f)=>n+f.byte_size,0))
  assert.deepEqual(preview.fileHashes.map(f=>({name:f.name,sha256:f.sha256,size:f.size,mime:f.mime})).sort((a,b)=>a.name.localeCompare(b.name)),manifest.files.map(f=>({name:f.filename,sha256:f.sha256,size:f.byte_size,mime:f.content_type})).sort((a,b)=>a.name.localeCompare(b.name)))
  for(const room of manifest.rooms){const planned=preview.channels.find(c=>c.sourceId===String(room.id));assert.deepEqual([...planned.members].sort(),room.participants.map(id=>mapped[id]).sort());assert.equal(planned.kind,{'Rooms::Open':'channel','Rooms::Closed':'private','Rooms::Direct':'dm'}[room.type])}
  const changed={...review,actors:{...mapped,'2':mapped['1']}};await call(base+'/preview',{body:{upload:upload.upload,review:changed},status:400})
  await call(base+'/'+preview.review+'/apply',{body:{fingerprint:'changed-approval'},status:409})
  assert.doesNotMatch(JSON.stringify(preview),/password_digest|session_token|bot_key/)
 })
 await call(base+'/'+preview.review+'/apply',{body:{fingerprint:preview.fingerprint}})
 await restart()
 let result=await call(base+'/'+preview.review+'/resume',{body:{}})
 for(let n=0;result.job.state!=='completed'&&n<20;n++)result=await call(base+'/'+preview.review+'/resume',{body:{}})
 assert.equal(result.job.state,'completed')
 const status=await call(base+'/'+preview.review),destinations=new Map(status.destinations.map(d=>[Number(d.sourceId),d.id]))
 await check('NOOK-044 lost acknowledgement resumes once without duplicates, private audience expansion or live effects',async()=>{
  const messagesBefore=(await sql(`SELECT COUNT(*) AS n FROM nook_import_records WHERE job=(SELECT domain_job FROM nook_import_reviews WHERE id='${preview.review}')`))[0].n
  await call(base+'/'+preview.review+'/apply',{body:{fingerprint:preview.fingerprint}})
  assert.equal((await sql(`SELECT COUNT(*) AS n FROM nook_import_records WHERE job=(SELECT domain_job FROM nook_import_reviews WHERE id='${preview.review}')`))[0].n,messagesBefore)
  assert.equal(messagesBefore,manifest.counts.messages)
  assert.equal((await sql('SELECT COUNT(*) AS n FROM oa_operators'))[0].n,operatorCount,'import creates no credentials or accounts')
  assert.equal((await sql("SELECT COUNT(*) AS n FROM nook_import_actors WHERE json_type(source_record,'$.password_digest') IS NOT NULL OR json_type(source_record,'$.bot_key') IS NOT NULL"))[0].n,0,'source credentials never become imported author records')
  for(const room of manifest.rooms){
   const id=destinations.get(room.id),actor=people[room.participants[0]-1],history=await call(`/api/conversations/${id}/messages`,{actor}),expected=population.messages.filter(m=>m.room===room.id)
   assert.equal(history.length,expected.length)
   for(const message of history){const source=sourceMessages.find(m=>String(m.id)===message.provenance.sourceRecord.id);assert.ok(source);assert.equal(source.room_id,room.id);assert.equal(message.provenance.actor,String(source.creator_id));assert.equal(message.provenance.sourceRecord.richText.body,source.body);assert.equal(message.provenance.sourceRecord.created_at,source.created_at);assert.equal(message.provenance.sourceRecord.updated_at,source.updated_at);assert.equal(message.parent,null);assert.equal(message.immutable,true);assert.equal(message.author,null)}
   const memberRows=await call(`/api/conversations/${id}/members`,{actor})
   assert.deepEqual(memberRows.map(m=>m.id).sort(),room.participants.map(id=>mapped[id]).sort())
   if(room.type!=='Rooms::Open'){
    await call(`/api/conversations/${id}/messages/window`,{actor:outsider,status:403})
    if(!room.participants.includes(1))await call(`/api/conversations/${id}/messages/window`,{actor:owner,status:403})
   }
   for(const message of history)for(const file of message.attachments){const response=await fetch(origin+`/api/attachments/${file.id}/download`,{headers:{cookie:actor.cookie}});assert.equal(response.status,200);const bytes=Buffer.from(await response.arrayBuffer()),expected=manifest.files.find(f=>String(f.message)===message.provenance.sourceRecord.id);assert.equal(createHash('sha256').update(bytes).digest('hex'),expected.sha256);assert.equal(bytes.length,expected.byte_size);if(room.type!=='Rooms::Open')await call(`/api/attachments/${file.id}/download`,{actor:outsider,status:404})}
   const conversation=(await call('/api/conversations',{actor})).find(c=>c.id===id);assert.equal(conversation.unread,0)
  }
  assert.equal((await sql(`SELECT COUNT(*) AS n FROM nook_events WHERE conversation IN (SELECT conversation FROM nook_import_channels WHERE job=(SELECT domain_job FROM nook_import_reviews WHERE id='${preview.review}'))`))[0].n,0)
  await validateArchive()
 })
 await check('NOOK-044 incomplete or unsupported genuine backups are refused before publication',async()=>{
  const before=(await sql('SELECT COUNT(*) AS n FROM nook_imports'))[0].n
  for(const kind of ['unsupported','missing-file','ambiguous-membership']){
   const directory=await mkdtemp(join(tmpdir(),'nook-campfire-negative-'))
   try{await exec('tar',['-xzf',resolve(fixture.pathname),'-C',directory]);if(kind!=='missing-file'){const db=new DatabaseSync(join(directory,'storage/db/production.sqlite3'));try{if(kind==='unsupported')db.exec("INSERT INTO schema_migrations(version) VALUES('unsupported-future-schema')");else db.prepare('DELETE FROM memberships WHERE room_id=? AND user_id=?').run(manifest.rooms[0].id,manifest.rooms[0].participants.at(-1))}finally{db.close()}}else await unlink(join(directory,manifest.files[0].path));const path=join(directory,'changed.tar.gz');await exec('tar',['-czf',path,'-C',directory,'storage'],{env:{...process.env,COPYFILE_DISABLE:'1'}});await call(base+'/upload',{bytes:await readFile(path),status:400})}finally{await rm(directory,{recursive:true,force:true})}
  }
  assert.equal((await sql('SELECT COUNT(*) AS n FROM nook_imports'))[0].n,before)
 })
 const native=await call(`/api/conversations/${destinations.get(2)}/messages`,{body:{body:'Native launch decision after migration',intent:crypto.randomUUID()}})
 await check('NOOK-044 guarded undo preserves later native work and leaves the imported history readable',async()=>{
  await call(base+'/'+preview.review+'/undo',{body:{},status:409});const messages=await call(`/api/conversations/${destinations.get(2)}/messages`);assert.ok(messages.some(m=>m.id===native.id));assert.ok(messages.some(m=>m.immutable))
 })
 await check('NOOK-044 clean guarded reversal removes only the reviewed imported records and files',async()=>{
  const choices={...review,namespace:review.namespace+'-undo'};let clean=await call(base+'/preview',{body:{upload:upload.upload,review:choices}})
  if(clean.needsOmissionReview){choices.acceptedOmissions=[clean.omissionDigest];clean=await call(base+'/preview',{body:{upload:upload.upload,review:choices}})}
  let applied=await call(base+'/'+clean.review+'/apply',{body:{fingerprint:clean.fingerprint}})
  for(let n=0;applied.job.state!=='completed'&&n<20;n++)applied=await call(base+'/'+clean.review+'/resume',{body:{}})
  const targets=(await call(base+'/'+clean.review)).destinations
  let undone=await call(base+'/'+clean.review+'/undo',{body:{}})
  for(let n=0;!['undone','rolled_back'].includes(undone.job.state)&&n<20;n++)undone=await call(base+'/'+clean.review+'/undo',{body:{}})
  assert.equal(undone.job.state,'undone')
  for(const target of targets)await call(`/api/conversations/${target.id}/messages/window`,{status:403})
  assert.ok((await call(`/api/conversations/${destinations.get(2)}/messages`)).some(m=>m.id===native.id))
  await validateArchive()
 })
 return {call,base,upload,preview,people,outsider,mapped,destinations,manifest,backup}
}

export async function campfireErasure({journey,check,validateArchive}){
 const {call,people,destinations}=journey
 await check('NOOK-044 imported custody follows member erasure and remains admissible to owned backup',async()=>{
  let receipt=await call('/api/erasures',{body:{kind:'member',target:people[3].user.id,confirmation:'ERASE'}})
  for(let n=0;receipt.state!=='complete'&&n<80;n++)receipt=await call('/api/erasures/'+receipt.id+'/resume',{body:{}})
  assert.equal(receipt.state,'complete')
  assert.ok((await call(`/api/conversations/${destinations.get(2)}/messages`)).some(m=>m.body==='Native launch decision after migration'))
  await validateArchive()
 })
}
