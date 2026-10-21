import assert from 'node:assert/strict';
import {deliveries} from './retention.mjs';
import {until} from './fixture.mjs';
export async function erasure(c){
 const {call,db,member,sender,ownerCookie,room,send,rows,register}=c;
 const quiet=Date.now()+120_000;await call('/api/settings','PATCH',{dndUntil:quiet},member.cookie);
 const conversation=await room('Erasure push state');
 const preserved=await send(conversation,{mentions:[member.user.id]},ownerCookie),message=await send(conversation,{mentions:[member.user.id]});assert.equal((await rows(message)).length,1);
 const erase=async(kind,target)=>{
  await call('/api/erasures/preview','POST',{kind,target},ownerCookie);
  let receipt=await call('/api/erasures','POST',{kind,target,confirmation:'ERASE'},ownerCookie);
  for(let i=0;receipt.state!=='complete'&&i<30;i++)receipt=await call(`/api/erasures/${receipt.id}/resume`,'POST',{},ownerCookie);
  assert.equal(receipt.state,'complete');return receipt;
 };
 c.erase=erase;c.removedRecords=[];
 await c.read(conversation);
 const beforeMessage=(await deliveries(c,conversation)).filter(r=>r.id.startsWith('push:'+message.id+':'));assert.ok(beforeMessage.length>0,'message erasure has positive retained records before');
 const control=(await deliveries(c,conversation)).filter(r=>r.id.startsWith('push:'+preserved.id+':'));assert.ok(control.length>0,'unaffected owner source has positive records');
 c.erasedSourceRecord=await db.prepare('SELECT * FROM nook_push_delivery_records WHERE message=?').bind(message.id).first();
 await erase('message',message.id);
 assert.equal((await db.prepare('SELECT count(*) AS n FROM nook_push_delivery_records WHERE message=?').bind(message.id).first()).n,0);
 assert.ok(!(await deliveries(c,conversation)).some(r=>beforeMessage.some(b=>b.id===r.id)));c.removedRecords.push(...beforeMessage.map(r=>r.id));
assert.deepEqual(await rows(message),[]);assert.equal((await rows(preserved)).length,1,'unrelated message delivery survives message erasure');
 const device=await register(sender,'erased-sender'),phone=await register(sender,'erased-sender-phone',undefined,'mobile');await call('/api/notify','PATCH',{push:{mentions:true}},sender.cookie);await call('/api/settings','PATCH',{dndUntil:quiet},sender.cookie);
 await call('/api/devices/presence','POST',{id:device.id,page:crypto.randomUUID(),visible:true,lastInputAt:Date.now()},sender.cookie);
 const quietSettings=(await call('/api/notify','GET',undefined,sender.cookie)).quietSchedule;delete quietSettings.until;delete quietSettings.next;await call('/api/notify','PATCH',{quietSchedule:quietSettings},sender.cookie)
 await call(`/api/conversations/${conversation.id}/members`,'POST',{user:c.unrelated.user.id},ownerCookie);
 await register(c.unrelated,'second-recipient');await call('/api/notify','PATCH',{push:{mentions:true}},c.unrelated.cookie);await call('/api/settings','PATCH',{dndUntil:quiet},c.unrelated.cookie);
 const secondControl=await send(conversation,{mentions:[c.unrelated.user.id]},ownerCookie);
 const incoming=await send(conversation,{mentions:[sender.user.id]},ownerCookie),outgoing=await send(conversation,{mentions:[member.user.id,c.unrelated.user.id]});
 const outcome=await call(`/api/conversations/${conversation.id}/outcomes`,'POST',{kind:'commitment',body:'PRIVATE-ERASED-COMMITMENT',assignee:member.user.id},sender.cookie);
 assert.equal((await db.prepare("SELECT count(*) AS n FROM nook_notify_queue WHERE channel='push' AND outcome=?").bind(outcome.id).first()).n,1);
 assert.equal((await rows(incoming)).length,2);assert.equal((await rows(outgoing)).length,2);
 await c.read(conversation,sender);
 const ownBefore=(await deliveries({call,member:sender},conversation));assert.ok(ownBefore.some(r=>r.device===phone.id&&r.error==='held-active-elsewhere'),'sender has a positive owned canceled activity hold');
 let otherOutcome=await call(`/api/conversations/${conversation.id}/outcomes`,'POST',{kind:'commitment',body:'Other author completion survives',assignee:sender.user.id},member.cookie);
 otherOutcome=await call('/api/outcomes/'+otherOutcome.id,'PATCH',{version:otherOutcome.version,action:'accept'},sender.cookie);
 otherOutcome=await call('/api/outcomes/'+otherOutcome.id,'PATCH',{version:otherOutcome.version,action:'complete'},sender.cookie);
 const proposal=(await db.prepare('SELECT attention FROM nook_notify_queue WHERE outcome=?').bind(outcome.id).first()).attention;await call('/api/attention/'+proposal,'POST',{action:'done'},member.cookie);
 const before=(await deliveries(c,conversation)),caused=(await db.prepare('SELECT id,message,outcome FROM nook_push_delivery_records WHERE actor=? AND user<>?').bind(sender.user.id,sender.user.id).all()).results;
 for(const id of c.presenceSources)assert.ok(caused.some(r=>r.message===id)&&before.some(r=>caused.some(k=>k.message===id&&k.id===r.id)),'sender-caused phone history is positive before erasure');
 for(const id of [outcome.id,otherOutcome.id])assert.ok(caused.some(r=>r.outcome===id)&&before.some(r=>caused.some(k=>k.outcome===id&&k.id===r.id)),'proposal/completion history positive before');
 const secondBefore=await deliveries({call,member:c.unrelated},conversation);assert.ok(secondBefore.some(r=>r.id.startsWith('push:'+outgoing.id+':')),'second recipient positive before');
 c.removedRecords.push(...ownBefore.map(r=>r.id),...caused.map(r=>r.id));
 await erase('member',sender.user.id);
 assert.equal((await db.prepare('SELECT count(*) AS n FROM nook_push_delivery_records WHERE actor=? OR user=?').bind(sender.user.id,sender.user.id).first()).n,0,'every recipient loses sender-caused routing history');
 const secondAfter=await deliveries({call,member:c.unrelated},conversation);assert.ok(!secondAfter.some(r=>c.removedRecords.includes(r.id)));assert.ok(secondAfter.some(r=>r.id.startsWith('push:'+secondControl.id+':')),'second recipient unrelated control survives');
 await c.read(conversation,c.unrelated);await until(async()=>(await rows(secondControl)).every(r=>r.state==='cancelled'),'unaffected second-recipient control settles by public read');
 const after=await deliveries(c,conversation);assert.ok(!after.some(r=>c.removedRecords.includes(r.id)));for(const r of control)assert.ok(after.some(a=>a.id===r.id),'unrelated owner routing record survives');
 assert.equal((await db.prepare('SELECT status FROM nook_outcomes WHERE id=?').bind(otherOutcome.id).first()).status,'reported-complete','other-author work survives causing-member erasure');

 for(const table of ['nook_push_devices','nook_push_presence','nook_notify_preferences','nook_quiet_schedules','nook_push_delivery_records'])assert.equal((await db.prepare(`SELECT count(*) AS n FROM ${table} WHERE user=?`).bind(sender.user.id).first()).n,0);
 assert.equal((await db.prepare('SELECT count(*) AS n FROM nook_notify_queue WHERE user=? OR actor=? OR outcome=?').bind(sender.user.id,sender.user.id,outcome.id).first()).n,0,'member and authored-outcome delivery state is erased');
 assert.equal((await db.prepare('SELECT count(*) AS n FROM nook_erased_outcomes WHERE id=?').bind(outcome.id).first()).n,1,'authored outcome follows public member erasure');
 assert.equal((await rows(preserved)).length,1);assert.equal((await call('/api/devices','GET',undefined,member.cookie)).devices.length,1);assert.equal((await call('/api/notify','GET',undefined,member.cookie)).push.mentions,true);
 c.preserved=preserved;c.archiveConversation=conversation;
 c.t.diagnostic('Erasure: public message erasure and member erasure removed recipient/sender/device/presence/preferences and authored-outcome delivery state while unrelated subscription, preferences and queue row survived.');
}
