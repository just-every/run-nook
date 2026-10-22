import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url),{build}=createRequire(require.resolve('wrangler'))('esbuild');
export async function scheduledForwardJourney({app,member,source,destination,dm}){
 const {call,ownerCookie,db}=app,temp=await mkdtemp(join(tmpdir(),'nook-forward-clock-'));
 try{
  const output=join(temp,'runner.mjs');await build({stdin:{contents:"export {drainSchedules} from './src/scheduled/runner'",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile:output,logLevel:'silent'});
  const {drainSchedules}=await import(pathToFileURL(output)),env=await app.mf.getBindings();
  const at=new Date(Date.now()+3600000).toISOString().slice(0,16),due=Date.parse(at+'Z');
  const schedule=async(note='Review this at the handoff',sourceId=source.id)=>{
   const input={source:sourceId,mode:'show',note,destinations:[{conversation:destination.id},{conversation:dm.id}]};
   const preview=await call('/api/forwards/preview','POST',input,member.cookie);
   return call('/api/forwards','POST',{...input,confirmation:preview.confirmation,intent:crypto.randomUUID(),schedule:{localAt:at,zone:'UTC',recurrence:'none',endDate:null}},member.cookie);
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
  const held=await schedule('Review this after restore');return {id:held.id};
 }finally{await rm(temp,{recursive:true,force:true})}
}
