import assert from 'node:assert/strict'
import {signIn} from './auth-support.mjs'
export async function profilesJourney({post,get,request,sql,owner,member,outsider,check,restart,origin}){
 const base=typeof origin==='function'?origin():origin
 const room=(await post('/api/conversations',{name:'Customer success people',kind:'private',participants:[member.user.id]})).data
 const email='profile-guest@example.test'
 await post('/api/team/invitations',{email,role:'member',mode:'guest',scopes:[room.id]})
 await post('/auth/invite',{email,displayName:'Customer guest',role:'member'},owner.cookie,202)
 const guest=await signIn(base,email,{requestLink:false})
 await check('NOOK-017 profiles, time-zone status expiry, field visibility and guest-scoped directory survive restart',async()=>{
  const fields=(await get('/api/profile/fields')).data.fields
  for(const id of ['title','phone','manager','department'])assert.ok(fields.some(f=>f.id===id))
  const phone=fields.find(f=>f.id==='phone')
  await post('/api/profile/fields',{id:phone.id,label:phone.label,type:phone.type,version:phone.version,visibility:'self'},member.cookie,403)
  const {position,...editable}=phone
  await post('/api/profile/fields',{...editable,visibility:'self'})
  await post('/api/profile/fields',{...editable,visibility:'members'},owner.cookie,409)
  const profile=(await post('/api/profile',{name:'Elena Rivera',zone:'America/Los_Angeles',fields:{title:'Customer Success Lead',department:'Customer Success',phone:'+1 415 555 0132',manager:'Priya Chen'},status:{emoji:'🌴',text:'Back Monday',clearAfter:'30m'}},member.cookie)).data
  assert.equal(profile.profile.zone,'America/Los_Angeles');assert.ok(profile.profile.status.expiresAt>=Date.now()+1790000)
  assert.equal((await get('/api/profile?user='+member.user.id,guest.cookie)).data.profile.fields.some(f=>f.id==='phone'),false)
  assert.equal((await get('/api/profile?user='+member.user.id,owner.cookie)).data.profile.fields.some(f=>f.id==='phone'),false)
  assert.equal((await get('/api/people?q='+encodeURIComponent('415 555 0132'),owner.cookie)).data.items.length,0)
  assert.ok((await get('/api/people?field=department&value=Success')).data.items.some(p=>p.id===member.user.id))
  assert.ok((await get('/api/people?q=Elena',guest.cookie)).data.items.some(p=>p.id===member.user.id))
  assert.ok(!(await get('/api/people',guest.cookie)).data.items.some(p=>p.id===outsider.user.id))
  const current=(await get('/api/profile',member.cookie)).data.profile
  await post('/api/profile',{zone:'Invalid/Zone',status:{emoji:'',text:'Bad status',clearAfter:'never'}},member.cookie,400)
  assert.equal((await get('/api/profile',member.cookie)).data.profile.version,current.version)
  await restart()
  assert.equal((await get('/api/profile?user='+member.user.id)).data.profile.status.text,'Back Monday')
  // Time passage fixture; actual reads and restart must omit the expired value.
  await sql(`UPDATE nook_profiles SET status_expires=${Date.now()-1} WHERE user='${member.user.id}'`)
  await restart()
  assert.equal((await get('/api/profile',member.cookie)).data.profile.status,null)
  assert.equal((await get('/api/profile?user='+member.user.id,guest.cookie)).data.profile.status,null)
  await post('/api/conversations/'+room.id+'/members',{user:member.user.id,remove:true})
  assert.ok(!(await get('/api/people?q=Elena',guest.cookie)).data.items.some(p=>p.id===member.user.id))
  await get('/api/profile?user='+outsider.user.id,guest.cookie,404)
 })
 await check('NOOK-017 directory pages beyond 5,000 people without leaking hidden fields',async()=>{
  await sql(`WITH RECURSIVE n(value) AS (VALUES(1) UNION ALL SELECT value+1 FROM n WHERE value<5001) INSERT INTO oa_operators(id,email,display_name,role,status,version,created_at) SELECT 'directory-'||printf('%05d',value),'directory-'||value||'@example.test','Directory Colleague '||value,'member','active',1,${Date.now()} FROM n`)
  await sql("INSERT INTO nook_access(user,mode,active,generation) SELECT id,'member',1,1 FROM oa_operators WHERE id LIKE 'directory-%'")
  const seen=new Set();let after=''
  do{const page=(await get('/api/people?q=Directory%20Colleague&limit=200&after='+after)).data;for(const p of page.items){assert.ok(!seen.has(p.id));seen.add(p.id)}if(!page.hasMore)break;assert.ok(page.cursor);after=page.cursor}while(true)
  assert.equal(seen.size,5001)
  assert.deepEqual((await get('/api/people?q=Directory%20Colleague%205001')).data.items.map(p=>p.id),['directory-05001'])
  assert.equal((await get('/api/people?q=Directory',guest.cookie)).data.items.length,0)
 })
 await check('NOOK-017 typing expires, respects membership and disabling clears ephemeral presence',async()=>{
  const c=(await post('/api/conversations',{name:'Typing privacy',kind:'private',participants:[member.user.id]})).data
  const path='/api/conversations/'+c.id+'/typing'
  const before=(await get('/api/conversations',member.cookie)).data.find(i=>i.id===c.id)
  await post(path,{page:'member-page',typing:true},member.cookie)
  assert.deepEqual((await get(path)).data.people.map(p=>p.id),[member.user.id])
  await get(path,outsider.cookie,403)
  await sql(`UPDATE nook_typing SET expires=${Date.now()-1}`)
  assert.equal((await get(path)).data.people.length,0)
  await post(path,{page:'member-page',typing:true},member.cookie)
  await post('/api/profile',{presenceEnabled:false,typingEnabled:false},member.cookie)
  assert.equal((await get(path)).data.people.length,0)
  await post(path,{page:'member-page',typing:true},member.cookie,403)
  const me=(await get('/api/me',member.cookie)).data
  assert.equal(me.presenceEnabled,false);assert.equal(me.typingEnabled,false)
  await post('/api/profile',{presenceEnabled:true,typingEnabled:true},member.cookie)
  await post(path,{page:'member-page',typing:true},member.cookie)
  await post('/api/conversations/'+c.id+'/members',{user:member.user.id,remove:true})
  assert.equal((await get(path)).data.people.length,0)
  await get(path,member.cookie,403)
  const after=(await get('/api/conversations')).data.find(i=>i.id===c.id)
  assert.equal(after.unread,before.unread)
 })
 await check('NOOK-017 sidebar sections, installation boundaries and explicit mark unread preserve attention',async()=>{
  const c=(await post('/api/conversations',{name:'Partner renewal',kind:'private',participants:[member.user.id]})).data
  const message=(await post('/api/conversations/'+c.id+'/messages',{body:'Please review the renewal',intent:crypto.randomUUID(),mentions:[member.user.id]})).data
  await post('/api/conversations/'+c.id+'/read',{seq:message.sequence},member.cookie)
  const attention=(await get('/api/attention',member.cookie)).data.items.map(i=>i.id)
  await post('/api/conversations/'+c.id+'/mark-unread',{},member.cookie)
  assert.ok((await get('/api/conversations',member.cookie)).data.find(i=>i.id===c.id).unread>0)
  assert.deepEqual((await get('/api/attention',member.cookie)).data.items.map(i=>i.id),attention)
  await post('/api/personal/workspace',{conversation:c.id,section:'Customers',position:2},member.cookie)
  assert.equal((await get('/api/conversations',member.cookie)).data.find(i=>i.id===c.id).section,'Customers')
  assert.ok(!(await get('/api/personal/workspace')).data.sections.some(i=>i.conversation===c.id))
  // Installation links now live on the device (NOOK-017 "Your workspaces"); the account no longer stores new ones.
  await post('/api/personal/workspace',{origin:'https://work.example.com',label:'Acme workspace'},member.cookie,400)
  await restart()
  assert.deepEqual((await get('/api/personal/workspace',member.cookie)).data.installations,[])
  await post('/api/conversations/'+c.id+'/members',{user:member.user.id,remove:true})
  assert.ok(!(await get('/api/personal/workspace',member.cookie)).data.sections.some(i=>i.conversation===c.id))
  await post('/api/conversations/'+c.id+'/mark-unread',{},member.cookie,403)
 })
}
