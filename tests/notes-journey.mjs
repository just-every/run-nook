import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,readdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {recoverNormalizedFixture} from './recovery-support.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {installation,until} from './push/fixture.mjs';
import {notesBrowser,erasedNotesBrowser,memberErasurePreview} from './notes-browser.mjs';
import {createPortability,readArchive} from '@runeditrun/rer/modules/portability';
import {productPolicy} from '../src/platform/portability-policy.mjs';
import {migrationHistory} from './migration-history.mjs';

test('NOOK-053 a private channel note and checklist keep versions, propose a commitment only its assignee accepts, keep shared work anonymously through member erasure, and export, erase and restore with the channel',{timeout:180000},async()=>{
 const app=await installation(async()=>new Response(null,{status:201}),{workerOptions:{assets:{directory:process.cwd()+'/dist/client',binding:'ASSETS',run_worker_first:true}}});let restore;const recoveryDirectory=await mkdtemp(join(tmpdir(),'nook-notes-recovery-'));
 try{
  const {call,db,ownerCookie,origin}=app;
  const room=await call('/api/conversations','POST',{name:'Customer launch coordination',kind:'private'},ownerCookie),ana=await app.invite('Ana-Martinez',room.id),lee=await app.invite('Lee-Chen',room.id),outsider=await app.invite('Morgan',room.id);
  const root=await call(`/api/conversations/${room.id}/messages`,'POST',{body:'Thursday rollout and customer handoff',intent:crypto.randomUUID()},ownerCookie);
  const base=`/api/conversations/${room.id}/notes`,item=crypto.randomUUID();
  const content={title:'Thursday launch handoff',body:'Customer support coverage and launch preparation.',items:[{id:item,text:'Confirm customer success coverage',checked:false}],links:[{url:'https://docs.google.com/document/d/launch-handoff',label:'Google Drive handoff'}],pinned:false};
  let note=await call(base,'POST',content,ana.cookie);assert.equal(note.version,1);
  note=await call(base+'/'+note.id,'PATCH',{...content,version:1,body:'Coverage is confirmed; prepare the customer update.',pinned:true},lee.cookie);assert.equal(note.version,2);assert.equal(note.pinnedBy,lee.user.id);
  const history=await call(base+'/'+note.id+'/history','GET',undefined,ana.cookie);assert.equal(history.items.length,2);assert.deepEqual(history.items.map(r=>r.actor),[lee.user.id,ana.user.id]);assert.ok(history.items.every(r=>r.created));
  await call(base+'/'+note.id,'PATCH',{...content,version:1},ana.cookie,409);
  const reverted=await call(base+'/'+note.id+'/revert','POST',{version:2,restoreVersion:1},ana.cookie);assert.equal(reverted.version,3);assert.equal(reverted.body,content.body);
  note=await call(base+'/'+note.id,'PATCH',{...content,version:3,pinned:true},ana.cookie);
  const proposed=await call(base+'/'+note.id+'/proposals','POST',{version:note.version,item,assignee:lee.user.id},ana.cookie);assert.equal(proposed.status,'proposed');
  await call('/api/outcomes/'+proposed.id,'PATCH',{version:proposed.version,action:'accept'},ana.cookie,403);
  const checked=await call(base+'/'+note.id,'PATCH',{...content,version:note.version,pinned:true,items:[{id:item,text:content.items[0].text,checked:true}]},ana.cookie);assert.equal((await call(`/api/conversations/${room.id}/outcomes`,'GET',undefined,lee.cookie)).find(o=>o.id===proposed.id).status,'proposed','checked box confers no acceptance');
  const revised=await call('/api/outcomes/'+proposed.id,'PATCH',{version:proposed.version,body:'Confirm customer success and escalation coverage'},ana.cookie);
  await call('/api/outcomes/'+proposed.id,'PATCH',{version:proposed.version,action:'accept'},lee.cookie,409);
  const accepted=await call('/api/outcomes/'+proposed.id,'PATCH',{version:revised.version,action:'accept'},lee.cookie);assert.equal(accepted.status,'accepted');
  const threadNote=await call(base,'POST',{...content,title:'Rollout thread checklist',thread:root.id},lee.cookie);
  assert.equal((await call(base+'?thread='+root.id,'GET',undefined,ana.cookie)).items[0].id,threadNote.id);assert.equal((await call(base,'GET',undefined,ana.cookie)).items.length,1);
  const dm=await call('/api/conversations','POST',{kind:'dm',name:'Private partner handoff',participants:[lee.user.id]},ana.cookie),dmBase=`/api/conversations/${dm.id}/notes`;
  await call(dmBase,'POST',{...content,title:'Private partner note'},ana.cookie);await call(dmBase,'GET',undefined,ownerCookie,403);
  await call(`/api/conversations/${room.id}/members`,'POST',{user:outsider.user.id,remove:true},ownerCookie);
  for(const path of [base,base+'/'+note.id,base+'/'+note.id+'/history',base+'/'+note.id+'/proposals'])await call(path,'GET',undefined,outsider.cookie,403);
  await call(base,'POST',content,outsider.cookie,403);
  // Readable export goes through the same current-ACL job/pages as the app.
  let job=await call('/api/readable-exports','POST',{scope:'conversation',conversationId:room.id,custodyAccepted:true},ana.cookie);
  for(let n=0;!job.complete&&n<100;n++)job=await call(`/api/readable-exports/${job.id}/step`,'POST',{},ana.cookie);
  assert.ok(job.complete);const index=await call(`/api/readable-exports/${job.id}/index`,'GET',undefined,ana.cookie),exported=[];
  for(const page of index.items){const value=await call(`/api/readable-exports/${job.id}/pages/${page.ordinal}`,'GET',undefined,ana.cookie);exported.push(...value.records)}
  assert.ok(exported.some(r=>r.type==='notes'&&r.data.id===note.id&&r.data.title===content.title));assert.ok(exported.filter(r=>r.type==='note_versions'&&r.data.note===note.id).length>=5);assert.ok(exported.some(r=>r.type==='note_proposals'&&r.data.outcome===proposed.id));
  await fetch(origin+'/setup',{method:'POST',redirect:'manual',headers:{cookie:ownerCookie,origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'});
  await notesBrowser({origin,ana,room,note:checked,root,threadNote});
  // Full archive service is the operational export/restore public door.
  const service=await createPortability({db,buckets:{FILES:await app.mf.getR2Bucket('FILES')},policy:await productPolicy(db)});const exportId=await service.exports.create();
  let records=[];try{while((await service.exports.advance(exportId,{maxParts:16})).phase==='building'){};for await(const record of readArchive(await service.exports.download(exportId)))records.push(record)}finally{await service.exports.abort(exportId)}
  restore=await installation(async()=>{assert.fail('restore must emit no external effects')},{bootstrap:false,workerOptions:{resourcePersistencePath:recoveryDirectory}});
  const importer=await createPortability({db:restore.db,buckets:{FILES:await restore.mf.getR2Bucket('FILES')},policy:await productPolicy(restore.db),migrations:migrationHistory(await productPolicy(restore.db))});const id=await importer.imports.create(records[0]);for(const record of records)if(record.kind==='part')await importer.imports.uploadPart(id,record.index,record);const end=records.at(-1);await importer.imports.finalize(id,{contentHash:end.contentHash,archiveHash:end.archiveHash});
  assert.equal((await restore.db.prepare('SELECT title FROM nook_notes WHERE id=?').bind(note.id).first()).title,content.title);assert.equal((await restore.db.prepare('SELECT count(*) AS n FROM nook_note_versions WHERE note=?').bind(note.id).first()).n,5);assert.equal((await restore.db.prepare('SELECT status FROM nook_outcomes WHERE id=?').bind(proposed.id).first()).status,'accepted');assert.equal((await restore.db.prepare('SELECT count(*) AS n FROM oa_sessions').first()).n,0);
  // Recover identities offline through the shipped recovery command, then erase
  // through a fresh signed-in HTTP session on the restored installation.
  await restore.close();restore=undefined;
  const databases=[];for(const name of (await readdir(recoveryDirectory,{recursive:true})).filter(name=>name.endsWith('.sqlite'))){const file=new DatabaseSync(join(recoveryDirectory,name),{readOnly:true});try{if(file.prepare("SELECT name FROM sqlite_master WHERE name='nook_storage'").get())databases.push(name)}finally{file.close()}}assert.equal(databases.length,1);
  await recoverNormalizedFixture(join(recoveryDirectory,databases[0]),app.owner.id);
  restore=await installation(async()=>assert.fail('restored notes create no outbound delivery'),{bootstrap:false,migrate:false,workerOptions:{resourcePersistencePath:recoveryDirectory}});
  const recoveredOwner=await restore.signIn('owner@example.test'),recoveredLee=await restore.signIn('lee-chen@example.test');
  const recoveredSolo=(await restore.call(dmBase,'GET',undefined,recoveredLee.cookie)).items[0];
  let recoveredReceipt=await restore.call('/api/erasures','POST',{kind:'member',target:ana.user.id,confirmation:'ERASE'},recoveredOwner.cookie);
  for(let n=0;recoveredReceipt.state!=='complete'&&n<60;n++)recoveredReceipt=await restore.call(`/api/erasures/${recoveredReceipt.id}/resume`,'POST',{},recoveredOwner.cookie);
  assert.equal(recoveredReceipt.state,'complete');
  const recoveredShared=await restore.call(base+'/'+note.id,'GET',undefined,recoveredLee.cookie);assert.equal(recoveredShared.body,checked.body);assert.equal(recoveredShared.author,null);assert.equal(recoveredShared.pinnedBy,null);assert.equal(recoveredShared.deleted,false);
  const recoveredHistory=(await restore.call(base+'/'+note.id+'/history','GET',undefined,recoveredLee.cookie)).items;assert.equal(recoveredHistory.length,5);assert.ok(recoveredHistory.every(v=>v.actor!==ana.user.id&&v.pinnedBy!==ana.user.id));assert.equal(recoveredHistory.find(v=>v.version===2).actor,lee.user.id);
  assert.equal((await restore.call(dmBase+'/'+recoveredSolo.id,'GET',undefined,recoveredLee.cookie)).deleted,true);
  await restore.close();restore=undefined;
  // Message erasure clears all thread-note snapshots; independent channel notes survive.
  await call('/api/messages/'+root.id,'PATCH',{version:root.version,delete:true},ownerCookie);
  await until(async()=>(await call(base+'/'+threadNote.id,'GET',undefined,ana.cookie)).deleted,'thread note source erased');assert.ok((await call(base+'/'+threadNote.id+'/history','GET',undefined,ana.cookie)).items.every(v=>v.body===''&&v.items.length===0&&v.links.length===0));
  // Explicit shared-note deletion redacts historical bodies and linked URLs.
  await call(base+'/'+note.id,'DELETE',{version:checked.version},ana.cookie);const erased=await call(base+'/'+note.id,'GET',undefined,ana.cookie);assert.equal(erased.body,'');assert.equal(erased.title,'');assert.equal(erased.deleted,true);assert.ok((await call(base+'/'+note.id+'/history','GET',undefined,ana.cookie)).items.every(v=>v.deleted&&v.body===''&&v.links.length===0));
  // Member erasure keeps shared work: Ana starts and pins a rota Lee revises; only Ana's attribution goes.
  const rota={...content,title:'Weekend support rota',body:'Ana covers Saturday; Lee covers Sunday.',pinned:true};
  let shared=await call(base,'POST',rota,ana.cookie);shared=await call(base+'/'+shared.id,'PATCH',{...rota,version:1,body:'Ana covers Saturday; Lee covers Sunday and the Monday handoff.'},lee.cookie);assert.equal(shared.pinnedBy,ana.user.id);
  let colleagueNote=await call(base,'POST',{...content,title:'Lee’s support handoff'},lee.cookie);colleagueNote=await call(base+'/'+colleagueNote.id,'PATCH',{...content,title:'Lee’s support handoff',version:1,body:'Ana reviewed Lee’s handoff.',pinned:true},ana.cookie);
  let authorNote=await call(base,'POST',{...content,title:'Ana’s support notes'},ana.cookie);authorNote=await call(base+'/'+authorNote.id,'PATCH',{...content,title:'Ana’s support notes',version:1,body:'Ana’s private call prep.'},ana.cookie);
  const anaRoot=await call(`/api/conversations/${room.id}/messages`,'POST',{body:'Ana’s escalation thread',intent:crypto.randomUUID()},ana.cookie),rootNote=await call(base,'POST',{...content,title:'Escalation thread checklist',thread:anaRoot.id},lee.cookie);
  await memberErasurePreview({origin,ownerCookie});
  const racingNote=await call(base,'POST',{...content,title:'Last-minute shared handoff'},ana.cookie);
  const [erasureResponse,revisionResponse]=await Promise.all([
   app.raw('/api/erasures','POST',{kind:'member',target:ana.user.id,confirmation:'ERASE'},ownerCookie),
   app.raw(base+'/'+racingNote.id,'PATCH',{...content,title:racingNote.title,version:1,body:'Lee accepted the final handoff.'},lee.cookie),
  ]);
  assert.ok([200,409].includes(erasureResponse.status),'member erasure succeeds or reports a concurrent version conflict');
  assert.ok([200,409].includes(revisionResponse.status),'the concurrent revision commits or sees the cleared note');
  // Admission is durable even if a later erasure batch meets a changed note.
  const admitted=await db.prepare("SELECT id FROM nook_erasure_receipts WHERE kind='member' ORDER BY created DESC LIMIT 1").first();assert.ok(admitted);
  let receipt=await call('/api/erasures/'+admitted.id,'GET',undefined,ownerCookie);

  for(let n=0;receipt.state!=='complete'&&n<60;n++)receipt=await call(`/api/erasures/${receipt.id}/resume`,'POST',{},ownerCookie);
  assert.equal(receipt.state,'complete');
  const raced=await call(base+'/'+racingNote.id,'GET',undefined,lee.cookie);
  if(revisionResponse.status===200){assert.equal(raced.deleted,false,'a committed concurrent revision must survive');assert.equal(raced.body,'Lee accepted the final handoff.');assert.deepEqual((await call(base+'/'+racingNote.id+'/history','GET',undefined,lee.cookie)).items.map(v=>v.actor),[lee.user.id,null])}else assert.equal(raced.deleted,true,'a revision refused after erasure changes nothing');
  const colleagueKept=await call(base+'/'+colleagueNote.id,'GET',undefined,lee.cookie);assert.equal(colleagueKept.body,colleagueNote.body);assert.equal(colleagueKept.author,lee.user.id);assert.equal(colleagueKept.pinnedBy,null);assert.deepEqual((await call(base+'/'+colleagueNote.id+'/history','GET',undefined,lee.cookie)).items.map(v=>v.actor),[null,lee.user.id],'erasing a reviser also preserves the other author’s work');
  const kept=await call(base+'/'+shared.id,'GET',undefined,lee.cookie);assert.equal(kept.deleted,false);assert.equal(kept.body,shared.body);assert.equal(kept.author,null);assert.equal(kept.pinned,true);assert.equal(kept.pinnedBy,null);
  const keptHistory=(await call(base+'/'+shared.id+'/history','GET',undefined,lee.cookie)).items;assert.deepEqual(keptHistory.map(v=>[v.version,v.actor,v.body]),[[2,lee.user.id,shared.body],[1,null,rota.body]],'Lee’s revision and Ana’s anonymous original survive');
  for(const gone of [authorNote,rootNote]){assert.equal((await call(base+'/'+gone.id,'GET',undefined,lee.cookie)).deleted,true,gone.title+' cleared');assert.ok((await db.prepare('SELECT body,title FROM nook_note_versions WHERE note=?').bind(gone.id).all()).results.every(v=>v.body===''&&v.title===''))}
  for(const width of [1440,390])assert.equal((await call(base,'GET',undefined,lee.cookie)).items.some(n=>n.title==='Customer contacts '+width),false,'Ana-only browser notes cleared');
  assert.equal((await db.prepare('SELECT (SELECT count(*) FROM nook_notes WHERE author=?1 OR pinned_by=?1)+(SELECT count(*) FROM nook_note_versions WHERE actor=?1 OR pinned_by=?1) AS n').bind(ana.user.id).first()).n,0);
  await erasedNotesBrowser({origin,lee,room,shared:kept});
  // Readable export and the operational archive carry the anonymized shared note.
  job=await call('/api/readable-exports','POST',{scope:'conversation',conversationId:room.id,custodyAccepted:true},lee.cookie);
  for(let n=0;!job.complete&&n<100;n++)job=await call(`/api/readable-exports/${job.id}/step`,'POST',{},lee.cookie);
  const after=[];for(const page of (await call(`/api/readable-exports/${job.id}/index`,'GET',undefined,lee.cookie)).items)after.push(...(await call(`/api/readable-exports/${job.id}/pages/${page.ordinal}`,'GET',undefined,lee.cookie)).records);
  assert.equal(after.find(r=>r.type==='notes'&&r.data.id===shared.id).data.body,shared.body);assert.deepEqual(after.filter(r=>r.type==='note_versions'&&r.data.note===shared.id).map(r=>r.data.actor).sort(),[lee.user.id,null].sort());assert.ok(after.filter(r=>r.type.startsWith('note')).every(r=>![r.data.author,r.data.actor,r.data.pinned_by].includes(ana.user.id)));
  // Background erasure continuation must finish first; an archive refuses pending erasures.
  await until(async()=>!(await db.prepare("SELECT 1 FROM nook_erasure_receipts WHERE state<>'complete' UNION ALL SELECT 1 FROM nook_erasure_work").first()),'erasure work settled before the archive',60_000);
  await restore?.close();restore=undefined;const latest=await createPortability({db,buckets:{FILES:await app.mf.getR2Bucket('FILES')},policy:await productPolicy(db)}),latestId=await latest.exports.create();
  records=[];try{while((await latest.exports.advance(latestId,{maxParts:16})).phase==='building'){};for await(const record of readArchive(await latest.exports.download(latestId)))records.push(record)}finally{await latest.exports.abort(latestId)}
  restore=await installation(async()=>{assert.fail('restore must emit no external effects')},{bootstrap:false});
  const second=await createPortability({db:restore.db,buckets:{FILES:await restore.mf.getR2Bucket('FILES')},policy:await productPolicy(restore.db),migrations:migrationHistory(await productPolicy(restore.db))}),secondId=await second.imports.create(records[0]);for(const record of records)if(record.kind==='part')await second.imports.uploadPart(secondId,record.index,record);await second.imports.finalize(secondId,{contentHash:records.at(-1).contentHash,archiveHash:records.at(-1).archiveHash});
  assert.deepEqual(await restore.db.prepare('SELECT body,author,pinned,pinned_by AS pinnedBy,deleted FROM nook_notes WHERE id=?').bind(shared.id).first(),{body:shared.body,author:null,pinned:1,pinnedBy:null,deleted:0});
  assert.deepEqual((await restore.db.prepare('SELECT version,actor,body FROM nook_note_versions WHERE note=? ORDER BY version').bind(shared.id).all()).results,[{version:1,actor:null,body:rota.body},{version:2,actor:lee.user.id,body:shared.body}]);
  assert.equal((await restore.db.prepare('SELECT deleted FROM nook_notes WHERE id=?').bind(authorNote.id).first()).deleted,1);
  for(const table of ['nook_notes','nook_note_versions','nook_note_proposals'])assert.deepEqual((await restore.db.prepare(`SELECT * FROM ${table} ORDER BY 1,2`).all()).results,(await db.prepare(`SELECT * FROM ${table} ORDER BY 1,2`).all()).results,table+' restores every shared and cleared field exactly');
 }finally{await restore?.close();await app.close();await rm(recoveryDirectory,{recursive:true,force:true})}
});
