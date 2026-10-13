import assert from 'node:assert/strict';
import {until} from './fixture.mjs';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function failures(c){
 const {call,db,member,sender,unrelated,ownerCookie,room,send,rows,register,received,read}=c;
 await call('/api/devices','DELETE',{id:c.device.id},member.cookie);
 const check=async(error,state)=>{
  const mine=(await call('/api/notify','GET',undefined,member.cookie)).push,caused=(await call('/api/notify','GET',undefined,sender.cookie)).push,owner=(await call('/api/notify','GET',undefined,ownerCookie)).push,other=(await call('/api/notify','GET',undefined,unrelated.cookie)).push;
  assert.ok(mine.problems.some(p=>p.error===error&&p.state===state));assert.ok(caused.notDelivered.some(p=>p.error===error&&p.state===state&&p.recipient==='recipient'));
  assert.ok(owner.workspace.count>0);assert.equal(owner.workspace.error,error);assert.equal(owner.workspace.state,state);
  assert.deepEqual(other.problems,[]);assert.deepEqual(other.notDelivered,[]);assert.equal(other.workspace,null);
 };
 const limited=await register(member,'rate-limited','rate-limited'),healthy=await register(member,'healthy');
 const retryRoom=await room('Retry one device'),retry=await send(retryRoom,{mentions:[member.user.id]});
 await until(async()=>(await rows(retry)).some(r=>r.state==='retrying'),'rate limit is durable');await check('rate-limited','retrying');
 const first=received.find(r=>r.endpoint===limited.subscription.endpoint);assert.ok(first);
 await until(async()=>(await rows(retry)).every(r=>r.state==='sent'),'scheduled retry succeeds',25_000);
 const attempts=received.filter(r=>r.endpoint===limited.subscription.endpoint);assert.equal(attempts.length,2);assert.ok(attempts[1].at-first.at>=15_000,'real first retry delay elapsed');assert.equal(received.filter(r=>r.endpoint===healthy.subscription.endpoint).length,1,'healthy device never repeats during peer retry');await read(retryRoom);
 for(const d of [limited,healthy])await call('/api/devices','DELETE',{id:d.id},member.cookie);
 let retention,uncertain;
 for(const behavior of ['refused','expired','uncertain']){
  const device=await register(member,behavior,behavior),conversation=await room('Failure '+behavior),message=await send(conversation,{mentions:[member.user.id]});
  await until(async()=>(await rows(message))[0]?.state==='failed',behavior+' terminal');await check(behavior==='uncertain'?'uncertain':'refused','failed');
  const row=(await rows(message))[0];assert.equal(row.attempts,1);assert.equal(received.filter(r=>r.endpoint===device.subscription.endpoint).length,1);
  if(behavior==='expired')assert.ok(!(await call('/api/devices','GET',undefined,member.cookie)).devices.some(d=>d.id===device.id),'410 retires subscription');
  if(behavior==='uncertain')uncertain={device,message};else await call('/api/devices','DELETE',{id:device.id},member.cookie);
  retention=row;
 }
 // Seven-day visibility is a disclosed long-time staging supplement. Failures
 // above were produced by real outbound sends, never fabricated queue rows.
 const recent=Date.now()-7*86400_000+60_000,old=recent-120_000;
 await db.prepare('UPDATE nook_notify_queue SET updated=? WHERE id=?').bind(recent,retention.id).run();
 const before=(await call('/api/notify','GET',undefined,ownerCookie)).push.workspace.count;
 assert.ok((await call('/api/notify','GET',undefined,member.cookie)).push.problems.some(p=>p.updated===recent));
 assert.ok((await call('/api/notify','GET',undefined,sender.cookie)).push.notDelivered.some(p=>p.updated===recent));
 await db.prepare('UPDATE nook_notify_queue SET updated=? WHERE id=?').bind(old,retention.id).run();
 assert.ok(!(await call('/api/notify','GET',undefined,member.cookie)).push.problems.some(p=>p.updated===old));assert.ok(!(await call('/api/notify','GET',undefined,sender.cookie)).push.notDelivered.some(p=>p.updated===old));assert.equal((await call('/api/notify','GET',undefined,ownerCookie)).push.workspace.count,before-1);
 await pause(16_000);assert.equal(received.filter(r=>r.endpoint===uncertain.device.subscription.endpoint).length,1,'uncertain acceptance is never retried');assert.equal((await rows(uncertain.message))[0].state,'failed');
 await call('/api/devices','DELETE',{id:uncertain.device.id},member.cookie);c.device=await register(member,'after-failures');
 c.t.diagnostic('Failures: real 429 retry after 15 seconds with healthy-device dedup; refusal, 410 retirement and uncertain/no-retry; recipient, distinct sender, owner and unrelated-user projections. Seven-day visibility uses staged timestamps on real failed rows. Not-set-up is not injected: configured live key material remains intact.');
}
