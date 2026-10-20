import {test} from 'node:test';
import assert from 'node:assert/strict';
import {installation,until} from './push/fixture.mjs';
import {notesBrowser} from './notes-browser.mjs';
import {createPortability,readArchive} from '@runeditrun/rer/modules/portability';
import {productPolicy} from '../src/platform/portability-policy.mjs';
import {migrationHistory} from './migration-history.mjs';

test('NOOK-053 a private channel note and checklist keep versions, propose a commitment only its assignee accepts, and export, erase and restore with the channel',{timeout:180000},async()=>{
 const app=await installation(async()=>new Response(null,{status:201}),{workerOptions:{assets:{directory:process.cwd()+'/dist/client',binding:'ASSETS',run_worker_first:true}}});let restore;
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
  restore=await installation(async()=>{assert.fail('restore must emit no external effects')},{bootstrap:false});
  const importer=await createPortability({db:restore.db,buckets:{FILES:await restore.mf.getR2Bucket('FILES')},policy:await productPolicy(restore.db),migrations:migrationHistory(await productPolicy(restore.db))});const id=await importer.imports.create(records[0]);for(const record of records)if(record.kind==='part')await importer.imports.uploadPart(id,record.index,record);const end=records.at(-1);await importer.imports.finalize(id,{contentHash:end.contentHash,archiveHash:end.archiveHash});
  assert.equal((await restore.db.prepare('SELECT title FROM nook_notes WHERE id=?').bind(note.id).first()).title,content.title);assert.equal((await restore.db.prepare('SELECT count(*) AS n FROM nook_note_versions WHERE note=?').bind(note.id).first()).n,5);assert.equal((await restore.db.prepare('SELECT status FROM nook_outcomes WHERE id=?').bind(proposed.id).first()).status,'accepted');assert.equal((await restore.db.prepare('SELECT count(*) AS n FROM oa_sessions').first()).n,0);
  // Message erasure clears all thread-note snapshots; independent channel notes survive.
  await call('/api/messages/'+root.id,'PATCH',{version:root.version,delete:true},ownerCookie);
  await until(async()=>(await call(base+'/'+threadNote.id,'GET',undefined,ana.cookie)).deleted,'thread note source erased');assert.ok((await call(base+'/'+threadNote.id+'/history','GET',undefined,ana.cookie)).items.every(v=>v.body===''&&v.items.length===0&&v.links.length===0));
  // Explicit shared-note deletion redacts historical bodies and linked URLs.
  await call(base+'/'+note.id,'DELETE',{version:checked.version},ana.cookie);const erased=await call(base+'/'+note.id,'GET',undefined,ana.cookie);assert.equal(erased.body,'');assert.equal(erased.title,'');assert.equal(erased.deleted,true);assert.ok((await call(base+'/'+note.id+'/history','GET',undefined,ana.cookie)).items.every(v=>v.deleted&&v.body===''&&v.links.length===0));
  // Member erasure also covers notes and every revision authored by that member.
  const authorNote=await call(base,'POST',{...content,title:'Ana’s support notes'},ana.cookie);
  let receipt=await call('/api/erasures','POST',{kind:'member',target:ana.user.id,confirmation:'ERASE'},ownerCookie);
  for(let n=0;receipt.state!=='complete'&&n<60;n++)receipt=await call(`/api/erasures/${receipt.id}/resume`,'POST',{},ownerCookie);
  assert.equal(receipt.state,'complete');assert.equal((await call(base+'/'+authorNote.id,'GET',undefined,lee.cookie)).deleted,true);assert.equal((await db.prepare('SELECT count(*) AS n FROM nook_note_versions WHERE actor=?').bind(ana.user.id).first()).n,0);
 }finally{await restore?.close();await app.close()}
});
