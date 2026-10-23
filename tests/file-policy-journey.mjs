import {test} from 'node:test'
import assert from 'node:assert/strict'
import {installation,until} from './push/fixture.mjs'
import {createPortability,readArchive} from '@runeditrun/rer/modules/portability'
import {productPolicy} from '../src/platform/portability-policy.mjs'
import {migrationHistory} from './migration-history.mjs'
import {browserWidths,checkScreen,evidenceDirectory} from './browser-support.mjs'
import {expect} from '@playwright/test'

test('NOOK-061 owner file policy versions size and extensions before native, clip, import and scheduled byte storage, audits, exports, restores and exposes settings at both widths',{timeout:240000},async()=>{
 const app=await installation(async()=>assert.fail('file policy sends nothing externally'),{workerOptions:{assets:{directory:process.cwd()+'/dist/client',binding:'ASSETS',run_worker_first:true}}});let restore
 try{
  const {call,db,origin,ownerCookie}=app,room=await call('/api/conversations','POST',{name:'Synthetic file policy',kind:'private'},ownerCookie),member=await app.invite('synthetic-nook-file-member',room.id),admin=await app.invite('synthetic-nook-file-admin',room.id)
  await db.prepare("UPDATE oa_operators SET role='admin' WHERE id=?").bind(admin.user.id).run();Object.assign(admin,await app.signIn('synthetic-nook-file-admin@example.test'))
  const path='/api/team/file-policy',defaults=await call(path,'GET',undefined,ownerCookie)
  assert.deepEqual(defaults,{version:0,maxBytes:26214400,blockedExtensions:[]})
  const binary=async(name,bytes,status=200,mime='text/plain')=>{const response=await fetch(origin+`/api/conversations/${room.id}/attachments`,{method:'POST',headers:{cookie:ownerCookie,origin,'content-type':mime,'x-filename':encodeURIComponent(name),'x-upload-intent':crypto.randomUUID()},body:bytes});assert.equal(response.status,status,name);return response.json()}
  const existing=await binary('synthetic-existing.txt','x'.repeat(2048))
  const at=new Date(Math.ceil((Date.now()+30000)/60000)*60000).toISOString().slice(0,16),scheduled=await call(`/api/conversations/${room.id}/scheduled`,'POST',{body:'Synthetic scheduled file policy control',localAt:at,zone:'UTC',recurrence:'none',endDate:null,attachments:[existing.id],intent:crypto.randomUUID()},ownerCookie)
  const input={version:0,maxBytes:1024,blockedExtensions:['.EXE']}
  for(const actor of [member,admin]){await call(path,'GET',undefined,actor.cookie,403);await call(path,'PATCH',input,actor.cookie,403)}
  await call(path,'PATCH',{...input,maxBytes:26214401},ownerCookie,400);await call(path,'PATCH',{...input,blockedExtensions:['bad.']},ownerCookie,400)
  const policy=await call(path,'PATCH',input,ownerCookie);assert.deepEqual(policy,{version:1,maxBytes:1024,blockedExtensions:['exe']})
  await call(path,'PATCH',input,ownerCookie,409)
  const bucket=await app.mf.getR2Bucket('FILES'),before=(await bucket.list()).objects.map(o=>o.key).sort(),attachments=(await db.prepare('SELECT count(*) AS n FROM nook_attachments').first()).n
  for(const [name,bytes,status] of [['synthetic-blocked.EXE','x',415],['synthetic-large.txt','x'.repeat(1025),413]]){const refused=await binary(name,bytes,status);assert.match(refused.error,/Workspace file policy/)}
  for(const [name,bytes,status] of [['synthetic-json.exe','x',415],['synthetic-json.txt','x'.repeat(1025),413]]){const refused=await call(`/api/conversations/${room.id}/attachments`,'POST',{name,mime:'text/plain',data:Buffer.from(bytes).toString('base64'),intent:crypto.randomUUID()},ownerCookie,status);assert.match(refused.error,/Workspace file policy/)}
  const audio=Buffer.alloc(2048);audio.write('RIFF',0);audio.write('WAVE',8);assert.match((await binary('synthetic-clip.wav',audio,413,'audio/wav')).error,/Workspace file policy/)
  assert.equal((await db.prepare('SELECT count(*) AS n FROM nook_attachments').first()).n,attachments,'every refused native/clip upload reserves no attachment')
  assert.deepEqual((await bucket.list()).objects.map(o=>o.key).sort(),before,'refused files store no bytes')
  const importBefore=(await db.prepare('SELECT count(*) AS n FROM ik_door_chunks').first()).n
  for(const source of ['slack','campfire','mattermost']){const refused=await call('/api/operator/import/uploads','POST',{name:source+'-reviewed-history.json',totalBytes:2,totalChunks:1,index:0,base64:'e30=',bundleSha256:'0'.repeat(64),chunkSha256:'0'.repeat(64)},ownerCookie,409,{'X-Import-Source':source,'X-Import-Namespace':'synthetic-file-policy'});assert.match(refused.error,/Workspace file policy/)}
  assert.equal((await db.prepare('SELECT count(*) AS n FROM ik_door_chunks').first()).n,importBefore,'restricted import captures store no chunk bytes')
  const accepted=await binary('synthetic-accepted.txt','Allowed text');assert.equal(accepted.size,12)
  await call(`/api/conversations/${room.id}/messages`,'POST',{body:'Synthetic accepted control',attachments:[accepted.id],intent:crypto.randomUUID()},ownerCookie)
  const acceptedKeys=(await bucket.list()).objects.map(o=>o.key).sort()
  await until(async()=>(await call('/api/scheduled','GET',undefined,ownerCookie)).items.find(row=>row.id===scheduled.id)?.state==='failed','scheduled copy refuses the current file policy',110000)
  const failed=(await call('/api/scheduled','GET',undefined,ownerCookie)).items.find(row=>row.id===scheduled.id);assert.match(failed.reason,/Workspace file policy/)
  assert.deepEqual((await bucket.list()).objects.map(o=>o.key).sort(),acceptedKeys,'a refused scheduled copy stores no bytes')
  assert.equal((await call(`/api/conversations/${room.id}/messages`,'GET',undefined,ownerCookie)).filter(row=>row.body==='Synthetic scheduled file policy control').length,0)
  const audit=(await db.prepare("SELECT * FROM nook_audit WHERE kind='policy.files'").all()).results;assert.equal(audit.length,1);assert.equal(audit[0].version,1);assert.match(audit[0].reason,/1024 bytes.*\.exe/)

  let job=await call('/api/readable-exports','POST',{scope:'conversation',conversationId:room.id,custodyAccepted:true},ownerCookie)
  while(!job.complete)job=await call(`/api/readable-exports/${job.id}/step`,'POST',{},ownerCookie)
  const records=[];for(const page of (await call(`/api/readable-exports/${job.id}/index`,'GET',undefined,ownerCookie)).items)records.push(...(await call(`/api/readable-exports/${job.id}/pages/${page.ordinal}`,'GET',undefined,ownerCookie)).records)
  assert.deepEqual(records.find(row=>row.type==='file_policy').data,{conversation:'',version:1,max_bytes:1024,blocked_extensions:['exe']})
  const service=await createPortability({db,buckets:{FILES:bucket},policy:await productPolicy(db)}),id=await service.exports.create(),archive=[]
  try{while((await service.exports.advance(id,{maxParts:16})).phase==='building'){}for await(const part of readArchive(await service.exports.download(id)))archive.push(part)}finally{await service.exports.abort(id)}
  assert.deepEqual(archive.flatMap(part=>part.items??[]).filter(item=>item.table==='nook_file_policy').map(item=>item.row),[{id:1,version:1,max_bytes:1024,blocked_json:'["exe"]'}])
  restore=await installation(async()=>assert.fail('restoring file policy sends nothing'),{bootstrap:false})
  const importer=await createPortability({db:restore.db,buckets:{FILES:await restore.mf.getR2Bucket('FILES')},policy:await productPolicy(restore.db),migrations:migrationHistory(await productPolicy(restore.db))}),importId=await importer.imports.create(archive[0])
  for(const part of archive)if(part.kind==='part')await importer.imports.uploadPart(importId,part.index,part)
  const end=archive.at(-1);await importer.imports.finalize(importId,{contentHash:end.contentHash,archiveHash:end.archiveHash})
  assert.deepEqual(await restore.db.prepare('SELECT * FROM nook_file_policy').first(),{id:1,version:1,max_bytes:1024,blocked_json:'["exe"]'})
  await restore.close();restore=undefined
  await fetch(origin+'/setup',{method:'POST',redirect:'manual',headers:{cookie:ownerCookie,origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'})
  const destination=evidenceDirectory('file-policy')
  await browserWidths(async(width,open)=>{const errors=[],session=await open({cookie:ownerCookie,origin},{errors}),{page}=session;try{
   await page.goto(origin+'/app?view=you');const settings=page.getByRole('region',{name:'Settings',exact:true}),section=settings.getByRole('region',{name:'File policy',exact:true});await expect(section.getByLabel('Blocked file extensions',{exact:true})).toHaveValue('exe');await section.getByLabel('Maximum file size (MiB)',{exact:true}).fill('0.001953125');await section.getByLabel('Blocked file extensions',{exact:true}).fill('exe\nzip');await section.getByRole('button',{name:'Save file policy',exact:true}).click();await expect(section.getByRole('status')).toContainText('File policy saved.');await section.scrollIntoViewIfNeeded();await page.screenshot({path:destination+'/settings-'+width+'.png',animations:'disabled'});await checkScreen(page,destination,'file-policy-'+width,errors)
   const latest=await call(path,'GET',undefined,ownerCookie);assert.equal(latest.maxBytes,2048);assert.deepEqual(latest.blockedExtensions,['exe','zip']);const saved=await call(path,'PATCH',{version:latest.version,maxBytes:1024,blockedExtensions:['exe']},ownerCookie);await section.getByRole('button',{name:'Save file policy',exact:true}).click();await expect(section.getByRole('alert')).toContainText('File policy changed; reload before saving');await section.getByRole('button',{name:'Reload file policy',exact:true}).click();await expect(section.getByLabel('Blocked file extensions',{exact:true})).toHaveValue(saved.blockedExtensions.join('\n'))
  }finally{await session.close()}},destination)
 }finally{await restore?.close();await app.close()}
})
