import {test} from 'node:test';
import assert from 'node:assert/strict';
import {installation,until} from './push/fixture.mjs';
import {subscriber,packet} from './push/packet.mjs';

test('push core flow: normal auth, owned subscription, alarm sends encrypted alert, read cancels the next event',async()=>{
 const received=[],recipient=subscriber('core-flow');let publicKey,edgeFailure;
 const app=await installation(async request=>{try{assert.equal(request.url,recipient.subscription.endpoint);received.push(await packet(request,recipient,publicKey));return new Response(null,{status:201})}catch(error){edgeFailure=error;return new Response(null,{status:400})}});
 try{
  const {call,ownerCookie,invite,db}=app,room=await call('/api/conversations','POST',{name:'Launch',kind:'channel'},ownerCookie),member=await invite('rowan',room.id);
  const before=await call('/api/notify','GET',undefined,member.cookie);assert.equal(before.mentions,false);assert.equal(before.push.mentions,false);
  const info=await call('/api/devices','GET',undefined,member.cookie);publicKey=info.publicKey;
  const device=await call('/api/devices','POST',{transport:'webpush',subscription:recipient.subscription},member.cookie);assert.ok(device.id);
  await call('/api/notify','PATCH',{push:{mentions:true}},member.cookie);
  const payload={body:'BODY-MUST-NOT-LEAVE-NOOK',mentions:[member.user.id],intent:crypto.randomUUID()};
  const first=await call(`/api/conversations/${room.id}/messages`,'POST',payload,ownerCookie);assert.equal((await call(`/api/conversations/${room.id}/messages`,'POST',payload,ownerCookie)).id,first.id);
  await until(async()=>edgeFailure||received.length,'actual alarm sends push');if(edgeFailure)throw edgeFailure;
  assert.equal(received.length,1);assert.match(received[0].body,/Owner.*Launch/);assert.ok(!JSON.stringify(received[0]).includes(payload.body));assert.equal(new URL(received[0].url).searchParams.get('focus'),first.id);
  await until(async()=>(await db.prepare("SELECT state FROM nook_notify_queue WHERE channel='push' AND message=?").bind(first.id).first())?.state==='sent','sent persisted');
  const cancelRoom=await call('/api/conversations','POST',{name:'Read before delivery',kind:'private',participants:[member.user.id]},ownerCookie);
  const second=await call(`/api/conversations/${cancelRoom.id}/messages`,'POST',{...payload,intent:crypto.randomUUID()},ownerCookie);
  const conversation=(await call('/api/conversations','GET',undefined,member.cookie)).find(row=>row.id===cancelRoom.id);
  await call(`/api/conversations/${room.id}/read`,'POST',{seq:(await call('/api/conversations','GET',undefined,member.cookie)).find(row=>row.id===room.id).seq},member.cookie);
  await call(`/api/conversations/${cancelRoom.id}/read`,'POST',{seq:conversation.seq},member.cookie);
  const queue=await db.prepare('SELECT state,error FROM nook_notify_queue WHERE message=?').bind(second.id).first();assert.equal(queue.state,'cancelled');assert.equal(queue.error,'seen');
  const snapshot=await call('/api/devices/sync','GET',undefined,member.cookie);assert.equal(snapshot.badge,0);assert.deepEqual(snapshot.active,[]);
  assert.equal((await db.prepare("SELECT count(*) AS n FROM nook_notify_queue WHERE channel='email'").first()).n,0,'push never enables email');
  await new Promise(resolve=>setTimeout(resolve,6000));assert.equal(received.length,1,'read event sends no clear push or second alert');
 }finally{await app.close()}
});

test('push security: authentication, current device ownership, endpoint allowlist, keys, transport, and secret exposure',async()=>{
 let outbound=0;const app=await installation(async()=>{outbound++;return new Response(null,{status:302,headers:{location:'http://127.0.0.1/private'}})});
 try{
  const {call,raw,ownerCookie,invite}=app,room=await call('/api/conversations','POST',{name:'Security',kind:'channel'},ownerCookie),member=await invite('alex',room.id),sub=subscriber('security').subscription;
  await call('/api/devices','GET',undefined,'',401);await call('/api/devices','POST',{transport:'webpush',subscription:sub},'',401);
  await call('/api/devices','POST',{transport:'webpush',subscription:sub},member.cookie,403,{origin:'https://other.example'});
  for(const endpoint of ['http://web.push.apple.com/id','https://localhost/id','https://127.0.0.1/id','https://web.push.apple.com.evil.test/id','https://web.push.apple.com@evil.test/id','https://web.push.apple.com:8443/id'])await call('/api/devices','POST',{transport:'webpush',subscription:{...sub,endpoint}},member.cookie,400);
  for(const transport of ['relay','direct','webpush,relay',null])await call('/api/devices','POST',{transport,subscription:sub},member.cookie,400);
  await call('/api/devices','POST',{transport:'webpush',subscription:{...sub,keys:{p256dh:'bad',auth:sub.keys.auth}}},member.cookie,400);
  const device=await call('/api/devices','POST',{transport:'webpush',subscription:sub},member.cookie);
  await call('/api/devices','POST',{transport:'webpush',subscription:sub},ownerCookie,409);
  await call('/api/devices','DELETE',{id:device.id},ownerCookie);assert.equal((await call('/api/devices','GET',undefined,member.cookie)).devices.length,1,'another user cannot revoke a device');
  await call('/api/devices/presence','POST',{id:device.id,page:crypto.randomUUID(),visible:true},ownerCookie,404);
  const exposed=JSON.stringify(await call('/api/devices','GET',undefined,member.cookie));for(const value of [sub.endpoint,sub.keys.auth,sub.keys.p256dh,'sealed_private','privateKey'])assert.ok(!exposed.includes(value));
  const ownerDevices=await call('/api/devices','GET',undefined,ownerCookie);assert.deepEqual(ownerDevices.devices,[]);
  assert.equal(outbound,0,'registration and denied input never contact a provider');
  await call('/api/notify','PATCH',{push:{mentions:true}},member.cookie);
  await call(`/api/conversations/${room.id}/messages`,'POST',{body:'Redirect must never be followed',intent:crypto.randomUUID(),mentions:[member.user.id]},ownerCookie);
  await until(async()=>(await call('/api/notify','GET',undefined,member.cookie)).push.problems.length,'redirect refusal is visible');
  assert.equal(outbound,1,'vendor redirect is refused without a second network request');
  assert.equal((await call('/api/notify','GET',undefined,member.cookie)).push.problems[0].error,'refused');
  await call('/api/logout','POST',{},member.cookie);await call('/api/devices','GET',undefined,member.cookie,401);assert.equal((await app.db.prepare('SELECT count(*) AS n FROM nook_push_devices').first()).n,0);
 }finally{await app.close()}
});
