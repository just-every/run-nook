import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url),{build}=createRequire(require.resolve('wrangler'))('esbuild');
export async function scheduledForwardJourney({app,member,source,publicSource,destination,dm,groupDm}){
 const {call,ownerCookie,db}=app,temp=await mkdtemp(join(tmpdir(),'nook-forward-clock-'));
 try{
  const output=join(temp,'runner.mjs');await build({stdin:{contents:"export {drainSchedules} from './src/scheduled/runner'",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile:output,logLevel:'silent'});
  const {drainSchedules}=await import(pathToFileURL(output)),env=await app.mf.getBindings();
  const at=new Date(Date.now()+3600000).toISOString().slice(0,16),due=Date.parse(at+'Z');
  const schedule=async(note='Review this at the handoff',sourceId=source.id,destinations=[{conversation:destination.id},{conversation:dm.id}],cookie=member.cookie)=>{
   const input={source:sourceId,mode:'show',note,destinations};
   const preview=await call('/api/forwards/preview','POST',input,cookie);
   return call('/api/forwards','POST',{...input,confirmation:preview.confirmation,intent:crypto.randomUUID(),schedule:{localAt:at,zone:'UTC',recurrence:'none',endDate:null}},cookie);
  };
  const list=async()=> (await call('/api/scheduled','GET',undefined,member.cookie)).items;
  // Every source door, for the forwarding member's own and another member's
  // messages. A reviewed source edit invalidates each kind before delivery.
  for(const [kind,room,parent] of [['public channel',publicSource],['private channel',{id:source.conversation}],['DM',dm],['thread reply',{id:source.conversation},source.id],['group DM',groupDm]]){
   for(const [author,cookie] of [['own',member.cookie],['another',ownerCookie]]){
    const label=kind+' / '+author,original=await call('/api/conversations/'+room.id+'/messages','POST',{body:'Release handoff from '+label,intent:crypto.randomUUID(),...(parent?{parent}:{})},cookie);
    const created=await schedule('',original.id,[{conversation:destination.id}]),reviewed=(await list()).find(s=>s.id===created.id);
    assert.equal(reviewed.payload.forward.source,original.id,label+' reviewed source');assert.equal(reviewed.next_due,due,label+' scheduled time');
    await drainSchedules(env,due-60000);
    assert.ok(!(await call('/api/conversations/'+destination.id+'/messages','GET',undefined,member.cookie)).some(m=>m.forward?.source===original.id),label+' never early');
    await drainSchedules(env,due);await drainSchedules(env,due);
    const completed=(await list()).find(s=>s.id===created.id);assert.equal(completed.state,'complete',label+' complete');assert.equal(completed.occurrences.length,1,label+' one occurrence');
    const copies=(await call('/api/conversations/'+destination.id+'/messages','GET',undefined,member.cookie)).filter(m=>m.forward?.source===original.id);
    assert.equal(copies.length,1,label+' delivered once');assert.equal(copies[0].forward.body,original.body,label+' body');assert.equal(copies[0].forward.note,'',label+' optional note absent');
    const stale=await schedule('Changed source '+label,original.id,[{conversation:destination.id}]);
    await call('/api/messages/'+original.id,'PATCH',{body:'Revised handoff from '+label,version:original.version},cookie);await drainSchedules(env,due);
    const refused=(await list()).find(s=>s.id===stale.id);assert.equal(refused.state,'failed',label+' changed source refused');assert.match(refused.reason,/source|disclosure/i,label+' visible reason');
    assert.ok(!(await call('/api/conversations/'+destination.id+'/messages','GET',undefined,member.cookie)).some(m=>m.body==='Changed source '+label),label+' refused source sends nothing');
   }
  }
  const one=await schedule(),pending=(await list()).find(s=>s.id===one.id);assert.equal(pending.payload.forward.destinations.length,2);assert.equal(pending.next_due,due);
  assert.ok(!JSON.stringify(pending).includes(env.SESSION_SECRET));
  const before=(await call('/api/conversations/'+destination.id+'/messages','GET',undefined,member.cookie)).length;
  await drainSchedules(env,due);await drainSchedules(env,due);
  let delivered=(await list()).find(s=>s.id===one.id);assert.equal(delivered.state,'complete');assert.equal(delivered.occurrences.length,1);
  for(const room of [destination,dm]){
   const messages=await call('/api/conversations/'+room.id+'/messages','GET',undefined,member.cookie),copies=messages.filter(m=>m.forward?.source===source.id&&m.body==='Review this at the handoff');
   assert.equal(copies.length,1);assert.equal(copies[0].forward.body,source.body);assert.equal(copies[0].forward.created,source.created);
   assert.equal((await call('/api/forwards/'+copies[0].id+'/source','GET',undefined,member.cookie)).id,source.id);
  }
  assert.equal((await call('/api/conversations/'+destination.id+'/messages','GET',undefined,member.cookie)).length,before+1);
  const root=await call('/api/conversations/'+destination.id+'/messages','POST',{body:'Scheduled thread context',intent:crypto.randomUUID()},member.cookie);
  const threaded=await schedule('Thread and group handoff',source.id,[{conversation:destination.id,thread:root.id},{conversation:groupDm.id}]);
  await drainSchedules(env,due);assert.equal((await list()).find(s=>s.id===threaded.id).state,'complete');
  assert.ok((await call('/api/conversations/'+destination.id+'/messages','GET',undefined,member.cookie)).some(m=>m.parent===root.id&&m.body==='Thread and group handoff'));
  assert.equal((await call('/api/conversations/'+groupDm.id+'/messages','GET',undefined,member.cookie)).filter(m=>m.body==='Thread and group handoff').length,1);
  const partial=await schedule('A destination may be restricted before delivery');
  let details=await call('/api/channels/'+destination.id+'/details','GET',undefined,ownerCookie);
  await call('/api/channels/'+destination.id+'/posting','PATCH',{version:details.version,level:'admins',replies:'same',people:[]},ownerCookie);
  await drainSchedules(env,due);const mixed=(await list()).find(s=>s.id===partial.id);assert.equal(mixed.state,'complete');assert.match(mixed.reason,/posting/i);
  assert.ok(!(await call('/api/conversations/'+destination.id+'/messages','GET',undefined,member.cookie)).some(m=>m.body==='A destination may be restricted before delivery'));
  assert.equal((await call('/api/conversations/'+dm.id+'/messages','GET',undefined,member.cookie)).filter(m=>m.body==='A destination may be restricted before delivery').length,1);
  details=await call('/api/channels/'+destination.id+'/details','GET',undefined,ownerCookie);await call('/api/channels/'+destination.id+'/posting','PATCH',{version:details.version,level:'everyone',replies:'same',people:[]},ownerCookie);
  const cancelled=await schedule('Cancel this future forward');await call('/api/scheduled/'+cancelled.id,'PATCH',{action:'edit',version:1,body:'Cancel this future forward',forward:(await list()).find(s=>s.id===cancelled.id).payload.forward,localAt:new Date(due+3600000).toISOString().slice(0,16),zone:'UTC',recurrence:'none',endDate:null},member.cookie);
  assert.equal((await list()).find(s=>s.id===cancelled.id).version,2);await call('/api/scheduled/'+cancelled.id,'PATCH',{action:'cancel',version:2},member.cookie);await drainSchedules(env,due+3600000);assert.equal((await list()).find(s=>s.id===cancelled.id).state,'cancelled');
  assert.ok(!(await call('/api/conversations/'+dm.id+'/messages','GET',undefined,member.cookie)).some(m=>m.body==='Cancel this future forward'));
  const doomed=await call('/api/conversations/'+source.conversation+'/messages','POST',{body:'A temporary source for the scheduled handoff.',intent:crypto.randomUUID()},member.cookie),removed=await schedule('This source will be erased',doomed.id);
  await call('/api/messages/'+doomed.id,'PATCH',{delete:true,version:doomed.version},member.cookie);await drainSchedules(env,due);assert.equal((await list()).find(s=>s.id===removed.id).state,'cancelled');assert.equal((await db.prepare('SELECT count(*) AS n FROM nook_forwards WHERE source=?').bind(doomed.id).first()).n,0);
  const stricter=await schedule('Never silently downgrade Show message');let policy=await call('/api/forwards/policy','GET',undefined,ownerCookie);await call('/api/forwards/policy','POST',{mode:'link-only',version:policy.version},ownerCookie);await drainSchedules(env,due);const refused=(await list()).find(s=>s.id===stricter.id);assert.equal(refused.state,'failed');assert.match(refused.reason,/policy/i);policy=await call('/api/forwards/policy','GET',undefined,ownerCookie);await call('/api/forwards/policy','POST',{mode:'allow',version:policy.version},ownerCookie);
  const newReader=await app.invite('synthetic-nook-382',source.conversation),audience=await schedule('Review a changed destination audience');
  await call('/api/conversations/'+destination.id+'/members','POST',{user:newReader.user.id},ownerCookie);await drainSchedules(env,due);const disclosure=(await list()).find(s=>s.id===audience.id);assert.equal(disclosure.state,'complete');assert.match(disclosure.reason,/audience|disclosure/i);assert.ok(!(await call('/api/conversations/'+destination.id+'/messages','GET',undefined,member.cookie)).some(m=>m.body==='Review a changed destination audience'));assert.equal((await call('/api/conversations/'+dm.id+'/messages','GET',undefined,member.cookie)).filter(m=>m.body==='Review a changed destination audience').length,1);await call('/api/conversations/'+destination.id+'/members','POST',{user:newReader.user.id,remove:true},ownerCookie);
  const changing=await call('/api/conversations/'+source.conversation+'/messages','POST',{body:'Proposal before review',intent:crypto.randomUUID()},member.cookie),sourceChanged=await schedule('Review a changed source',changing.id);await call('/api/messages/'+changing.id,'PATCH',{body:'A different proposal requires review',version:changing.version},member.cookie);await drainSchedules(env,due);const sourceRefused=(await list()).find(s=>s.id===sourceChanged.id);assert.equal(sourceRefused.state,'failed');assert.match(sourceRefused.reason,/source|disclosure/i);for(const room of [destination,dm])assert.ok(!(await call('/api/conversations/'+room.id+'/messages','GET',undefined,member.cookie)).some(m=>m.body==='Review a changed source'));
  const deniedRooms=[];for(let n=0;n<10;n++)deniedRooms.push(await call('/api/conversations','POST',{name:'Launch destination '+n,kind:'private',participants:[member.user.id]},ownerCookie));
  const deniedSet=await schedule('Every refused destination stays visible',source.id,deniedRooms.map(room=>({conversation:room.id})));for(const room of deniedRooms){const detail=await call('/api/channels/'+room.id+'/details','GET',undefined,ownerCookie);await call('/api/channels/'+room.id+'/posting','PATCH',{version:detail.version,level:'admins',replies:'same',people:[]},ownerCookie)}await drainSchedules(env,due);const allDenied=(await list()).find(s=>s.id===deniedSet.id);assert.equal(allDenied.state,'failed');for(const room of deniedRooms){assert.match(allDenied.reason,new RegExp(room.id+':[^;]*posting','i'));assert.ok(!(await call('/api/conversations/'+room.id+'/messages','GET',undefined,member.cookie)).some(m=>m.body==='Every refused destination stays visible'))}
  const generation=await schedule('An older access grant must never send');
  await db.prepare('UPDATE nook_access SET generation=generation+1 WHERE user=?').bind(member.user.id).run();
  await drainSchedules(env,due);const changed=(await list()).find(s=>s.id===generation.id);assert.equal(changed.state,'failed');assert.match(changed.reason,/access generation/i);
  for(const room of [destination,dm])assert.ok(!(await call('/api/conversations/'+room.id+'/messages','GET',undefined,member.cookie)).some(m=>m.body==='An older access grant must never send'));
  const approval=await app.signIn((await call('/api/notify','GET',undefined,member.cookie)).address);
  const revoked=await schedule('This approval will be revoked',source.id,undefined,approval.cookie);await call('/api/logout','POST',{},approval.cookie);await drainSchedules(env,due);
  const expired=(await list()).find(s=>s.id===revoked.id);assert.equal(expired.state,'failed');assert.match(expired.reason,/approving session/i);
  for(const room of [destination,dm])assert.ok(!(await call('/api/conversations/'+room.id+'/messages','GET',undefined,member.cookie)).some(m=>m.body==='This approval will be revoked'));
  const held=await schedule('Review this after restore');return {id:held.id};
 }finally{await rm(temp,{recursive:true,force:true})}
}
