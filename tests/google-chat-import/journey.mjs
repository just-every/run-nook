import assert from 'node:assert/strict';
import {googleChatFixture} from './fixture.mjs';
import {importDoorClient,importUsers} from '../import-door-support.mjs';
import {invite} from '../auth-support.mjs';
export async function googleChatJourney({origin,owner,sql,restart,check,validateArchive}){
 await check('NOOK-043 Google Chat Takeout reviewed audiences, threads, files, resume and guarded undo',async()=>{
  const member=await invite(origin,owner.cookie,'synthetic-nook-gchat-member');
  const door=importDoorClient({origin,owner,source:'gchat',users:()=>importUsers(sql)});
  await assert.rejects(()=>door.inspect(googleChatFixture({invalid:true})),/GCHAT_INVALID/);
  const source=await door.inspect(googleChatFixture());assert.equal(source.channels.length,3);assert.equal(source.omissions.length,1);
  assert.ok(!JSON.stringify(source).includes('Google Chat root'),'preview inspection contains no message text');
  const review={namespace:'synthetic-nook-gchat-'+crypto.randomUUID(),actors:Object.fromEntries(source.actors.map(a=>[a.sourceId,a.label==='synthetic-nook-1'?owner.user.id:member.user.id])),channels:source.channels.map(c=>({sourceId:c.sourceId,name:c.name,members:[owner.user.id,member.user.id]})),acceptedOmissions:[]};
  const preview=await door.prepare(source,review);assert.deepEqual(preview.summary.counts,{channels:3,actors:2,messages:6,threads:3,files:1,bytes:31,omissions:1});
  review.acceptedOmissions=[preview.summary.omissionDigest];const plan=await door.plan(source,review);
  await door.apply(plan);await restart();await door.finish(plan);
  async function get(path,actor=owner,status=200){const r=await fetch(origin+path,{headers:{cookie:actor.cookie}});assert.equal(r.status,status);return r.json()}
  const rooms=(await get('/api/conversations')).filter(c=>c.id.startsWith('gchat-'));assert.equal(rooms.length,3);
  assert.equal(rooms.filter(c=>c.kind==='dm').length,2);
  for(const room of rooms){const messages=await get('/api/conversations/'+room.id+'/messages',member);assert.equal(messages.length,2);assert.equal(messages[1].parent,messages[0].id);assert.equal(room.unread,0);}
  const fileRoom=rooms.find(c=>c.name==='synthetic-nook-space'),messages=await get('/api/conversations/'+fileRoom.id+'/messages');
  const response=await fetch(origin+'/api/attachments/'+messages[0].attachments[0].id+'/download',{headers:{cookie:member.cookie}});assert.equal(await response.text(),'synthetic-nook attachment bytes');
  await validateArchive();
  const outsider=await invite(origin,owner.cookie,'synthetic-nook-gchat-outsider');await get('/api/conversations/'+fileRoom.id+'/messages',outsider,403);
  assert.equal((await get('/api/search?q=synthetic-nook%20Google%20Chat',outsider)).items.length,0);
  await door.finish(plan);assert.equal((await get('/api/conversations/'+fileRoom.id+'/messages')).length,2);
  const native=await fetch(origin+'/api/conversations/'+fileRoom.id+'/messages',{method:'POST',headers:{cookie:owner.cookie,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({body:'synthetic-nook native reply survives',parent:messages[0].id,intent:crypto.randomUUID()})});assert.equal(native.status,200);
  const conflict=await door.request('undo',{planId:plan.planId},{status:409});assert.match(conflict.error,/native_edit_conflict/);
  assert.equal((await get('/api/conversations/'+fileRoom.id+'/messages')).length,3);
 });
}
