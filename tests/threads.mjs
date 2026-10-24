import assert from 'node:assert/strict'

export async function threadJourney({post,patch,get,registered,check,restart,validateArchive}){
 const a=await registered('ThreadA'),b=await registered('ThreadB'),c=await registered('ThreadC')
 const room=(await post('/api/conversations',{name:'Launch coordination',kind:'private',participants:[b.user.id,c.user.id]},a.cookie)).data
 const send=async(actor,body,parent=null,mentions=[]) => (await post(`/api/conversations/${room.id}/messages`,{body,parent,mentions,intent:crypto.randomUUID()},actor.cookie)).data
 const prefs=async actor=>(await get(`/api/conversations/${room.id}/preferences`,actor.cookie)).data
 const source=async(actor,id)=>(await prefs(actor)).threadFollows.find(f=>f.message===id)?.source
 const list=async actor=>(await get('/api/threads',actor.cookie)).data.items
 await check('NOOK-070 one thread broadcast shares channel history, edit, delete and notification identity',async()=>{
  const root=await send(a,'synthetic-nook broadcast root');
  const payload={body:'synthetic-nook broadcast reply',parent:root.id,channelBroadcast:true,intent:crypto.randomUUID()};
  const broadcast=(await post(`/api/conversations/${room.id}/messages`,payload,b.cookie)).data;
  assert.equal((await post(`/api/conversations/${room.id}/messages`,payload,b.cookie)).data.id,broadcast.id);
  await post(`/api/conversations/${room.id}/messages`,{...payload,channelBroadcast:false},b.cookie,409);
  const channel=()=>get(`/api/conversations/${room.id}/messages/window`,a.cookie).then(r=>r.data.items.filter(m=>m.id===broadcast.id));
  const thread=()=>get(`/api/conversations/${room.id}/messages/window?thread=${root.id}`,a.cookie).then(r=>r.data.items.filter(m=>m.id===broadcast.id));
  assert.equal((await channel()).length,1);assert.equal((await thread()).length,1);
  assert.equal((await get('/api/search?q=synthetic-nook%20broadcast%20reply',a.cookie)).data.items.filter(m=>m.id===broadcast.id).length,1);
  assert.equal((await get('/api/attention',a.cookie)).data.items.filter(i=>i.message?.id===broadcast.id).length,1);
  if(validateArchive)await validateArchive();
  await patch('/api/messages/'+broadcast.id,{body:'synthetic-nook edited broadcast',version:1},b.cookie);
  assert.equal((await channel())[0].body,'synthetic-nook edited broadcast');assert.equal((await thread())[0].body,'synthetic-nook edited broadcast');
  await patch('/api/messages/'+broadcast.id,{delete:true,version:2},b.cookie);
  assert.equal((await channel())[0].deleted,1);assert.equal((await thread())[0].deleted,1);
 });
 await check('NOOK-072 automatic follows, sticky unfollow, DM default and atomic retry',async()=>{
  const root=await send(a,'Review the launch brief')
  assert.equal(await source(a,root.id),'authored')
  const reply=await send(b,'The rollout window works',root.id)
  assert.equal(await source(b,root.id),'replied')
  assert.equal((await get('/api/attention',a.cookie)).data.items.find(i=>i.message?.id===reply.id)?.reason,'thread-follow')
  await send(a,'Please check the support handoff',root.id,[c.user.id])
  assert.equal(await source(c,root.id),'mentioned')
  await post(`/api/messages/${root.id}/follow`,{follow:false},c.cookie)
  const mention=await send(a,'Can you confirm?',root.id,[c.user.id])
  assert.equal(await source(c,root.id),undefined)
  assert.equal((await get('/api/attention',c.cookie)).data.items.find(i=>i.message?.id===mention.id)?.reason,'mention')
  const plain=await send(b,'Final checklist is ready',root.id)
  assert.ok(!(await get('/api/attention',c.cookie)).data.items.some(i=>i.message?.id===plain.id))
  await send(c,'Confirmed',root.id)
  assert.equal(await source(c,root.id),'replied')
  const dm=(await post('/api/conversations',{name:'Launch DM',kind:'dm',participants:[b.user.id]},a.cookie)).data
  const payload={body:'Can we talk?',intent:crypto.randomUUID()}
  const dmRoot=(await post(`/api/conversations/${dm.id}/messages`,payload,a.cookie)).data
  assert.equal((await post(`/api/conversations/${dm.id}/messages`,payload,a.cookie)).data.id,dmRoot.id)
  assert.equal((await get(`/api/conversations/${dm.id}/preferences`,b.cookie)).data.threadFollows.find(f=>f.message===dmRoot.id)?.source,'dm')
  assert.equal((await get(`/api/conversations/${dm.id}/preferences`,b.cookie)).data.threads.filter(id=>id===dmRoot.id).length,1)
 })
 await check('NOOK-032 web levels, all-thread replies, reset, quiet triage and current ACL',async()=>{
  const room=(await post('/api/conversations',{name:'Incident policy',kind:'private',participants:[b.user.id,c.user.id]},a.cookie)).data
  const path=`/api/conversations/${room.id}/notify`
  const send=async(body,parent=null,mentions=[]) => (await post(`/api/conversations/${room.id}/messages`,{body,parent,mentions,intent:crypto.randomUUID()},b.cookie)).data
  const attention=async()=>(await get('/api/attention',c.cookie)).data.items
  assert.equal((await get(path,c.cookie)).data.level,'mentions')
  assert.equal((await patch(path,{mobileLevel:'all'},c.cookie)).data.mobileLevel,'all')
  await patch(path,{threads:null},c.cookie,400)
  await patch(path,{level:'all',threads:'followed'},c.cookie)
  const root=await send('A fresh incident')
  assert.equal((await attention()).find(i=>i.message?.id===root.id)?.reason,'all-messages')
  const plain=await send('An ordinary thread reply',root.id)
  assert.ok(!(await attention()).some(i=>i.message?.id===plain.id),'all new messages does not subscribe to every thread')
  await patch(path,{threads:'all'},c.cookie)
  const reply=await send('All thread replies now enabled',root.id)
  assert.equal((await attention()).find(i=>i.message?.id===reply.id)?.reason,'thread-follow')
  assert.equal((await list(c)).find(t=>t.root.id===root.id)?.source,'all')
  await post(`/api/messages/${root.id}/follow`,{follow:false},c.cookie)
  const ignored=await send('An unfollowed reply',root.id)
  assert.ok(!(await attention()).some(i=>i.message?.id===ignored.id))
  assert.ok(!(await list(c)).some(t=>t.root.id===root.id))
  const mentioned=await send('Please check',root.id,[c.user.id])
  assert.equal((await attention()).find(i=>i.message?.id===mentioned.id)?.reason,'mention')
  assert.ok(!(await list(c)).some(t=>t.root.id===root.id),'mention does not undo a sticky unfollow')
  await patch(`/api/conversations/${room.id}/preferences`,{muted:true},c.cookie)
  assert.equal((await get(path,c.cookie)).data.level,'mentions','mute clears all new messages')
  assert.ok(!(await list(c)).some(t=>t.conversation.id===room.id))
  await patch(path,{level:'all'},c.cookie)
  assert.equal((await get(`/api/conversations/${room.id}/preferences`,c.cookie)).data.muted,false)
  await post(`/api/messages/${root.id}/follow`,{follow:true},c.cookie)
  await patch(path,{level:'nothing'},c.cookie)
  const silent=await send('Still explicitly mentioned',root.id,[c.user.id])
  assert.equal((await attention()).find(i=>i.message?.id===silent.id)?.reason,'mention')
  assert.ok((await list(c)).some(t=>t.root.id===root.id),'nothing preserves the Threads view')
  assert.ok((await get('/api/notify/conversations',c.cookie)).data.some(row=>row.conversation===room.id))
  if(restart)await restart()
  assert.equal((await get(path,c.cookie)).data.level,'nothing')
  await patch(path,{reset:true},c.cookie)
  assert.equal((await get(path,c.cookie)).data.threads,'followed')
  assert.equal((await get(path,c.cookie)).data.level,'mentions')
  assert.ok(!(await get('/api/notify/conversations',c.cookie)).data.some(row=>row.conversation===room.id))
  const dm=(await post('/api/conversations',{name:'Default DM policy',kind:'dm',participants:[b.user.id]},a.cookie)).data
  assert.equal((await get(`/api/conversations/${dm.id}/notify`,a.cookie)).data.level,'all')
  await get(`/api/conversations/${dm.id}/notify`,c.cookie,403)
  await post(`/api/conversations/${room.id}/members`,{user:c.user.id,remove:true},a.cookie)
  await get(path,c.cookie,403)
  await patch(path,{level:'all'},c.cookie,403)
  assert.ok(!(await get('/api/notify/conversations',c.cookie)).data.some(row=>row.conversation===room.id))
 })
 await check('NOOK-071 paged Threads, isolated read, restart, mute and membership loss',async()=>{
  const root=await send(a,'Thread with an unread reply'),other=await send(a,'Keep this separate')
  const reply=await send(b,'I checked the packet',root.id),otherReply=await send(b,'This still needs reading',other.id)
  assert.equal((await list(a)).find(t=>t.root.id===root.id).unread,1)
  const attention=(await get('/api/attention',a.cookie)).data.items.map(i=>i.id)
  await post(`/api/messages/${root.id}/read`,{seq:otherReply.sequence},a.cookie,400)
  const separate=(await post('/api/conversations',{name:'Separate thread scope',kind:'private'},a.cookie)).data
  await post(`/api/messages/${root.id}/read`,{seq:reply.sequence,conversation:separate.id},a.cookie,404)
  await post(`/api/messages/${root.id}/read`,{seq:reply.sequence,conversation:room.id},a.cookie)
  assert.equal((await list(a)).find(t=>t.root.id===root.id).unread,0)
  assert.equal((await list(a)).find(t=>t.root.id===other.id).unread,1)
  assert.deepEqual((await get('/api/attention',a.cookie)).data.items.map(i=>i.id),attention,'read never closes attention')
  if(restart)await restart()
  assert.equal((await list(a)).find(t=>t.root.id===root.id).unread,0)
  const first=(await get('/api/threads?limit=1',a.cookie)).data
  assert.equal(first.items.length,1);assert.ok(first.hasMore)
  const next=(await get('/api/threads?limit=1&after='+encodeURIComponent(first.cursor),a.cookie)).data
  assert.notEqual(first.items[0].root.id,next.items[0].root.id)
  await patch(`/api/conversations/${room.id}/preferences`,{muted:true},c.cookie)
  assert.ok(!(await list(c)).some(t=>t.root.conversation===room.id))
  await post(`/api/messages/${root.id}/follow`,{follow:true},c.cookie)
  assert.ok((await list(c)).some(t=>t.root.id===root.id&&t.source==='explicit'))
  await post(`/api/conversations/${room.id}/members`,{user:c.user.id,remove:true},a.cookie)
  assert.ok(!(await list(c)).some(t=>t.root.conversation===room.id))
  await post(`/api/messages/${root.id}/read`,{seq:reply.sequence,conversation:room.id},c.cookie,403)
  await post(`/api/messages/${root.id}/read`,{seq:reply.sequence},c.cookie,404)
 })
}
