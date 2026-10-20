import assert from 'node:assert/strict';
import {until} from './fixture.mjs';
import {deliveryBrowser} from './delivery-browser.mjs';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function presence(c){
 const {call,db,member,device,room,send,received,rows,read,register}=c;
 const phone=await register(member,'Ana’s phone',undefined,'mobile'),page=crypto.randomUUID();
 const beat=(visible=true,lastInputAt=Date.now(),cookie=member.cookie,id=device.id)=>call('/api/devices/presence','POST',{id,page,visible,lastInputAt},cookie);
 const phoneRow=async message=>(await rows(message)).find(r=>r.device===phone.id);
 const complete=async message=>{try{return await until(async()=>(await rows(message)).every(r=>['sent','folded'].includes(r.state)),'both devices delivered '+message.id)}catch(error){console.error('Delivery rows',await rows(message));console.error('Presence',(await db.prepare('SELECT * FROM nook_push_presence').all()).results);throw error}};
 const count=message=>received.filter(r=>new URL(r.value.url).searchParams.get('focus')===message.id);
 await beat();
 const dm=await room('Desktop handoff DM','dm'),mentionRoom=await room('Launch handoff');
 const direct=await send(dm),mention=await send(mentionRoom,{mentions:[member.user.id]});
 await until(async()=>{const a=await rows(direct),b=await rows(mention);return a.find(r=>r.device===device.id)?.state==='sent'&&b.find(r=>r.device===device.id)?.state==='sent'&&(await phoneRow(direct))?.held_at&&(await phoneRow(mention))?.held_at},'desktop alerts and phone holds');
 assert.equal(count(direct).length,1);assert.equal(count(mention).length,1);
 assert.equal((await call('/api/attention','GET',undefined,member.cookie)).items.find(i=>i.message?.id===mention.id)?.reason,'mention','active client keeps the alert in app');
 const view=await call('/api/devices','GET',undefined,member.cookie);assert.ok(view.devices.find(d=>d.id===phone.id).routing.includes('Phone held'));assert.equal(view.devices.find(d=>d.id===device.id).active,1);
 await read(dm);
 await beat(false);
 await until(async()=>(await phoneRow(direct))?.error==='held-active-elsewhere','read cancels activity-held phone alert');
 await complete(mention);assert.equal(count(direct).length,1);assert.equal(count(mention).length,2);assert.ok((await phoneRow(mention)).released_at);await read(mentionRoom);
 // Input idleness, even with a visible fresh heartbeat, counts as inactive.
 await beat(true,Date.now()-601000);const idleRoom=await room('Idle desktop'),idle=await send(idleRoom,{mentions:[member.user.id]});await complete(idle);await read(idleRoom);
 // No heartbeat or request between enqueue and receipt: real alarm and expiry.
 const expiryRoom=await room('Heartbeat stops'),start=Date.now();await beat();const expiry=await send(expiryRoom,{mentions:[member.user.id]});
 await pause(Math.max(0,start+44000-Date.now()));assert.equal(count(expiry).length,1,'desktop alone alerts before 45 seconds');
 await until(async()=>(await phoneRow(expiry))?.state==='sent','alarm releases actual 45-second expiry',15000);assert.ok(count(expiry).find(r=>r.endpoint===phone.subscription.endpoint).at-start>=45000);await read(expiryRoom);
 // Account preference bypasses activity while preserving desktop delivery.
 await beat();await call('/api/notify','PATCH',{mobileWhenActive:'always'},member.cookie);const alwaysRoom=await room('Always mobile'),always=await send(alwaysRoom,{mentions:[member.user.id]});await complete(always);assert.equal((await phoneRow(always)).held_at,null);await read(alwaysRoom);
 await call('/api/notify','PATCH',{mobileWhenActive:'inactive',push:{urgentQuiet:true}},member.cookie);await call('/api/settings','PATCH',{dndUntil:Date.now()+60000},member.cookie);await beat();
 const urgentRoom=await room('Urgent bypass'),urgent=await send(urgentRoom,{mentions:[member.user.id],urgent:true,urgentReason:'Please join the incident response'});await complete(urgent);assert.equal((await phoneRow(urgent)).held_at,null);await read(urgentRoom);await call('/api/settings','PATCH',{dndUntil:null},member.cookie);
 // Use a second real sign-in, revoke only it, and replay its last heartbeat.
 const other=await c.signIn(member.user.email),revoked=await register(other,'Revoked desktop');await beat(true,Date.now(),other.cookie,revoked.id);await call('/api/logout','POST',{},other.cookie);await call('/api/devices/presence','POST',{id:revoked.id,page,visible:true,lastInputAt:Date.now()},other.cookie,401);await beat(false);
 const revokedRoom=await room('Revoked heartbeat holds nothing'),replayed=await send(revokedRoom,{mentions:[member.user.id]});await complete(replayed);assert.equal((await phoneRow(replayed)).held_at,null);await read(revokedRoom);
 // Chosen delay runs on the real clock, through the real Durable Object alarm.
 await call('/api/notify','PATCH',{mobileDelayMinutes:5},member.cookie);await beat();const delayRoom=await room('Five minute mobile handoff'),delayed=await send(delayRoom,{mentions:[member.user.id]});
 await until(async()=>(await phoneRow(delayed))?.held_at,'delayed mobile hold');const hiddenAt=Date.now();await beat(false);
 await deliveryBrowser(c);
 await pause(Math.max(0,hiddenAt+299000-Date.now()));assert.equal((await phoneRow(delayed)).state,'pending','five-minute choice holds through 299 seconds');
 await until(async()=>(await phoneRow(delayed))?.state==='sent','five-minute delay releases on real alarm',15000);const delayedAlert=count(delayed).find(r=>r.endpoint===phone.subscription.endpoint);assert.ok(delayedAlert.at-hiddenAt>=300000);await read(delayRoom);
 await call('/api/notify','PATCH',{mobileDelayMinutes:0},member.cookie);await call('/api/devices','DELETE',{id:phone.id},member.cookie);
 c.t.diagnostic('NOOK-073: desktop+in-app DM/mention, mobile hold/read cancellation, idle, real expiry, real five-minute delay, always-mobile, urgent bypass, revoked heartbeat and delivery UI at both widths.');
}
