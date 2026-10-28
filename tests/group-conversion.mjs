import assert from 'node:assert/strict'

// Use a fresh Worker/database: other suites deliberately alter due-time fixtures.
export async function offboardedConversion({post,get,owner,member,registered,check,restart,validateArchive}){
 await check('NOOK-121 conversion preserves offboarded creator history without restoring access',async()=>{
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
