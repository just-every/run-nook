import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url),{build}=createRequire(require.resolve('wrangler'))('esbuild');
export async function scheduledForwardJourney({app,member,source,destination,dm,groupDm}){
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
  const audience=await schedule('Review a changed destination audience'),newReader=await app.invite('synthetic-nook-382',source.conversation);
  await call('/api/conversations/'+destination.id+'/members','POST',{user:newReader.user.id},ownerCookie);await drainSchedules(env,due);const disclosure=(await list()).find(s=>s.id===audience.id);assert.equal(disclosure.state,'complete');assert.match(disclosure.reason,/audience|disclosure/i);assert.ok(!(await call('/api/conversations/'+destination.id+'/messages','GET',undefined,member.cookie)).some(m=>m.body==='Review a changed destination audience'));assert.equal((await call('/api/conversations/'+dm.id+'/messages','GET',undefined,member.cookie)).filter(m=>m.body==='Review a changed destination audience').length,1);await call('/api/conversations/'+destination.id+'/members','POST',{user:newReader.user.id,remove:true},ownerCookie);
  const changing=await call('/api/conversations/'+source.conversation+'/messages','POST',{body:'Proposal before review',intent:crypto.randomUUID()},member.cookie),sourceChanged=await schedule('Review a changed source',changing.id);await call('/api/messages/'+changing.id,'PATCH',{body:'A different proposal requires review',version:changing.version},member.cookie);await drainSchedules(env,due);const sourceRefused=(await list()).find(s=>s.id===sourceChanged.id);assert.equal(sourceRefused.state,'failed');assert.match(sourceRefused.reason,/source|disclosure/i);for(const room of [destination,dm])assert.ok(!(await call('/api/conversations/'+room.id+'/messages','GET',undefined,member.cookie)).some(m=>m.body==='Review a changed source'));
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
