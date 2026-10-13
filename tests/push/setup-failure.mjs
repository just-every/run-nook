import assert from 'node:assert/strict';
import {until} from './fixture.mjs';
export async function setupFailure(c){
 const {call,db,member,sender,unrelated,room,send,rows,received,signIn,withRotatedSecret}=c;
 const conversation=await room('Lost VAPID wrapping key'),before=received.length;
 // This models an operator's real configuration mistake: change the wrapping
 // secret while keeping the sealed instance VAPID key and D1/R2 unchanged.
 // Reauthenticate through normal magic links under that configuration. No
 // credentials, delivery rows or error states are fabricated or printed.
 await withRotatedSecret(async()=>{
  const recipient=await signIn('recipient@example.test'),author=await signIn('sender@example.test'),owner=await signIn('owner@example.test'),other=await signIn('unrelated@example.test');
  assert.equal(recipient.user.id,member.user.id);assert.equal(author.user.id,sender.user.id);assert.equal(other.user.id,unrelated.user.id);
  const message=await send(conversation,{mentions:[member.user.id]},author.cookie);
  await until(async()=>(await rows(message))[0]?.state==='failed','real sealed-key setup failure');
  const [row]=await rows(message);assert.equal(row.error,'not-set-up');assert.equal(row.attempts,1);assert.equal(received.length,before,'unusable key never reaches vendor edge');
  const mine=(await call('/api/notify','GET',undefined,recipient.cookie)).push,caused=(await call('/api/notify','GET',undefined,author.cookie)).push,workspace=(await call('/api/notify','GET',undefined,owner.cookie)).push,unrelatedStatus=(await call('/api/notify','GET',undefined,other.cookie)).push;
  assert.ok(mine.problems.some(p=>p.error==='not-set-up'&&p.state==='failed'));assert.ok(caused.notDelivered.some(p=>p.error==='not-set-up'&&p.state==='failed'));assert.equal(workspace.workspace.error,'not-set-up');assert.equal(workspace.workspace.state,'failed');assert.deepEqual(unrelatedStatus.problems,[]);assert.deepEqual(unrelatedStatus.notDelivered,[]);assert.equal(unrelatedStatus.workspace,null);
  assert.equal((await db.prepare('SELECT count(*) AS n FROM nook_push_secrets').first()).n,1,'original sealed key remains in place');
 });
 c.t.diagnostic('Not-set-up: real SESSION_SECRET rotation on the same D1/R2 makes the sealed VAPID key unusable; normal magic-link reauthentication observes failure for recipient/distinct sender/owner only, with zero vendor packets. Original binding restored afterward.');
}
