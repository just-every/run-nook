import assert from 'node:assert/strict'

export async function channelLifecycleJourney({post,patch,get,registered,check}){
 const a=await registered('ChannelManager'),b=await registered('ChannelColleague'),x=await registered('ChannelOutside')
 const details=async(id,actor=a)=>(await get(`/api/channels/${id}/details`,actor.cookie)).data
 const publicRoom=(await post('/api/conversations',{name:'Launch operations',kind:'channel',participants:[b.user.id]},a.cookie)).data
 const privateRoom=(await post('/api/conversations',{name:'Leadership handoff',kind:'private',participants:[b.user.id]},a.cookie)).data
 await check('NOOK-016 public/private leave, current access and manager transfer preserve history',async()=>{
  const message=(await post(`/api/conversations/${publicRoom.id}/messages`,{body:'The rollout checklist stays with the team',intent:crypto.randomUUID()},a.cookie)).data
  await post(`/api/channels/${privateRoom.id}/leave`,{version:(await details(privateRoom.id)).version},a.cookie,409)
  const transfer=await details(privateRoom.id)
  await post(`/api/channels/${privateRoom.id}/transfer`,{version:transfer.version,user:b.user.id},a.cookie)
  await post(`/api/channels/${privateRoom.id}/leave`,{version:(await details(privateRoom.id)).version},a.cookie)
  assert.ok(!(await get('/api/conversations',a.cookie)).data.some(c=>c.id===privateRoom.id))
  await get(`/api/conversations/${privateRoom.id}/messages`,a.cookie,403)
  await post(`/api/channels/${privateRoom.id}/join`,{},a.cookie,404)
  await post(`/api/conversations/${privateRoom.id}/members`,{user:a.user.id},b.cookie)
  assert.equal((await details(privateRoom.id,b)).manager,b.user.id)
  await post(`/api/channels/${publicRoom.id}/leave`,{version:(await details(publicRoom.id,b)).version},b.cookie)
  await get(`/api/conversations/${publicRoom.id}/messages`,b.cookie,403)
  assert.ok(!(await get('/api/attention',b.cookie)).data.items.some(i=>i.conversation===publicRoom.id))
  await post(`/api/channels/${publicRoom.id}/join`,{},b.cookie)
  assert.ok((await get(`/api/conversations/${publicRoom.id}/messages`,b.cookie)).data.some(m=>m.id===message.id&&m.body===message.body))
  await get(`/api/channels/${privateRoom.id}/details`,x.cookie,403)
  const dm=(await post('/api/conversations',{name:'Fixed participants',kind:'dm',participants:[b.user.id]},a.cookie)).data
  await post(`/api/channels/${dm.id}/leave`,{version:1},a.cookie,403)
 })
 await check('NOOK-060 versioned channel details, archive/restore and archived write refusal',async()=>{
  const before=await details(publicRoom.id)
  await patch(`/api/channels/${publicRoom.id}`,{version:before.version,name:'Launch readiness',topic:'Support handoff and rollout windows'},a.cookie)
  await patch(`/api/channels/${publicRoom.id}`,{version:before.version,topic:'Stale overwrite'},a.cookie,409)
  const changed=await details(publicRoom.id)
  assert.equal(changed.name,'Launch readiness');assert.equal(changed.topic,'Support handoff and rollout windows')
  const payload={body:'A durable message before archive',intent:crypto.randomUUID()},message=(await post(`/api/conversations/${publicRoom.id}/messages`,payload,a.cookie)).data
  await post(`/api/channels/${publicRoom.id}/archive`,{version:changed.version,archived:true},a.cookie)
  const frontier=(await get(`/api/conversations/${publicRoom.id}/replay`,a.cookie)).data.frontier
  await post(`/api/conversations/${publicRoom.id}/messages`,{body:'Refused after archive',intent:crypto.randomUUID()},b.cookie,409)
  await post(`/api/conversations/${publicRoom.id}/messages`,{body:'Refused thread reply',parent:message.id,intent:crypto.randomUUID()},b.cookie,409)
  await patch(`/api/messages/${message.id}`,{version:1,body:'Refused edit'},a.cookie,409)
  await post(`/api/messages/${message.id}/reactions`,{emoji:'👍',add:true},b.cookie,409)
  assert.equal((await get(`/api/conversations/${publicRoom.id}/replay`,a.cookie)).data.frontier,frontier,'refused archive writes produce no event')
  assert.equal((await post(`/api/conversations/${publicRoom.id}/messages`,payload,a.cookie)).data.id,message.id,'committed intents still reconcile')
  assert.ok((await get(`/api/conversations/${publicRoom.id}/messages`,b.cookie)).data.some(m=>m.id===message.id))
  const archived=await details(publicRoom.id)
  await post(`/api/channels/${publicRoom.id}/archive`,{version:archived.version,archived:false},a.cookie)
  await post(`/api/conversations/${publicRoom.id}/messages`,{body:'Posting resumes after restore',intent:crypto.randomUUID()},b.cookie)
 })
}
