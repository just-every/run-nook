import assert from 'node:assert/strict';
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
 await erase('message',message.id);assert.deepEqual(await rows(message),[]);assert.equal((await rows(preserved)).length,1,'unrelated message delivery survives message erasure');
 const device=await register(sender,'erased-sender');await call('/api/notify','PATCH',{push:{mentions:true}},sender.cookie);await call('/api/settings','PATCH',{dndUntil:quiet},sender.cookie);
 await call('/api/devices/presence','POST',{id:device.id,page:crypto.randomUUID(),visible:true},sender.cookie);
 const quietSettings=(await call('/api/notify','GET',undefined,sender.cookie)).quietSchedule;delete quietSettings.until;delete quietSettings.next;await call('/api/notify','PATCH',{quietSchedule:quietSettings},sender.cookie)
 const incoming=await send(conversation,{mentions:[sender.user.id]},ownerCookie),outgoing=await send(conversation,{mentions:[member.user.id]});
 const outcome=await call(`/api/conversations/${conversation.id}/outcomes`,'POST',{kind:'commitment',body:'PRIVATE-ERASED-COMMITMENT',assignee:member.user.id},sender.cookie);
 assert.equal((await db.prepare("SELECT count(*) AS n FROM nook_notify_queue WHERE channel='push' AND outcome=?").bind(outcome.id).first()).n,1);
 assert.equal((await rows(incoming)).length,1);assert.equal((await rows(outgoing)).length,1);
 await erase('member',sender.user.id);
 for(const table of ['nook_push_devices','nook_push_presence','nook_notify_preferences','nook_quiet_schedules','nook_push_delivery_records'])assert.equal((await db.prepare(`SELECT count(*) AS n FROM ${table} WHERE user=?`).bind(sender.user.id).first()).n,0);
 assert.equal((await db.prepare('SELECT count(*) AS n FROM nook_notify_queue WHERE user=? OR actor=? OR outcome=?').bind(sender.user.id,sender.user.id,outcome.id).first()).n,0,'member and authored-outcome delivery state is erased');
 assert.equal((await db.prepare('SELECT count(*) AS n FROM nook_erased_outcomes WHERE id=?').bind(outcome.id).first()).n,1,'authored outcome follows public member erasure');
 assert.equal((await rows(preserved)).length,1);assert.equal((await call('/api/devices','GET',undefined,member.cookie)).devices.length,1);assert.equal((await call('/api/notify','GET',undefined,member.cookie)).push.mentions,true);
 c.preserved=preserved;c.archiveConversation=conversation;
 c.t.diagnostic('Erasure: public message erasure and member erasure removed recipient/sender/device/presence/preferences and authored-outcome delivery state while unrelated subscription, preferences and queue row survived.');
}
