import assert from 'node:assert/strict'
export async function unreadsJourney({post,get,request,owner,member,outsider,check,restart,sql,registered,validateArchive}){
 await check('NOOK-071 unread paging, isolated reads and generation-safe ten-second undo',async()=>{
  const room=(await post('/api/conversations',{name:'Autumn customer launch',kind:'private',participants:[member.user.id]})).data
  const send=async(body,parent)=>(await post(`/api/conversations/${room.id}/messages`,{body,parent,intent:crypto.randomUUID()},member.cookie)).data
  const root=await send('Support has the rollout checklist ready.'),reply=await send('The help centre update is ready for review.',root.id)
  await post(`/api/conversations/${room.id}/messages`,{body:'My own update',intent:crypto.randomUUID()})
  const before=(await get('/api/attention')).data.items
  assert.deepEqual((await get('/api/unreads?conversation='+room.id)).data.items.map(r=>r.id),[root.id,reply.id])
  await get('/api/unreads?conversation='+room.id,outsider.cookie,403)
  const first=(await post('/api/unreads',{action:'read',conversation:room.id})).data
  assert.equal((await get('/api/unreads?conversation='+room.id)).data.items.length,0)
  const later=await send('Customer success has confirmed the final audience.')
  await post('/api/unreads',{action:'undo',token:first.token})
  assert.deepEqual((await get('/api/unreads?conversation='+room.id)).data.items.map(r=>r.id),[root.id,reply.id,later.id])
  assert.deepEqual((await get('/api/attention')).data.items,before)
  const second=(await post('/api/unreads',{action:'read',conversation:room.id})).data
  await post(`/api/conversations/${room.id}/read`,{seq:later.sequence})
  await post('/api/unreads',{action:'undo',token:second.token})
  assert.equal((await get('/api/unreads?conversation='+room.id)).data.items.length,0,'a later read on any session wins')
  await send('Another unread update')
  const third=(await post('/api/unreads',{action:'read',conversation:room.id})).data
  await post('/api/unreads',{action:'undo',token:third.token},member.cookie,409)
  await sql(`UPDATE nook_read_undo SET expires=0 WHERE id='${third.token}'`)
  await post('/api/unreads',{action:'undo',token:third.token},owner.cookie,409)
  await send('A final unread update')
  const fourth=(await post('/api/unreads',{action:'read',conversation:room.id})).data
  await restart()
  await post('/api/unreads',{action:'undo',token:fourth.token})
  assert.ok((await get('/api/unreads?conversation='+room.id)).data.items.length)
  await post(`/api/conversations/${room.id}/members`,{user:member.user.id,remove:true})
  await get('/api/unreads?conversation='+room.id,member.cookie,403)
 })
 await check('NOOK-071 group DM conversion moves full history once and fences the fixed source',async()=>{
  const third=(await post('/api/conversations',{name:'Migration planning',kind:'dm',participants:[member.user.id,outsider.user.id]})).data
  const message=(await post(`/api/conversations/${third.id}/messages`,{body:'Migrate the three-person planning conversation without widening its audience.',intent:crypto.randomUUID()})).data
  const reply=(await post(`/api/conversations/${third.id}/messages`,{body:'Keep the discussion and the decision together.',parent:message.id,intent:crypto.randomUUID()},member.cookie)).data
  await post(`/api/messages/${message.id}/reactions`,{emoji:'👍',add:true},member.cookie)
  const converted=(await post(`/api/conversations/${third.id}/convert`,{name:'proj-autumn',version:1},member.cookie)).data
  assert.equal((await post(`/api/conversations/${third.id}/convert`,{name:'proj-autumn',version:1})).data.id,converted.id)
  assert.deepEqual((await get(`/api/conversations/${converted.id}/messages`)).data.map(m=>m.id),[message.id,reply.id])
  assert.deepEqual(new Set((await get(`/api/conversations/${converted.id}/members`)).data.map(m=>m.id)),new Set([owner.user.id,member.user.id,outsider.user.id]))
  assert.equal((await get(`/api/conversations/${third.id}/messages`)).data.length,0)
  await post(`/api/conversations/${third.id}/messages`,{body:'Refused after conversion',intent:crypto.randomUUID()},owner.cookie,409)
  const conversations=(await get('/api/conversations')).data
  assert.equal(conversations.find(c=>c.id===third.id).convertedTo,converted.id)
  assert.equal(conversations.find(c=>c.id===converted.id).convertedFrom,third.id)
  assert.equal((await get('/api/messages/'+message.id)).data.reactions[0].count,1)
  await restart()
  assert.equal((await get(`/api/conversations/${converted.id}/messages`)).data.length,2)
 })
 await check('NOOK-071 conversion preserves offboarded creator history without restoring access',async()=>{
  const former=await registered('FormerPlanner'+Date.now())
  const dm=(await post('/api/conversations',{name:'Original planning group',kind:'dm',participants:[owner.user.id,member.user.id]},former.cookie)).data
  const original=(await post(`/api/conversations/${dm.id}/messages`,{body:'The original audience and full history must survive offboarding.',intent:crypto.randomUUID()},former.cookie)).data
  await post('/auth/operator/status',{operatorId:former.user.id,status:'inactive'})
  const source=(await get('/api/conversations')).data.find(c=>c.id===dm.id)
  const moved=(await post(`/api/conversations/${dm.id}/convert`,{name:'planning-continuity',version:source.version})).data
  assert.equal(moved.owner,owner.user.id)
  assert.equal((await get(`/api/conversations/${moved.id}/messages`)).data[0].id,original.id)
  const roster=(await get(`/api/conversations/${moved.id}/roster`)).data
  assert.deepEqual(new Set(roster.map(p=>p.id)),new Set([owner.user.id,member.user.id,former.user.id]))
  assert.equal(roster.find(p=>p.id===former.user.id).active,0)
  assert.ok(!(await get(`/api/conversations/${moved.id}/members`)).data.some(p=>p.id===former.user.id))
  await get(`/api/conversations/${moved.id}/messages`,former.cookie,401)
  await post('/auth/operator/status',{operatorId:former.user.id,status:'active'})
  const safe=(await post('/api/conversations',{name:'Explicit reentry channel',kind:'private'})).data
  await post('/api/team/access',{user:former.user.id,mode:'member',scopes:[safe.id]})
  const {signIn}=await import('./auth-support.mjs')
  // The normal invitation address is available through the owner-only directory.
  const account=(await get('/api/team')).data.find(p=>p.id===former.user.id)
  const origin=new URL((await get('/api/me')).response.url).origin
  const fresh=await signIn(origin,account.email)
  await get(`/api/conversations/${moved.id}/messages`,fresh.cookie,403)
  await get(`/api/conversations/${dm.id}/messages`,fresh.cookie,403)
  assert.ok(!(await get('/api/conversations',fresh.cookie)).data.some(c=>c.id===moved.id))
  await validateArchive()
  await post(`/api/conversations/${moved.id}/members`,{user:former.user.id})
  assert.equal((await get(`/api/conversations/${moved.id}/messages`,fresh.cookie)).data[0].body,original.body)
  await validateArchive()
  await restart()
  assert.equal((await get(`/api/conversations/${moved.id}/roster`)).data.find(p=>p.id===former.user.id).active,1)
 })

}
