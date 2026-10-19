import {test,after} from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {createRequire} from 'node:module'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {teamFixture} from './team-sql-support.mjs'
import {attachImportDoor} from './slack-import/sqlite-service.mjs'
import {zipFixture} from './slack-import/fixture.mjs'

const require=createRequire(import.meta.url),wranglerRequire=createRequire(require.resolve('wrangler'))
const {build}=wranglerRequire('esbuild'),dir=await mkdtemp(join(tmpdir(),'nook-readable-'))
after(()=>rm(dir,{recursive:true,force:true}))
const outfile=join(dir,'export.mjs')
await build({stdin:{contents:`export {Context} from './src/platform/storage/context';export {readableExportRoute} from './src/exit/routes';export {offlineHtml,jsonDocument,jsonLines} from './src/exit/format';export {write} from './src/platform/storage/commands';export {upload} from './src/platform/storage/files';export {react} from './src/team/reactions.server';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile,logLevel:'silent'})
const code=await import(outfile),hash=bytes=>createHash('sha256').update(bytes).digest('hex')
async function fixture(){
 const f=await teamFixture(),objects=new Map()
 const env={DB:f.adapter,SESSION_SECRET:'synthetic-test-secret-at-least-thirty-two-characters',FILES:{
  async put(key,value,{customMetadata}={}){objects.set(key,{bytes:new Uint8Array(value),customMetadata})},
  async get(key){const entry=objects.get(key);return entry?{size:entry.bytes.length,customMetadata:entry.customMetadata,arrayBuffer:async()=>entry.bytes.buffer,body:new ReadableStream({start(c){c.enqueue(entry.bytes);c.close()}})}:null},
  async head(key){const entry=objects.get(key);return entry?{size:entry.bytes.length,customMetadata:entry.customMetadata}:null},
  async delete(key){objects.delete(key)},async list(){return {objects:[...objects.keys()].map(key=>({key})),truncated:false}},
 },CHAT_HUB:{idFromName:()=>'',get:()=>({fetch:async()=>new Response()})}}
 const context=actor=>new code.Context(env,actor)
 async function person(name,options){const response=await f.accept(await f.invite(name.toLowerCase()+'@example.test',options));const cookie=response.headers.get('set-cookie').split(';')[0];return f.auth.getSession(f.request('/auth/session',null,cookie))}
 async function signIn(email){await f.call('/auth/magic-link',{email});const response=await f.call('/auth/confirm',{token:f.token()});assert.equal(response.status,303);return f.auth.getSession(f.request('/auth/session',null,response.headers.get('set-cookie').split(';')[0]))}
 const door=(actor,path='',input)=>code.readableExportRoute(context(actor),new Request('https://fixture.test/api/readable-exports'+path,{method:input===undefined?'GET':'POST',headers:{Origin:'https://fixture.test'}}),input??{})
 const json=async(actor,path='',input)=>{const response=await door(actor,path,input);assert.ok(response);return response.json()}
 async function finish(actor,job){for(let n=0;!job.complete&&n<200;n++)job=await json(actor,`/${job.id}/step`,{});assert.ok(job.complete,'every bounded page completes');return job}
 async function bundle(actor,job){
  const records=[],files=[],pageIndex=[];let after=-1
  for(;;){const page=await json(actor,`/${job.id}/index?after=${after}`);pageIndex.push(...page.items);if(!page.hasMore)break;assert.ok(page.cursor>after);after=page.cursor}
  assert.equal(pageIndex.length,job.pages)
  for(const entry of pageIndex){const response=await door(actor,`/${job.id}/pages/${entry.ordinal}`),body=await response.text();assert.equal(hash(body),entry.sha256);const page=JSON.parse(body);assert.equal(page.records.length,entry.records);records.push(...page.records)}
  for(const {data:file} of records.filter(r=>r.type==='files'&&r.data.state==='attached')){const response=await door(actor,`/${job.id}/files/${file.id}`),bytes=Buffer.from(await response.arrayBuffer());assert.equal(hash(bytes),file.sha256);assert.equal(bytes.length,file.size);files.push({id:file.id,sha256:file.sha256,size:file.size,base64:bytes.toString('base64')})}
  assert.equal(records.length,job.records);assert.equal(files.length,job.files);assert.equal(files.reduce((n,f)=>n+f.size,0),job.bytes)
  return {format:job.format,version:job.version,report:{...job,pageIndex},records,files}
 }
 return {...f,objects,context,person,signIn,door,json,finish,bundle}
}
const denied=(promise,status)=>assert.rejects(promise,error=>error.status===status)
async function imported(f){
 const bytes=Buffer.from('Imported exact bytes\n'),first='1700000000.000001',reply='1700000001.000002'
 const {door}=await attachImportDoor(f,f.context(f.owner).env.FILES)
 const inspection=await door.inspect(zipFixture([
  ['users.json',[{id:'U1',name:'Source author'}]],
  ['channels.json',[{id:'C1',name:'source-launch'}]],
  ['source-launch/2024-01-01.json',[
   {type:'message',user:'U1',ts:first,text:'Imported root',reactions:[{name:'custom_party',count:1,users:['U1']}],files:[{id:'F1',name:'source.txt',mimetype:'text/plain',size:bytes.length},{id:'FEXTERNAL',name:'external.pdf',mimetype:'application/pdf',size:17,url_private:'https://never-fetch.invalid/file'}]},
   {type:'message',user:'U1',ts:reply,text:'Imported thread reply',thread_ts:first}
  ]],
  ['files/F1/source.txt',bytes]
 ]))
 const review={namespace:'readable-source',channels:[{sourceId:'C1',name:'Imported launch',members:[f.owner.operatorId]}],actors:{U1:null},importWithoutMissingFiles:true,acceptedOmissions:[]}
 const local=await door.prepare(inspection,review)
 review.acceptedOmissions=[local.summary.omissionDigest]
 return door.finish(await door.plan(inspection,review))
}

test('NOOK-047 readable exit pages native/imported threads, histories, acceptance, reactions, exact files and offline formats without truncation',async()=>{
 const f=await fixture();try{
  const member=await f.person('ReadableMember'),c=f.context(f.owner),peer=f.context(member),write=(actor,action,id,input)=>code.write(actor,action,id,input)
  // A legacy membership event records only its opaque subject/sequence.
  f.db.prepare("UPDATE nook_conversations SET seq=seq+1 WHERE id='launch'").run()
  f.db.prepare("INSERT INTO nook_events SELECT id,seq,'membership',?,? FROM nook_conversations WHERE id='launch'").run(member.operatorId,f.owner.operatorId)
  const root=await write(c,'messages','launch',{body:'Original body <script>unsafe()</script>',intent:'root'})
  await write(c,'edit',root.id,{version:root.version,body:'Edited body <img src="https://never-fetch.invalid/tracker">'})
  const reply=await write(peer,'messages','launch',{body:'Native reply',parent:root.id,intent:'reply'})
  await code.react(peer,root.id,{emoji:'👍',add:true})
  const attachment=await code.upload(c,'launch',{name:'native.txt',mime:'text/plain',bytes:new TextEncoder().encode('Native exact bytes\n'),intent:'native-file'})
  await write(c,'messages','launch',{body:'File context',attachments:[attachment.id],intent:'attachment-message'})
  const commitment=await write(c,'outcomes','launch',{kind:'commitment',body:'Review the launch',assignee:member.operatorId,source:root.id})
  await write(peer,'reviseOutcome',commitment.id,{version:commitment.version,action:'accept'})
  await write(c,'reviseOutcome',commitment.id,{version:commitment.version+1,body:'Review the revised launch'})
  await write(peer,'reviseOutcome',commitment.id,{version:commitment.version+2,action:'accept'})
  await write(c,'outcomes','launch',{kind:'decision',body:'Launch on Thursday',source:root.id})
  const erased=await write(c,'messages','launch',{body:'ERASED EXPORT CANARY',intent:'erase-me'})
  await write(c,'edit',erased.id,{version:1,delete:true})
  for(let n=0;n<43;n++)await write(c,'messages','launch',{body:'History page record '+n,intent:'page-'+n})
  await imported(f)
  let job=await f.json(f.owner,'',{scope:'permitted',custodyAccepted:true})
  job=await f.json(f.owner,`/${job.id}/step`,{})
  const cancelled=await f.json(f.owner,`/${job.id}/cancel`,{});assert.equal(cancelled.pages,job.pages)
  await denied(f.json(f.owner,`/${job.id}/step`,{}),409)
  job=await f.json(f.owner,`/${job.id}/resume`,{});job=await f.finish(f.owner,job)
  const bundle=await f.bundle(f.owner,job),records=bundle.records,find=(type,predicate)=>records.find(r=>r.type===type&&predicate(r.data))
  assert.equal(find('messages',m=>m.id===reply.id).data.parent,root.id)
  assert.equal(records.filter(r=>r.type==='messages').length,47)
  assert.ok(find('messages',m=>m.id===erased.id&&m.deleted&&m.erased))
  assert.ok(find('message_versions',v=>v.message===root.id&&v.body.startsWith('Original body')))
  assert.ok(find('message_versions',v=>v.message===root.id&&v.body.startsWith('Edited body')))
  assert.ok(find('reactions',r=>r.message===root.id&&r.user===member.operatorId))
  assert.deepEqual(records.filter(r=>r.type==='outcome_versions'&&r.data.outcome===commitment.id).sort((a,b)=>a.data.version-b.data.version).map(r=>r.data.status),['proposed','accepted','proposed','accepted'])
  assert.equal(find('imported_messages',m=>m.body==='Imported root').data.reactions[0].name,'custom_party')
  assert.ok(find('imported_messages',m=>m.body==='Imported thread reply'&&m.parent))
  assert.ok(find('source_actors',a=>a.source_id==='U1'))
  assert.ok(find('source_files',f=>f.source_id==='F1'))
  assert.ok(find('events',e=>e.kind==='membership'&&e.direction==='unknown'&&e.at===null))
  assert.ok(find('membership_history',m=>m.action==='join'&&m.user===member.operatorId))
  assert.ok(job.sourceOmissions>=1)
  const json=code.jsonDocument(bundle),lines=code.jsonLines(bundle).trimEnd().split('\n').map(JSON.parse),html=code.offlineHtml(bundle)
  assert.deepEqual(JSON.parse(json).records,bundle.records)
  assert.equal(lines.filter(line=>line.type==='file_bytes').length,bundle.files.length)
  assert.equal(lines.length,1+bundle.records.length+bundle.files.length)
  assert.ok(html.includes('Native reply')&&html.includes('Imported thread reply')&&html.includes('Acceptance and version history'))
  assert.ok(html.includes('&lt;script&gt;unsafe()&lt;/script&gt;'))
  assert.ok(!html.includes('<img src="https://never-fetch.invalid/tracker">'))
  assert.doesNotMatch(json,/ERASED EXPORT CANARY/)
  const embedded=html.match(/<script type="application\/json" id="nook-export">(.*?)<\/script>/s)[1]
  assert.deepEqual(JSON.parse(embedded),bundle)
  for(const file of bundle.files)assert.equal(hash(Buffer.from(file.base64,'base64')),file.sha256)
 }finally{f.close()}
})

test('NOOK-047 member scoped exports refuse ordinary admin/owner DM access, other jobs, revocation and stale completed pages',async()=>{
 const f=await fixture();try{
  const member=await f.person('PrivateExporter'),peer=await f.person('PrivatePeer'),admin=await f.person('OrdinaryAdmin',{role:'admin'})
  await f.person('BackupOwner',{role:'owner'})
  const c=f.context(member),dm=await code.write(c,'conversations','',{name:'Members only DM',kind:'dm',participants:[peer.operatorId]})
  const privateFile=await code.upload(c,dm.id,{name:'private-handoff.txt',mime:'text/plain',bytes:new TextEncoder().encode('Private workspace exact bytes'),intent:'private-file'})
  await code.write(c,'messages',dm.id,{body:'Private scope canary',attachments:[privateFile.id],intent:'dm'})
  await denied(f.json(f.owner,'',{scope:'workspace',custodyAccepted:true}),403)
  const initial=await f.json(f.owner,'/policy');assert.equal(initial.enabled,false)
  await denied(f.json(admin,'/policy',{enabled:true,version:initial.version}),403)
  const enabled=await f.json(f.owner,'/policy',{enabled:true,version:initial.version})
  for(const actor of [f.owner,member,peer,admin]){const policy=await f.json(actor,'/policy');assert.equal(policy.announcement.version,enabled.version);assert.equal(policy.announcement.enabled,1)}
  assert.equal(enabled.actions[0].actor,f.owner.operatorId);assert.equal(enabled.actions[0].version,enabled.version);assert.ok(Number.isFinite(Date.parse(enabled.actions[0].created)))
  await denied(f.json(f.owner,'/policy',{enabled:false,version:initial.version}),409)
  for(const actor of [member,admin])await denied(f.json(actor,'',{scope:'workspace',custodyAccepted:true}),403)
  let workspace=await f.json(f.owner,'',{scope:'workspace',custodyAccepted:true})
  workspace=await f.json(f.owner,`/${workspace.id}/step`,{})
  await f.json(f.owner,`/${workspace.id}/cancel`,{})
  workspace=await f.finish(f.owner,await f.json(f.owner,`/${workspace.id}/resume`,{}))
  const whole=await f.bundle(f.owner,workspace)
  assert.equal(workspace.scope,'workspace');assert.equal(workspace.workspacePolicyVersion,enabled.version)
  assert.deepEqual(whole.records.filter(r=>r.type==='conversations').map(r=>r.data.id).sort(),f.db.prepare('SELECT id FROM nook_conversations ORDER BY id').all().map(r=>r.id))
  assert.ok(whole.records.some(r=>r.type==='messages'&&r.data.body==='Private scope canary'))
  assert.ok(whole.records.some(r=>r.type==='workspace_configuration'&&r.data.export_policy.enabled===1))
  assert.deepEqual(Buffer.from(whole.files.find(file=>file.id===privateFile.id).base64,'base64'),Buffer.from('Private workspace exact bytes'))
  f.db.prepare("UPDATE oa_operators SET role='admin' WHERE id=?").run(f.owner.operatorId)
  const demoted=await f.signIn('owner@example.test')
  for(const path of ['', '/index','/pages/0','/files/'+privateFile.id])await denied(f.door(demoted,'/'+workspace.id+path),403)
  f.db.prepare("UPDATE oa_operators SET role='owner' WHERE id=?").run(f.owner.operatorId)
  f.owner=await f.signIn('owner@example.test')
  await f.json(f.owner,'/policy',{enabled:false,version:enabled.version})
  for(const path of ['', '/index','/pages/0','/files/'+privateFile.id])await denied(f.door(f.owner,'/'+workspace.id+path),403)
  const disabled=await f.json(f.owner,'/policy');await f.json(f.owner,'/policy',{enabled:true,version:disabled.version})
  await denied(f.json(f.owner,'/'+workspace.id+'/resume',{}),403,'a policy change cannot revive an old workspace job')

  const permitted=await f.bundle(f.owner,await f.finish(f.owner,await f.json(f.owner,'',{scope:'permitted',custodyAccepted:true})))
  assert.ok(!permitted.records.some(r=>r.conversation===dm.id))
  for(const actor of [f.owner,admin])await denied(f.json(actor,'',{scope:'conversation',conversationId:dm.id,custodyAccepted:true}),403)
  let job=await f.json(member,'',{scope:'conversation',conversationId:dm.id,custodyAccepted:true});job=await f.finish(member,job)
  await denied(f.json(admin,'/'+job.id),404)
  const page=(await f.json(member,`/${job.id}/index`)).items[0].ordinal
  await code.write(f.context(f.owner),'messages','review',{body:'Unrelated room traffic',intent:'unrelated'})
  assert.ok((await f.json(member,'/'+job.id)).complete,'unrelated scope writes do not invalidate')
  await code.write(c,'messages',dm.id,{body:'Changed selected scope',intent:'changed'})
  await denied(f.door(member,`/${job.id}/pages/${page}`),409)
  const scope=await code.write(f.context(f.owner),'conversations','',{name:'Revocable private room',kind:'private',participants:[member.operatorId]})
  let removable=await f.json(member,'',{scope:'conversation',conversationId:scope.id,custodyAccepted:true});removable=await f.finish(member,removable)
  await code.write(f.context(f.owner),'members',scope.id,{user:member.operatorId,remove:true})
  for(const path of ['','/index','/pages/0'])await denied(f.door(member,'/'+removable.id+path),403)
  await denied(f.json(member,'/'+removable.id+'/resume',{}),403)
  f.db.prepare('UPDATE oa_sessions SET revoked_at=? WHERE id=?').run(Date.now(),member.id)
  await denied(f.json(member),401)
 }finally{f.close()}
})

test('NOOK-047 file corruption blocks completeness; erasure invalidates metadata and byte downloads instead of retaining export snapshots',async()=>{
 const f=await fixture();try{
  const c=f.context(f.owner),attachment=await code.upload(c,'launch',{name:'proof.txt',mime:'text/plain',bytes:new TextEncoder().encode('Expected file bytes'),intent:'file'})
  const message=await code.write(c,'messages','launch',{body:'Erasure-scoped body',attachments:[attachment.id],intent:'file-message'})
  const key=f.db.prepare('SELECT object_key FROM nook_attachments WHERE id=?').get(attachment.id).object_key,original=f.objects.get(key)
  f.objects.set(key,{...original,bytes:new TextEncoder().encode('Corrupted same size')})
  let job=await f.json(f.owner,'',{scope:'conversation',conversationId:'launch',custodyAccepted:true}),failed=false
  for(let n=0;n<100&&!job.complete;n++){
   try{job=await f.json(f.owner,`/${job.id}/step`,{})}catch(error){assert.equal(error.status,503);failed=true;break}
  }
  assert.ok(failed);assert.equal((await f.json(f.owner,'/'+job.id)).complete,false)
  f.objects.set(key,original);job=await f.finish(f.owner,job)
  const page=(await f.json(f.owner,`/${job.id}/index`)).items[0].ordinal
  await code.write(c,'edit',message.id,{version:1,delete:true})
  await denied(f.door(f.owner,`/${job.id}/pages/${page}`),409)
  await denied(f.door(f.owner,`/${job.id}/files/${attachment.id}`),409)
  const fresh=await f.finish(f.owner,await f.json(f.owner,'',{scope:'conversation',conversationId:'launch',custodyAccepted:true}))
  const bundle=await f.bundle(f.owner,fresh)
  assert.doesNotMatch(JSON.stringify(bundle),/Erasure-scoped body|Expected file bytes/)
  assert.equal(bundle.files.length,0)
 }finally{f.close()}
})
