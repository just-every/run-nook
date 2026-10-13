import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createPortability,readArchive} from '../src/base/modules/portability/index.mjs';
import {teamFixture} from './team-sql-support.mjs';
const require=createRequire(import.meta.url),wranglerRequire=createRequire(require.resolve('wrangler'));
const {build}=wranglerRequire('esbuild');
const dir=await mkdtemp(join(tmpdir(),'nook-erasure-'));
const entry="export {discardExpiredFiles} from './src/team/erasure/expired-files.mjs';export {Context} from './src/platform/storage/context';export {erase,advance,receipt,preview,pending} from './src/team/erasure/service';export {send,edit} from './src/platform/storage/messages';export {remove as removeFile,upload} from './src/platform/storage/files';export {teamRoute} from './src/team/routes.server';export {createOutcome,reviseOutcome} from './src/platform/storage/outcomes';export {historyWindow} from './src/platform/storage/history';export {read} from './src/platform/storage/read';export {imports} from './src/platform/storage/imports';export {rebuildSearch} from './src/platform/storage/portability.mjs';export {portabilityPolicy} from './src/platform/portability-policy.mjs';";
async function compiled(name,changes={}){
 const outfile=join(dir,name+'.mjs');
 await build({stdin:{contents:entry,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile,logLevel:'silent',plugins:[{name:'source-policy-choice',setup(builder){builder.onLoad({filter:/team\/erasure\/policy\.ts$/},async({path})=>{let contents=await readFile(path,'utf8');for(const [from,to] of Object.entries(changes))contents=contents.replace(from,to);return {contents,loader:'ts'}})}}]});
 return import(outfile);
}
const standard=await compiled('default'),retaining=await compiled('retain',{"memberMessageBodies = 'erase'":"memberMessageBodies = 'retain'"}),restricted=await compiled('restricted',{'operatorChannelMessageErasure = true':'operatorChannelMessageErasure = false','protectEveryOwnerFromErasure = false':'protectEveryOwnerFromErasure = true'});
const {discardExpiredFiles,Context,erase,advance,receipt,preview,send,edit,removeFile,teamRoute,createOutcome,reviseOutcome,historyWindow,portabilityPolicy}=standard;
after(()=>rm(dir,{recursive:true,force:true}));
async function fixture(options){
 const f=await teamFixture(options),objects=new Map(),removed=[];f.db.exec('PRAGMA foreign_keys=ON');let interrupted=false;
 const env={DB:f.adapter,FILES:{async put(key,bytes){objects.set(key,new Uint8Array(bytes))},async get(key){const bytes=objects.get(key);return bytes?{body:new ReadableStream({start(c){c.enqueue(bytes);c.close()}}),arrayBuffer:async()=>bytes.buffer,size:bytes.length}:null},async head(key){return objects.has(key)?{size:objects.get(key).length}:null},async delete(key){if(interrupted)throw Error('network interruption');objects.delete(key);removed.push(key)},async list(){return {objects:[...objects.keys()].map(key=>({key,size:objects.get(key).length})),truncated:false}}},CHAT_HUB:{idFromName:()=>'',get:()=>({fetch:async()=>new Response()})}};
 const context=session=>new Context(env,session);
 async function person(name,options={}){const accepted=await f.accept(await f.invite(name.toLowerCase()+'@example.test',options));const cookie=accepted.headers.get('set-cookie').split(';')[0];return f.auth.getSession(f.request('/auth/session',null,cookie))}
 return {...f,env,objects,removed,context,person,interrupt:value=>{interrupted=value}};
}
async function finish(c,r){for(let i=0;r.state!=='complete'&&i<30;i++)r=await advance(c,r.id);assert.equal(r.state,'complete');return r}
const rejects=(promise,status)=>assert.rejects(promise,e=>e.status===status);
test('member cascade keeps unrelated history and fixed DM roots, clears canaries and real credentials, fences live keys and leaves anonymous receipts',async()=>{
 const f=await fixture();try{
  const member=await f.person('CANARYPERSON'),c=f.context(member),owner=f.context(f.owner),peer=await f.person('control');
  f.db.prepare("INSERT INTO nook_conversations(id,name,kind,owner) VALUES('dm','CANARYPERSON','dm',?)").run(member.operatorId);f.db.prepare("INSERT INTO nook_members VALUES('dm',?),('dm',?)").run(member.operatorId,peer.operatorId);f.db.prepare("INSERT INTO nook_dm_roster SELECT conversation,user FROM nook_members WHERE conversation='dm'").run();
  const root=await send(c,'dm',{body:'CANARYBODY',intent:'CANARYINTENT'});await send(f.context(peer),'dm',{body:'unrelated reply',intent:'control',parent:root.id});
  await createOutcome(c,'launch',{kind:'decision',body:'CANARYDECISION'});await createOutcome(c,'launch',{kind:'commitment',body:'CANARYCOMMITMENT',assignee:peer.operatorId});
  const assigned=await createOutcome(owner,'launch',{kind:'commitment',body:'Other author work stays accepted',assignee:member.operatorId});await reviseOutcome(c,assigned.id,{action:'accept',version:1});
  const before=await exported(f);
  const r=await finish(owner,await erase(owner,'member',member.operatorId,{confirmation:'ERASE'}));
  assert.equal(r.counts.messages,1);assert.equal(r.counts.outcomes,2);assert.equal(f.db.prepare('SELECT count(*) AS n FROM oa_operators WHERE id=?').get(member.operatorId).n,0);
  const page=await historyWindow(f.context(peer),'dm',{thread:root.id});assert.equal(page.root.deleted,1);assert.equal(page.items[0].body,'unrelated reply');
  assert.equal(scanSql(f,/CANARY/i).length,0);
  const kept=f.db.prepare('SELECT * FROM nook_outcomes WHERE id=?').get(assigned.id);assert.equal(kept.status,'accepted');assert.equal(kept.assignee,null);assert.equal(kept.body,'Other author work stays accepted');
  await assertFenced(f,[['nook_messages',{id:root.id}],['nook_actors',{id:member.operatorId}],['oa_operators',{id:member.operatorId}]]);assert.doesNotMatch(JSON.stringify(r),new RegExp(member.operatorId));
  const latest=await exported(f);assert.doesNotMatch(JSON.stringify(latest),/CANARY/i);
  const fresh=await fixture({bootstrap:false}),virgin=await fixture({bootstrap:false}),withJournal=await fixture({bootstrap:false});try{
   await restored(fresh,latest);assert.equal(fresh.db.prepare('SELECT count(*) AS n FROM nook_erased_actors').get().n,1);
   await assert.rejects(restored(fresh,before),e=>e.code==='erasure_epoch');
   await assert.rejects(restored(withJournal,before,latest[0]),e=>e.code.startsWith('erased_row:'));
   await restored(virgin,before);assert.equal(virgin.db.prepare("SELECT count(*) AS n FROM nook_messages WHERE body='CANARYBODY'").get().n,1);
  }finally{fresh.close();virgin.close();withJournal.close()}
 }finally{f.close()}
});
test('fresh authority, role hierarchy, DM privacy and confirmation hold; R2 interruption stays pending and resume is idempotent',async()=>{
 const f=await fixture();try{
  const member=await f.person('member'),admin=await f.person('admin',{role:'admin'}),admin2=await f.person('admin2',{role:'admin'}),guest=await f.person('guest',{mode:'guest'}),c=f.context(member),owner=f.context(f.owner),a=f.context(admin);
  const hidden=await send(owner,'review',{body:'Private control',intent:'hidden'});await rejects(preview(c,'message',hidden.id),403);
  const m=await send(c,'launch',{body:'attachment owner',intent:'send'}),key='private/attachment',id=crypto.randomUUID();f.objects.set(key,new TextEncoder().encode('CANARYBYTES'));
  f.db.prepare("INSERT INTO nook_attachments(id,conversation,author,message,name,mime,size,expires,state,created,object_key,intent,position) VALUES(?,'launch',?,?, 'CANARYFILE','text/plain',11,0,'attached',?,?,?,0)").run(id,member.operatorId,m.id,new Date().toISOString(),key,'file');
  const changes=f.db.prepare('SELECT total_changes() AS n').get().n;
  const crossed=await teamRoute(owner,new Request('https://fixture.test/api/erasures',{method:'POST',headers:{origin:'https://elsewhere.test'}}),{kind:'member',target:member.operatorId,confirmation:'ERASE'});assert.equal(crossed.status,403);
  await rejects(preview(f.context({...member,id:'unknown-session'}),'member',member.operatorId),401);
  await rejects(erase(c,'member',admin.operatorId,{confirmation:'ERASE'}),403);await rejects(erase(f.context(guest),'member',member.operatorId,{confirmation:'ERASE'}),403);await rejects(erase(a,'member',admin2.operatorId,{confirmation:'ERASE'}),403);await rejects(erase(a,'member',f.owner.operatorId,{confirmation:'ERASE'}),403);await rejects(erase(owner,'member',f.owner.operatorId,{confirmation:'ERASE'}),403);
  await rejects(erase(owner,'member','missing',{confirmation:'ERASE'}),404);await rejects(erase(owner,'member',member.operatorId,{confirmation:'wrong'}),400);
  assert.equal(f.db.prepare('SELECT total_changes() AS n').get().n,changes,'denials make no writes');
  f.db.prepare("INSERT INTO nook_conversations(id,name,kind,owner) VALUES('denied-dm','DM','dm',?)").run(admin.operatorId);f.db.prepare("INSERT INTO nook_members VALUES('denied-dm',?),('denied-dm',?)").run(admin.operatorId,member.operatorId);f.db.prepare("INSERT INTO nook_dm_roster SELECT conversation,user FROM nook_members WHERE conversation='denied-dm'").run();
  const dm=await send(c,'denied-dm',{body:'Private body',intent:'dm'});await rejects(erase(a,'message',dm.id,{confirmation:'ERASE'}),403);
  const ownDeleted=await edit(c,dm.id,{delete:true,version:dm.version});await rejects(send(c,'denied-dm',{body:'Private body',intent:'dm'}),409);assert.equal(ownDeleted.deleted,1);assert.equal(f.db.prepare('SELECT count(*) AS n FROM nook_messages WHERE id=?').get(dm.id).n,0);
  f.interrupt(true);const r=await erase(a,'message',m.id,{confirmation:'ERASE'});assert.equal(r.state,'pending');assert.equal(f.objects.size,1);assert.equal(f.db.prepare('SELECT count(*) AS n FROM nook_messages WHERE id=?').get(m.id).n,0);const unchanged=f.db.prepare('SELECT total_changes() AS n').get().n;assert.equal((await erase(a,'message',m.id,{confirmation:'ERASE'})).id,r.id);assert.equal(f.db.prepare('SELECT total_changes() AS n').get().n,unchanged,'repeating pending erasure changes no rows');
  assert.equal((await receipt(a,r.id)).state,'pending');f.db.prepare('UPDATE oa_sessions SET revoked_at=1 WHERE id=?').run(admin.id);await rejects(advance(a,r.id),401);f.interrupt(false);f.db.prepare('INSERT INTO nook_upload_attempts VALUES(?,?,?)').run('uncertain-put',key,Date.now());assert.equal((await advance(owner,r.id)).state,'pending','an uncertain late put prevents completion');assert.equal(f.objects.size,1);f.db.prepare('DELETE FROM nook_upload_attempts WHERE id=?').run('uncertain-put');assert.equal((await advance(owner,r.id)).state,'complete');assert.equal(f.objects.size,0);assert.equal((await advance(owner,r.id)).state,'complete');assert.equal(f.removed.length,1);await assertFenced(f,[['nook_messages',{id:m.id}],['nook_messages',{id:dm.id}],['nook_attachments',{id}]]);
  const staged=crypto.randomUUID();f.db.prepare("INSERT INTO nook_attachments(id,conversation,author,message,name,mime,size,expires,state,created,object_key,intent) VALUES(?,'launch',?,NULL,'staged.txt','text/plain',1,?,'staged',?,NULL,'staged-removal')").run(staged,member.operatorId,Date.now()+60000,new Date().toISOString());assert.equal((await removeFile(c,staged)).receipt.state,'complete');await assertFenced(f,[['nook_attachments',{id:staged}]]);
  const expired=crypto.randomUUID();f.db.prepare("INSERT INTO nook_attachments(id,conversation,author,message,name,mime,size,expires,state,created,object_key,intent) VALUES(?,'launch',?,NULL,'expired.txt','text/plain',1,0,'staged',?,NULL,'expired-removal')").run(expired,member.operatorId,new Date().toISOString());await discardExpiredFiles(f.env);assert.equal(f.db.prepare('SELECT count(*) AS n FROM nook_attachments WHERE id=?').get(expired).n,0);await assertFenced(f,[['nook_attachments',{id:expired}]]);
  f.db.prepare('UPDATE oa_sessions SET revoked_at=1 WHERE id=?').run(admin.id);await rejects(preview(a,'member',member.operatorId),401);
 }finally{f.close()}
});

async function assertFenced(f,entities){
 const service=await createPortability({db:f.adapter,buckets:{FILES:f.env?.FILES??f.bucket},policy:portabilityPolicy}),before=f.db.prepare('SELECT count(*) AS n FROM rer_portability_journal').get().n;
 // Reapplying the public tombstone statements must add no missing key. Roll back
 // their epoch writes so this assertion cannot create the proof it checks.
 f.db.exec('SAVEPOINT fence_check');try{for(const [table,key] of entities)for(const statement of await service.erasureStatements(table,key))await statement.run();assert.equal(f.db.prepare('SELECT count(*) AS n FROM rer_portability_journal').get().n,before,'every erased live key already has its public fence')}finally{f.db.exec('ROLLBACK TO fence_check');f.db.exec('RELEASE fence_check')}
}
async function exported(f,bucket=f.env.FILES){
 const service=await createPortability({db:f.adapter,buckets:{FILES:bucket},policy:portabilityPolicy}),id=await service.exports.create();
 try{while((await service.exports.advance(id,{maxParts:16})).phase==='building'){}const records=[];for await(const r of readArchive(await service.exports.download(id)))records.push(r);return records}finally{await service.exports.abort(id)}
}
async function restored(f,records,laterJournal,bucket=f.env.FILES){
 const service=await createPortability({db:f.adapter,buckets:{FILES:bucket},policy:portabilityPolicy}),id=await service.imports.create(records[0]);let complete=false;
 try{for(const r of records)if(r.kind==='part')await service.imports.uploadPart(id,r.index,r);await service.imports.finalize(id,{contentHash:records.at(-1).contentHash,archiveHash:records.at(-1).archiveHash,laterJournal});complete=true}finally{if(!complete)await service.imports.abort(id)}
}

test('the source-author door composes real import-kit custody, keeps unrelated threads, and restores a latest archive',async()=>{
 const {slackServiceFixture,testBucket}=await import('./slack-import/sqlite-service.mjs'),{zipFixture}=await import('./slack-import/fixture.mjs');
 const f=await slackServiceFixture();f.db.exec('PRAGMA foreign_keys=ON');try{
  const acceptedOwner=await f.accept(await f.invite('handoff@example.test',{role:'owner'})),handoff=await f.auth.getSession(f.request('/auth/session',null,acceptedOwner.headers.get('set-cookie').split(';')[0]));
  const bytes='SOURCECANARYBYTES',zip=zipFixture([
   ['users.json',[{id:'U1',name:'SOURCECANARYNAME',profile:{email:'sourcecanary@example.test'}},{id:'U2',name:'Other author'}]],
   ['channels.json',[{id:'C1',name:'general'}]],
   ['general/2024-01-01.json',[{type:'message',user:'U1',text:'SOURCECANARYBODY',ts:'1700000000.000001',files:[{id:'F1',name:'SOURCECANARYFILE.txt',mimetype:'text/plain',size:bytes.length}]},{type:'message',user:'U2',text:'Unrelated imported reply',ts:'1700000000.000002',thread_ts:'1700000000.000001'}]],
   ['files/F1/SOURCECANARYFILE.txt',bytes]
  ]);
  const upload=await f.custody.localUpload(f.c,new Request('https://fixture.test/upload',{method:'POST',body:zip}));
  const review={namespace:'source-erasure-fixture',channels:[{sourceId:'C1',name:'Imported source',members:[f.owner.operatorId,handoff.operatorId]}],actors:{U1:null,U2:null},acceptedOmissions:[]};
  const plan=await f.service.previewImport(f.c,{upload,review});await f.finish(plan);
  const c=new Context({...f.c.env,CHAT_HUB:{idFromName:()=>'',get:()=>({fetch:async()=>new Response()})}},handoff),target=f.db.prepare("SELECT job||':'||source_id AS id FROM nook_import_actors WHERE source_id='U1'").get().id;
  const before=await exported(f,f.bucket);assert.match(JSON.stringify(before),/SOURCECANARY/);
  await finishDoor(standard,c,await door(standard,c,'',{kind:'member',target:f.owner.operatorId,confirmation:'ERASE'}));assert.equal(f.db.prepare('SELECT count(*) AS n FROM oa_operators WHERE id=?').get(f.owner.operatorId).n,0);
  await finishDoor(standard,c,await door(standard,c,'',{kind:'imported-author',target,confirmation:'ERASE'}));
  assert.equal(scanSql(f,/SOURCECANARY/i).length,0);const [job,source_id]=target.split(':');await assertFenced(f,[['nook_import_actors',{job,source_id}]]);
  for(const object of (await f.bucket.list()).objects)assert.doesNotMatch(Buffer.from(await(await f.bucket.get(object.key)).arrayBuffer()).toString(),/SOURCECANARY/i);
  assert.equal(f.db.prepare('SELECT body FROM nook_import_records').get().body,'Unrelated imported reply');
  // Import custody keeps tombstones, journals the erasure without its values,
  // and its redaction checkpoint refuses the whole older archive.
  const journal=f.db.prepare('SELECT * FROM ik_d1_erasure_journal').all();assert.ok(journal.length>0&&journal.some(row=>row.records_erased>0));assert.doesNotMatch(JSON.stringify(journal),/SOURCECANARY/i);
  const latest=await exported(f,f.bucket),fresh=await fixture({bootstrap:false}),stale=await fixture({bootstrap:false});try{await restored(fresh,latest,undefined,testBucket());assert.equal(fresh.db.prepare('SELECT count(*) AS n FROM nook_erased_import_messages').get().n,1);assert.equal(fresh.db.prepare('SELECT count(*) AS n FROM ik_d1_erasure_journal').get().n,journal.length);await assert.rejects(restored(stale,before,latest[0],testBucket()),e=>e.code==='erasure_epoch');assert.equal(stale.db.prepare('SELECT count(*) AS n FROM ik_jobs').get().n,0)}finally{fresh.close();stale.close()}
  // The original reviewed intent cannot apply erased records again.
  await assert.rejects(f.service.applyReviewed(f.c,plan.review,plan.fingerprint));
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM nook_import_records').get().n,1);
 }finally{f.close()}
 await sharedUploadErasure();
});

async function sharedUploadErasure(){
 const {slackServiceFixture}=await import('./slack-import/sqlite-service.mjs'),{zipFixture}=await import('./slack-import/fixture.mjs');
 const f=await slackServiceFixture();f.db.exec('PRAGMA foreign_keys=ON');try{
  const selected='SOURCECANARYBYTES',survivor='Unrelated imported file',protectedBytes='Protected sibling file';
  const zip=zipFixture([
   ['users.json',[{id:'U1',name:'SOURCECANARYNAME',profile:{email:'sourcecanary@example.test'}},{id:'U2',name:'Other author'}]],
   ['channels.json',[{id:'C1',name:'general'},{id:'C2',name:'other'}]],
   ['general/2024-01-01.json',[{type:'message',user:'U1',text:'SOURCECANARYBODY',ts:'1700000000.000001',files:[{id:'F1',name:'SOURCECANARYFILE.txt',mimetype:'text/plain',size:selected.length}]},{type:'message',user:'U2',text:'Unrelated imported reply',ts:'1700000000.000002',thread_ts:'1700000000.000001',files:[{id:'F2',name:'survivor.txt',mimetype:'text/plain',size:survivor.length}]}]],
   ['other/2024-01-01.json',[{type:'message',user:'U2',text:'Protected sibling history',ts:'1700000000.000003',files:[{id:'F3',name:'protected.txt',mimetype:'text/plain',size:protectedBytes.length}]}]],
   ['files/F1/SOURCECANARYFILE.txt',selected],['files/F2/survivor.txt',survivor],['files/F3/protected.txt',protectedBytes]
  ]);
  const upload=await f.custody.localUpload(f.c,new Request('https://fixture.test/upload',{method:'POST',body:zip}));
  async function approve(namespace,sourceId='C1'){
   const review={namespace,channels:[{sourceId,name:namespace,members:[f.owner.operatorId]}],actors:{U1:null,U2:null},acceptedOmissions:[]};
   const omitted=await f.service.previewImport(f.c,{upload,review});review.acceptedOmissions=[omitted.omissionDigest];
   return f.service.previewImport(f.c,{upload,review});
  }
  const primary=await approve('shared-primary'),staged=await approve('shared-staged'),unused=await approve('shared-preview'),lost=await approve('shared-lost-ack','C2'),applied=await approve('shared-applied','C2');
  async function interruptApply(plan,marker){
   const original=f.adapter.batch;let fired=false;
   f.adapter.batch=async statements=>{if(!fired&&statements.some(s=>s.sql?.includes(marker))){fired=true;throw Error('fixture interrupted shared upload')}return original(statements)};
   try{await assert.rejects(f.service.applyReviewed(f.c,plan.review,plan.fingerprint),/fixture interrupted shared upload/)}finally{f.adapter.batch=original}
   assert.equal(fired,true);
  }
  await interruptApply(staged,'INSERT INTO ik_jobs');
  await interruptApply(lost,'UPDATE nook_import_reviews SET kit_job');
  await f.finish(applied);await f.finish(primary);
  const reviewRow=plan=>f.db.prepare('SELECT * FROM nook_import_reviews WHERE id=?').get(plan.review),stagedRow=reviewRow(staged),primaryRow=reviewRow(primary);
  const stagedKeys=f.db.prepare('SELECT object_key FROM nook_import_objects WHERE instr(object_key,?)>0').all('/files/'+stagedRow.domain_job+'/'+staged.review+'/').map(r=>r.object_key);
  assert.equal(stagedKeys.length,2);assert.equal(f.db.prepare('SELECT count(*) AS n FROM ik_jobs WHERE operation_key=?').get(staged.review).n,0);assert.equal(f.db.prepare('SELECT state FROM nook_imports WHERE id=?').get(stagedRow.domain_job).state,'staging');
  const protectedRows=[lost,applied].map(plan=>({review:reviewRow(plan),job:f.db.prepare('SELECT * FROM ik_jobs WHERE operation_key=?').get(plan.review)}));
  const protectedFiles=f.db.prepare('SELECT * FROM nook_import_objects WHERE upload=? AND object_key NOT IN (SELECT object_key FROM nook_import_objects WHERE instr(object_key,?)>0 OR instr(object_key,?)>0)').all(upload,'/files/'+stagedRow.domain_job+'/', '/files/'+primaryRow.domain_job+'/');
  assert.equal(protectedFiles.length,2);assert.equal(protectedRows[0].review.kit_job,null);assert.ok(protectedRows[0].job);
  const survivorKey=f.db.prepare("SELECT a.object_key FROM nook_attachments a JOIN nook_import_records r ON r.id=a.message WHERE r.job=? AND r.source_actor='U2'").get(primaryRow.domain_job).object_key;
  const remove=f.bucket.delete.bind(f.bucket);let interrupted=true;f.bucket.delete=async key=>{if(interrupted&&stagedKeys.includes(key))throw Error('interrupted sibling R2 delete');return remove(key)};
  const c=new Context(f.c.env,f.owner),target=primaryRow.domain_job+':U1';
  let receipt=await door(standard,c,'',{kind:'imported-author',target,confirmation:'ERASE'});
  for(let n=0;n<6;n++)receipt=await door(standard,c,'/'+receipt.id+'/resume',{});
  assert.equal(receipt.state,'pending','staged sibling bytes keep the erasure pending');
  assert.equal(reviewRow(staged).state,'discarded');assert.equal(reviewRow(unused).state,'discarded');assert.equal(f.db.prepare('SELECT count(*) AS n FROM nook_imports WHERE id=?').get(stagedRow.domain_job).n,0);
  for(const key of stagedKeys){assert.equal(f.db.prepare('SELECT state FROM nook_import_objects WHERE object_key=?').get(key).state,'deleted');assert.ok(f.db.prepare('SELECT 1 FROM nook_erasure_blobs WHERE operation=? AND object_key=?').get(receipt.id,key));assert.ok(await f.bucket.head(key))}
  for(const before of protectedRows){assert.deepEqual(f.db.prepare('SELECT * FROM ik_jobs WHERE id=?').get(before.job.id),before.job);assert.deepEqual(f.db.prepare('SELECT * FROM nook_import_reviews WHERE id=?').get(before.review.id),before.review);assert.ok(f.db.prepare('SELECT 1 FROM nook_imports WHERE id=?').get(before.review.domain_job))}
  for(const object of protectedFiles){assert.deepEqual(f.db.prepare('SELECT * FROM nook_import_objects WHERE object_key=?').get(object.object_key),object);assert.equal(Buffer.from(await(await f.bucket.get(object.object_key)).arrayBuffer()).toString(),protectedBytes)}
  assert.equal(Buffer.from(await(await f.bucket.get(survivorKey)).arrayBuffer()).toString(),survivor);
  interrupted=false;await finishDoor(standard,c,receipt);
  for(const key of stagedKeys)assert.equal(await f.bucket.head(key),null);
  assert.deepEqual(scanSql(f,/SOURCECANARY/i),[]);for(const object of (await f.bucket.list()).objects)assert.doesNotMatch(Buffer.from(await(await f.bucket.get(object.key)).arrayBuffer()).toString(),/SOURCECANARY/i);
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM nook_erasure_blobs WHERE operation=?').get(receipt.id).n,0);
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM nook_import_records WHERE job=?').get(primaryRow.domain_job).n,1);
  assert.equal(f.db.prepare('SELECT body FROM nook_import_records WHERE job=?').get(reviewRow(applied).domain_job).body,'Protected sibling history');
  assert.ok((await f.service.importStatus(f.c,lost.review)).job);
  for(const plan of [staged,unused])await assert.rejects(f.service.applyReviewed(f.c,plan.review,plan.fingerprint));
  const visible=await f.list.listImports(f.c);
  for(const plan of [lost,applied]){const status=visible.jobs.find(job=>job.review===plan.review);assert.equal(status.forwardAuthority,true);assert.equal(status.reversalSafe,true)}
  let continued=await f.service.resumeReviewed(f.c,lost.review);for(let n=0;continued.job.state!=='completed'&&n<10;n++)continued=await f.service.resumeReviewed(f.c,lost.review);
  assert.equal(continued.job.state,'completed');assert.equal(continued.job.fingerprint,protectedRows[0].job.fingerprint);
  assert.equal(f.db.prepare('SELECT body FROM nook_import_records WHERE job=?').get(reviewRow(lost).domain_job).body,'Protected sibling history');
  assert.equal((await f.service.importStatus(f.c,applied.review)).reversalSafe,true);
  assert.equal((await f.service.undoReviewed(f.c,applied.review)).job.state,'undone');
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM nook_import_channels WHERE job=?').get(reviewRow(applied).domain_job).n,0);
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM nook_import_records WHERE job=?').get(reviewRow(applied).domain_job).n,0);
  const lostFile=protectedFiles.find(object=>object.object_key.includes('/files/'+reviewRow(lost).domain_job+'/'));
  assert.equal(Buffer.from(await(await f.bucket.get(lostFile.object_key)).arrayBuffer()).toString(),protectedBytes);
  for(const plan of [staged,unused]){await assert.rejects(f.service.resumeReviewed(f.c,plan.review));await assert.rejects(f.service.undoReviewed(f.c,plan.review))}
 }finally{f.close()}
}

function scanSql(f,pattern){
 const hits=[];function has(value){if(value instanceof Uint8Array)return pattern.test(Buffer.from(value).toString('utf8'));if(typeof value==='string'){if(pattern.test(value))return true;try{const parsed=JSON.parse(value);if(parsed!==value&&has(parsed))return true}catch{}if(value.length>=8&&/^[A-Za-z0-9+/]+={0,2}$/.test(value)&&pattern.test(Buffer.from(value,'base64').toString('utf8')))return true;return false}return value&&typeof value==='object'&&Object.values(value).some(has)}
 for(const {name} of f.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all())for(const row of f.db.prepare('SELECT * FROM "'+name+'"').all())if(has(row))hits.push(name);return hits;
}

async function door(module,c,path,input){
 const response=await module.teamRoute(c,new Request('https://fixture.test/api/erasures'+path,{method:input?'POST':'GET',headers:{origin:'https://fixture.test'}}),input??{});
 assert.equal(response.status,200);return response.json();
}
async function finishDoor(module,c,r){for(let n=0;r.state!=='complete'&&n<80;n++)r=await door(module,c,'/'+r.id+'/resume',{});assert.equal(r.state,'complete');return r}

test('retained source policy preserves only current bodies through public erasure, ACL reads and latest archive; later operator erasure fences retained content',async()=>{
 const f=await fixture();try{
  const member=await f.person('RetiredPerson'),peer=await f.person('reader'),owner=f.context(f.owner),c=f.context(member),reader=f.context(peer);
  f.db.prepare("INSERT INTO nook_conversations(id,name,kind,owner) VALUES('retained-dm','Private','dm',?)").run(member.operatorId);f.db.prepare("INSERT INTO nook_members VALUES('retained-dm',?),('retained-dm',?)").run(member.operatorId,peer.operatorId);f.db.prepare("INSERT INTO nook_dm_roster SELECT conversation,user FROM nook_members WHERE conversation='retained-dm'").run();
  const file=await standard.upload(c,'launch',{name:'PRIVATEFILENAME.txt',mime:'text/plain',bytes:new TextEncoder().encode('PRIVATEFILEBYTES'),intent:'private-file'});
  let channel=await send(c,'launch',{body:'OLDREVISIONONLY',intent:'retained-channel',attachments:[file.id]});channel=await edit(c,channel.id,{body:'Visible RetiredPerson current body',version:channel.version});
  const dmFile=await standard.upload(c,'retained-dm',{name:'PRIVATEFILEDM.txt',mime:'text/plain',bytes:new TextEncoder().encode('PRIVATEFILEDM'),intent:'dm-file'});
  const dm=await send(c,'retained-dm',{body:'Visible private current body',intent:'retained-dm',attachments:[dmFile.id]});await send(reader,'retained-dm',{body:'Surviving reply',parent:dm.id,intent:'reply'});
  await createOutcome(c,'launch',{kind:'decision',body:'PRIVATEOUTCOMETEXT'});
  const before=await exported(f),accepted=await door(retaining,owner,'',{kind:'member',target:member.operatorId,confirmation:'ERASE'});
  assert.equal(f.db.prepare('SELECT member_bodies FROM nook_erasure_work WHERE operation=?').get(accepted.id).member_bodies,'retain');
  // A rebuilt strict source continues the explicit policy accepted by this work.
  assert.equal((await door(standard,owner,'')).find(r=>r.id===accepted.id).memberMessageBodies,'retain');assert.equal((await door(standard,owner,'/preview',{kind:'member',target:member.operatorId})).memberMessageBodies,'retain');
  await finishDoor(standard,owner,accepted);assert.equal((await door(standard,owner,'/'+accepted.id)).memberMessageBodies,'retain');
  await rejects(standard.read(c,'message',channel.id),401);
  for(const id of [channel.id,dm.id]){const m=await standard.read(reader,'message',id);assert.notEqual(m.authorName,member.operator.displayName);assert.equal(m.deleted,0);assert.equal(m.immutable,true)}
  await rejects(standard.read(owner,'message',dm.id),404);
  const thread=await standard.read(reader,'historyWindow','retained-dm',{thread:dm.id});assert.equal(thread.root.body,'Visible private current body');assert.equal(thread.items[0].body,'Surviving reply');
  const found=await standard.read(reader,'search','',{q:'Visible'});assert.equal(found.items.length,2);assert.ok(found.items.every(x=>x.authorName!==member.operator.displayName&&x.immutable));
  assert.equal((await standard.read(owner,'search','',{q:'private current'})).items.length,0);
  assert.equal(f.objects.size,0);assert.equal(scanSql(f,/OLDREVISIONONLY|PRIVATEFILE|PRIVATEOUTCOME/).length,0);
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM nook_messages WHERE author=?').get(member.operatorId).n,0);
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM nook_revisions WHERE message=?').get(channel.id).n,0);
  await send(reader,'launch',{body:'Visible new current body',intent:'after-retention'});assert.equal((await standard.read(reader,'search','',{q:'Visible'})).items.length,3,'new sends cannot replace retained search entries');
  const latest=await exported(f),fresh=await fixture({bootstrap:false}),old=await fixture({bootstrap:false});try{
   await restored(fresh,latest);await standard.rebuildSearch(fresh.adapter);assert.equal(fresh.db.prepare('SELECT body FROM nook_message_history WHERE id=?').get(channel.id).body,'Visible RetiredPerson current body');assert.equal(fresh.db.prepare('SELECT count(*) AS n FROM nook_retained_message_bodies').get().n,2);
   await assert.rejects(restored(old,before,latest[0]),e=>e.code.startsWith('erased_row:'));
  }finally{fresh.close();old.close()}
  await finishDoor(standard,owner,await door(standard,owner,'',{kind:'message',target:channel.id,confirmation:'ERASE'}));
  assert.equal((await standard.read(reader,'message',channel.id)).deleted,1);assert.equal((await standard.read(reader,'search','',{q:'RetiredPerson'})).items.length,0);
  await assertFenced(f,[['nook_retained_message_bodies',{id:channel.id}]]);assert.equal(scanSql(f,/RetiredPerson/).length,0);
  const newer=await exported(f),empty=await fixture({bootstrap:false});try{await assert.rejects(restored(empty,latest,newer[0]),e=>e.code.startsWith('erased_row:'))}finally{empty.close()}
 }finally{f.close()}
});

test('restricted source policy denies new operator doors and owner targets, preserves author deletion, and explicitly resumes recorded irreversible authority',async()=>{
 const f=await fixture();try{
  const member=await f.person('restrictedmember'),second=await f.person('secondowner',{role:'owner'}),owner=f.context(f.owner),c=f.context(member);
  const message=await send(c,'launch',{body:'Owned message',intent:'restricted'});
  await rejects(door(restricted,owner,'',{kind:'message',target:message.id,confirmation:'ERASE'}),403);
  await rejects(door(restricted,owner,'/preview',{kind:'member',target:second.operatorId}),403);
  await rejects(door(restricted,owner,'',{kind:'member',target:second.operatorId,confirmation:'ERASE'}),403);
  assert.equal((await restricted.edit(c,message.id,{delete:true,version:message.version})).deleted,1);
  const staged=await standard.upload(c,'launch',{name:'staged.txt',mime:'text/plain',bytes:new Uint8Array([65]),intent:'restricted-file'});assert.equal((await restricted.removeFile(c,staged.id)).receipt.state,'complete');
  const next=await send(c,'launch',{body:'Pending operator erasure',intent:'pending'}),key='private/pending';f.objects.set(key,new Uint8Array([65]));f.db.prepare("INSERT INTO nook_attachments(id,conversation,author,message,name,mime,size,expires,state,created,object_key,intent,position) VALUES(?,'launch',?,?,'pending.txt','text/plain',1,0,'attached',?,?,'pending-file',0)").run(crypto.randomUUID(),member.operatorId,next.id,new Date().toISOString(),key);
  f.interrupt(true);const pending=await door(standard,owner,'',{kind:'message',target:next.id,confirmation:'ERASE'});assert.equal(f.db.prepare('SELECT authority_class FROM nook_erasure_work WHERE operation=?').get(pending.id).authority_class,'channel-operator');assert.equal((await door(restricted,owner,'')).length,1);
  f.interrupt(false);await finishDoor(restricted,owner,pending);
  assert.equal((await f.call('/auth/step-up',{action:'owner:transfer'},f.ownerCookie)).status,202);assert.equal((await f.call('/auth/confirm',{token:f.token()},f.ownerCookie)).status,303);
  const demote=await f.call('/auth/operator/role',{operatorId:second.operatorId,role:'member'},f.ownerCookie);assert.equal(demote.status,200);
  await finishDoor(restricted,owner,await door(restricted,owner,'',{kind:'member',target:second.operatorId,confirmation:'ERASE'}));
  await finishDoor(restricted,owner,await door(restricted,owner,'',{kind:'member',target:member.operatorId,confirmation:'ERASE'}));
 }finally{f.close()}
});

test('associated import retention withdraws real kit source custody, preserves visible thread bodies, restores, and permits explicit channel body erasure',async()=>{
 const {slackServiceFixture,testBucket}=await import('./slack-import/sqlite-service.mjs'),{zipFixture}=await import('./slack-import/fixture.mjs');
 const f=await slackServiceFixture();f.db.exec('PRAGMA foreign_keys=ON');try{
  const response=await f.accept(await f.invite('associated@example.test')),member=await f.auth.getSession(f.request('/auth/session',null,response.headers.get('set-cookie').split(';')[0]));
  const bytes='IMPORTFILESECRET',zip=zipFixture([['users.json',[{id:'U1',name:'PROFILESECRET',profile:{email:'profile-secret@example.test'}},{id:'U2',name:'Other author'}]],['channels.json',[{id:'C1',name:'general'}]],['general/2024-01-01.json',[{type:'message',user:'U1',text:'Retained associated body names are allowed',ts:'1700000000.000001',files:[{id:'F1',name:'IMPORTFILESECRET.txt',mimetype:'text/plain',size:bytes.length}]},{type:'message',user:'U2',text:'Other author reply',ts:'1700000000.000002',thread_ts:'1700000000.000001'}]],['files/F1/IMPORTFILESECRET.txt',bytes]]);
  const upload=await f.custody.localUpload(f.c,new Request('https://fixture.test/upload',{method:'POST',body:zip}));
  const plan=await f.service.previewImport(f.c,{upload,review:{namespace:'retained-import',channels:[{sourceId:'C1',name:'Imported retained',members:[f.owner.operatorId,member.operatorId]}],actors:{U1:member.operatorId,U2:null},acceptedOmissions:[]}});await f.finish(plan);
  const c=new Context({...f.c.env,CHAT_HUB:{idFromName:()=>'',get:()=>({fetch:async()=>new Response()})}},f.owner),record=f.db.prepare("SELECT * FROM nook_import_records WHERE source_actor='U1'").get(),before=await exported(f,f.bucket);
  await rejects(door(restricted,c,'',{kind:'imported-message',target:record.id,confirmation:'ERASE'}),403);
  await finishDoor(retaining,c,await door(retaining,c,'',{kind:'member',target:member.operatorId,confirmation:'ERASE'}));
  const m=await standard.read(c,'message',record.id);assert.equal(m.body,record.body);assert.notEqual(m.authorName,member.operator.displayName);assert.equal(m.provenance,undefined);assert.deepEqual(m.attachments,[]);
  const thread=await standard.read(c,'historyWindow',record.conversation,{thread:record.id});assert.equal(thread.root.body,record.body);assert.equal(thread.items[0].body,'Other author reply');
  assert.equal((await standard.read(c,'search','',{q:'associated body'})).items[0].retainedSource,'imported');assert.equal((await standard.imports(c,'search','',{q:'associated body'})).items[0].body,record.body);
  assert.equal((await standard.imports(c,'history',record.conversation)).records[0].body,record.body);
  assert.equal(scanSql(f,/PROFILESECRET|profile-secret|IMPORTFILESECRET/).length,0);
  for(const object of (await f.bucket.list()).objects)assert.doesNotMatch(Buffer.from(await(await f.bucket.get(object.key)).arrayBuffer()).toString(),/PROFILESECRET|IMPORTFILESECRET|Retained associated/);
  await assert.rejects(f.service.applyReviewed(f.c,plan.review,plan.fingerprint));
  await assertFenced(f,[['nook_import_records',{id:record.id}],['nook_import_actors',{job:record.job,source_id:'U1'}]]);
  const latest=await exported(f,f.bucket),fresh=await fixture({bootstrap:false}),stale=await fixture({bootstrap:false});try{await restored(fresh,latest,undefined,testBucket());await standard.rebuildSearch(fresh.adapter);assert.equal(fresh.db.prepare('SELECT body FROM nook_import_history WHERE id=?').get(record.id).body,record.body);await assert.rejects(restored(stale,before,latest[0],testBucket()),e=>e.code==='erasure_epoch')}finally{fresh.close();stale.close()}
  await finishDoor(standard,c,await door(standard,c,'',{kind:'imported-message',target:record.id,confirmation:'ERASE'}));assert.equal((await standard.read(c,'message',record.id)).deleted,1);assert.equal((await standard.read(c,'search','',{q:'associated body'})).items.length,0);await assertFenced(f,[['nook_retained_import_bodies',{id:record.id}]]);
 }finally{f.close()}
});

test('member receipt inherits already pending author deletion and expired-file obligations before identity disappears',async()=>{
 const f=await fixture();try{
  const member=await f.person('pendingauthor'),c=f.context(member),owner=f.context(f.owner);
  const file=await standard.upload(c,'launch',{name:'previous.txt',mime:'text/plain',bytes:new TextEncoder().encode('PREVIOUSDELETEBYTES'),intent:'previous-file'}),message=await send(c,'launch',{body:'previous deletion',intent:'previous-message',attachments:[file.id]});
  f.interrupt(true);const prior=await edit(c,message.id,{delete:true,version:message.version});assert.equal(prior.receipt.state,'pending');
  const expired=await standard.upload(c,'launch',{name:'expired.txt',mime:'text/plain',bytes:new TextEncoder().encode('EXPIREDBYTES'),intent:'expire-first'});f.db.prepare('UPDATE nook_attachments SET expires=0 WHERE id=?').run(expired.id);await discardExpiredFiles(f.env);
  const other=await f.person('legacyexpiry'),legacy=await standard.upload(f.context(other),'launch',{name:'legacy.txt',mime:'text/plain',bytes:new TextEncoder().encode('LEGACYEXPIREDBYTES'),intent:'legacy-expiry'}),legacyKey=f.db.prepare('SELECT object_key FROM nook_attachments WHERE id=?').get(legacy.id).object_key;f.db.prepare('UPDATE nook_attachments SET expires=0 WHERE id=?').run(legacy.id);await discardExpiredFiles(f.env);f.db.prepare('UPDATE nook_object_deletes SET erasure_author=NULL WHERE object_key=?').run(legacyKey);
  let memberReceipt=await door(standard,owner,'',{kind:'member',target:member.operatorId,confirmation:'ERASE'});for(let n=0;n<4;n++)memberReceipt=await door(standard,owner,'/'+memberReceipt.id+'/resume',{});
  assert.equal(memberReceipt.state,'pending','member completion cannot precede previously queued authored blob absence');assert.equal(f.objects.size,3);assert.equal(f.db.prepare('SELECT count(*) AS n FROM oa_operators WHERE id=?').get(member.operatorId).n,0);assert.equal(f.db.prepare('SELECT count(*) AS n FROM oa_operators WHERE id=?').get(other.operatorId).n,1);
  f.interrupt(false);await finishDoor(standard,owner,memberReceipt);assert.equal(f.objects.size,0);assert.equal((await receipt(owner,prior.receipt.id)).state,'complete');assert.equal(f.db.prepare('SELECT count(*) AS n FROM nook_erasure_work').get().n,0);assert.equal(f.db.prepare('SELECT count(*) AS n FROM nook_erasure_blobs').get().n,0);
 }finally{f.close()}
});

async function partialImportFixture({associated=false,total=300}={}){
 const {slackServiceFixture}=await import('./slack-import/sqlite-service.mjs'),{zipFixture}=await import('./slack-import/fixture.mjs');
 const f=await slackServiceFixture();f.db.exec('PRAGMA foreign_keys=ON');
 const accepted=await f.accept(await f.invite('partialperson@example.test')),member=await f.auth.getSession(f.request('/auth/session',null,accepted.headers.get('set-cookie').split(';')[0]));
 const bytes='UNAPPLIEDFILEBYTES',messages=Array.from({length:total},(_,i)=>({type:'message',user:i%2?'U2':'U1',text:i%2?'Other author <@U1> '+i:'UNAPPLIEDBODY '+i,ts:`1700000000.${String(i+1).padStart(6,'0')}`,...(i===total-2?{files:[{id:'F1',name:'UNAPPLIEDFILE.txt',mimetype:'text/plain',size:bytes.length}]}:{})}));
 const zip=zipFixture([['users.json',[{id:'U1',name:'Identical display name',profile:{email:'partialcanary@example.test'}},{id:'U2',name:'Identical display name',profile:{email:'survivor@example.test'}}]],['channels.json',[{id:'C1',name:'general'}]],['general/2024-01-01.json',messages],['files/F1/UNAPPLIEDFILE.txt',bytes]]);
 const upload=await f.custody.localUpload(f.c,new Request('https://fixture.test/upload',{method:'POST',body:zip})),plan=await f.service.previewImport(f.c,{upload,review:{namespace:'partial-erasure',channels:[{sourceId:'C1',name:'Partial history',members:associated?[f.owner.operatorId,member.operatorId]:[f.owner.operatorId]}],actors:{U1:associated?member.operatorId:null,U2:null},acceptedOmissions:[]}});
 const c=new Context(f.c.env,f.owner);
 return {...f,member,plan,upload,doorContext:c};
}

async function assertNoImportPerson(f){
 assert.deepEqual(scanSql(f,/UNAPPLIEDBODY|UNAPPLIEDFILE|partialcanary/i),[]);
 for(const object of (await f.bucket.list()).objects)assert.doesNotMatch(Buffer.from(await(await f.bucket.get(object.key)).arrayBuffer()).toString(),/UNAPPLIEDBODY|UNAPPLIEDFILE|partialcanary/i);
}

test('partial source erasure tombstones every planned own entry, drains staged files, resumes peers and permits guarded undo',async()=>{
 for(const associated of [false,true]){
 const f=await partialImportFixture({associated});try{
  const first=await f.service.applyReviewed(f.c,f.plan.review,f.plan.fingerprint);assert.ok(first.job.checkpoint>3&&first.job.checkpoint<first.job.total);
  const target=f.db.prepare("SELECT job||':'||source_id AS id FROM nook_import_actors WHERE source_id='U1'").get().id;
  const remove=f.bucket.delete.bind(f.bucket);let interrupted=true;f.bucket.delete=async key=>{if(interrupted)throw Error('interrupted R2 delete');return remove(key)};
  let receipt=await door(associated?retaining:standard,f.doorContext,'',{kind:associated?'member':'imported-author',target:associated?f.member.operatorId:target,confirmation:'ERASE'});
  for(let n=0;n<45;n++)receipt=await door(standard,f.doorContext,'/'+receipt.id+'/resume',{});
  assert.equal(receipt.state,'pending');assert.ok((await f.bucket.list()).objects.length>0);
  interrupted=false;await finishDoor(standard,f.doorContext,receipt);await assertNoImportPerson(f);assert.equal(f.db.prepare('SELECT count(*) AS n FROM nook_retained_import_bodies').get().n,0);
  assert.equal(f.db.prepare('SELECT sum(records_erased) AS n FROM ik_d1_erasure_journal').get().n,151);
  assert.equal((await f.service.importStatus(f.c,f.plan.review)).job.checkpoint,first.job.checkpoint);
  assert.ok((await f.list.listImports(f.c)).jobs[0].job);
  await assert.rejects(f.service.applyReviewed(f.c,f.plan.review,f.plan.fingerprint));
  let continued=await f.service.resumeReviewed(f.c,f.plan.review);for(let n=0;continued.job.state!=='completed'&&n<20;n++)continued=await f.service.resumeReviewed(f.c,f.plan.review);
  assert.equal(continued.job.state,'completed');assert.equal(f.db.prepare('SELECT count(*) AS n FROM nook_import_records').get().n,150);
  assert.equal(f.db.prepare("SELECT count(*) AS n FROM nook_import_actors WHERE source_id='U2' AND json_extract(source_record,'$.name')='Identical display name'").get().n,1);await assertNoImportPerson(f);
  assert.ok(f.db.prepare('SELECT body FROM nook_import_records').all().every(r=>r.body.includes('<@U1>')),'another author’s mention text remains');
  let reversed=await f.service.undoReviewed(f.c,f.plan.review);for(let n=0;!['undone','rolled_back'].includes(reversed.job.state)&&n<20;n++)reversed=await f.service.undoReviewed(f.c,f.plan.review);
  assert.equal(reversed.job.state,'undone');assert.equal(f.db.prepare('SELECT count(*) AS n FROM nook_import_records').get().n,0);assert.equal(f.db.prepare('SELECT count(*) AS n FROM nook_import_channels').get().n,0);
 }finally{f.close()}
 }
});

test('associated preview, staged-before-create and lost-create-ack custody cannot survive member erasure',async()=>{
 for(const phase of ['preview','preview-author','staged','lost-ack','reversed']){
  const f=await partialImportFixture({associated:true,total:20});try{
   if(phase==='reversed'){await f.finish(f.plan);assert.equal((await f.service.undoReviewed(f.c,f.plan.review)).job.state,'undone')}
   if(!phase.startsWith('preview')&&phase!=='reversed'){
    const original=f.adapter.batch;let fired=false;
    f.adapter.batch=async statements=>{const marker=phase==='staged'?'INSERT INTO ik_jobs':'UPDATE nook_import_reviews SET kit_job';if(!fired&&statements.some(s=>s.sql?.includes(marker))){fired=true;throw Error('fixture interrupted '+phase)}return original(statements)};
    // D1 statements expose their text in the fixture, just as the network edge
    // exposes a failed batch acknowledgement. Application code is unchanged.
    try{await f.service.applyReviewed(f.c,f.plan.review,f.plan.fingerprint)}catch(error){assert.match(error.message,/fixture interrupted/)}
    f.adapter.batch=original;assert.equal(fired,true);
   }
   const target=phase==='preview-author'?{kind:'imported-author',target:f.db.prepare('SELECT domain_job FROM nook_import_reviews WHERE id=?').get(f.plan.review).domain_job+':U1'}:{kind:'member',target:f.member.operatorId};
   await finishDoor(retaining,f.doorContext,await door(retaining,f.doorContext,'',{...target,confirmation:'ERASE'}));
   await assertNoImportPerson(f);assert.equal(f.db.prepare('SELECT count(*) AS n FROM nook_retained_import_bodies').get().n,0);
   await assert.rejects(f.service.applyReviewed(f.c,f.plan.review,f.plan.fingerprint));
   if(phase==='lost-ack'){
    assert.ok((await f.service.importStatus(f.c,f.plan.review)).job);
    let current=await f.service.resumeReviewed(f.c,f.plan.review);for(let n=0;current.job.state!=='completed'&&n<10;n++)current=await f.service.resumeReviewed(f.c,f.plan.review);
    assert.equal(current.job.state,'completed');assert.equal(f.db.prepare('SELECT count(*) AS n FROM nook_import_records').get().n,10);
    assert.equal((await f.service.undoReviewed(f.c,f.plan.review)).job.state,'undone');
   }
   else if(phase==='reversed')assert.equal((await f.service.importStatus(f.c,f.plan.review)).job.state,'undone');
   else assert.equal(f.db.prepare('SELECT state FROM nook_import_reviews WHERE id=?').get(f.plan.review).state,'discarded');
  }finally{f.close()}
 }
});


test('erasure continuation still refuses reversal after native work or an unrelated audience change',async()=>{
 for(const change of ['native','audience']){
  const f=await partialImportFixture({total:20});try{
   await f.finish(f.plan);const target=f.db.prepare("SELECT job||':'||source_id AS id FROM nook_import_actors WHERE source_id='U1'").get().id;
   await finishDoor(standard,f.doorContext,await door(standard,f.doorContext,'',{kind:'imported-author',target,confirmation:'ERASE'}));
   const conversation=f.db.prepare('SELECT conversation FROM nook_import_channels').get().conversation;
   if(change==='native')await standard.send(f.doorContext,conversation,{body:'Surviving native work',intent:'native-after-erasure'});
   else await (await import('../src/platform/storage/commands.ts')).write(f.c,'members',conversation,{user:f.member.operatorId});
   assert.equal((await f.service.importStatus(f.c,f.plan.review)).reversalSafe,false);
   await assert.rejects(f.service.undoReviewed(f.c,f.plan.review),/IMPORT_ATOMIC_GUARD/);
   assert.equal(f.db.prepare('SELECT count(*) AS n FROM nook_import_records').get().n,10);
   assert.equal(f.db.prepare('SELECT count(*) AS n FROM nook_import_channels').get().n,1);
  }finally{f.close()}
 }
 for(const native of ['decision','message','retained-message','attachment']){
  const f=await partialImportFixture({associated:true,total:20});try{
   await f.finish(f.plan);
   const conversation=f.db.prepare('SELECT conversation FROM nook_import_channels').get().conversation,c=new Context(f.c.env,f.member);
   const authored=native==='decision'?await standard.createOutcome(c,conversation,{kind:'decision',body:'Native decision before member erasure'}):native==='attachment'?await standard.upload(c,conversation,{name:'native.txt',mime:'text/plain',bytes:new TextEncoder().encode('Native staged file'),intent:'native-file'}):await standard.send(c,conversation,{body:'Native message before member erasure',intent:'native-before-erasure'});
   const module=native==='retained-message'?retaining:standard;
   await finishDoor(module,f.doorContext,await door(module,f.doorContext,'',{kind:'member',target:f.member.operatorId,confirmation:'ERASE'}));
   const table=native==='decision'?'nook_erased_outcomes':native==='attachment'?'nook_erased_attachments':'nook_erased_messages';
   const before=f.db.prepare('SELECT * FROM '+table+' WHERE id=?').get(authored.id);assert.equal(before.conversation,conversation);
   if(native==='retained-message')assert.equal(f.db.prepare('SELECT body FROM nook_retained_message_bodies WHERE id=?').get(authored.id).body,'Native message before member erasure');
   assert.equal((await f.service.importStatus(f.c,f.plan.review)).reversalSafe,false,native+' remains native work after erasure');
   await assert.rejects(f.service.undoReviewed(f.c,f.plan.review),/IMPORT_ATOMIC_GUARD/);
   assert.equal(f.db.prepare('SELECT count(*) AS n FROM nook_import_records').get().n,10);
   assert.equal(f.db.prepare('SELECT count(*) AS n FROM nook_import_channels').get().n,1);
   assert.deepEqual(f.db.prepare('SELECT * FROM '+table+' WHERE id=?').get(authored.id),before);
   assert.ok(f.db.prepare('SELECT 1 FROM nook_conversations WHERE id=?').get(conversation));
  }finally{f.close()}
 }
});
