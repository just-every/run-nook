import assert from 'node:assert/strict'
// Public-route sends and settings against the emitted Worker. Synthetic people
// and session ages are fixture setup, not an application implementation path.
export async function broadcastJourney({post,patch,get,request,sql,owner,member,outsider,check,restart}){
 const people=Array.from({length:118},(_,index)=>({id:'broadcast-person-'+index,name:'Broadcast teammate '+index,email:'broadcast-'+index+'@example.test'}))
 const q=value=>"'"+value.replaceAll("'","''")+"'"
 await sql(`INSERT INTO oa_operators(id,email,display_name,role,status,version,created_at) VALUES ${people.map(p=>`(${q(p.id)},${q(p.email)},${q(p.name)},'member','active',1,${Date.now()})`).join(',')}`)
 await sql(`INSERT INTO nook_access(user,mode,active,generation) VALUES ${people.map(p=>`(${q(p.id)},'member',1,1)`).join(',')}`)
 const room=(await post('/api/conversations',{name:'Team broadcast planning',kind:'channel',participants:[member.user.id,...people.map(p=>p.id)]})).data
 const send=(input,cookie=owner.cookie,status=200)=>post(`/api/conversations/${room.id}/messages`,{intent:crypto.randomUUID(),body:'@channel Autumn launch briefing starts at 10am.',...input},cookie,status)
 const snapshot=async message=>{
  const all=[];let after=''
  for(;;){const page=(await get(`/api/messages/${message}/broadcast-recipients?after=${encodeURIComponent(after)}`)).data;all.push(...page.items);if(!page.hasMore)return all;after=all.at(-1).id}
 }
 await check('NOOK-065 120-member broadcast confirmation, immutable retry audience, exclusions and routine Attention',async()=>{
  assert.equal((await get(`/api/conversations/${room.id}/members`)).data.length,120)
  await get('/api/broadcast/policy',member.cookie,403)
  await post(`/api/conversations/${room.id}/broadcast-preview`,{body:'An ordinary message'},outsider.cookie,403)
  await patch('/api/notify',{mentions:true},member.cookie)
  assert.equal((await get('/api/notify',member.cookie)).data.broadcasts,true,'broadcast email inherits the mention choice')
  await patch(`/api/conversations/${room.id}/broadcast-ignore`,{ignore:true},member.cookie)
  await sql(`INSERT INTO nook_preferences(user,conversation,muted,followed) VALUES(${q(people[0].id)},${q(room.id)},1,0)`)
  const quiet=Date.now()+3600000
  await sql(`INSERT INTO nook_settings VALUES(${q(people[2].id)},${quiet})`)
  await sql(`INSERT INTO nook_notify_preferences(user,mentions,updated) VALUES ${people.slice(0,10).map(p=>`(${q(p.id)},1,${Date.now()})`).join(',')}`)
  await sql(`INSERT INTO nook_broadcast_choices(user,zone) VALUES(${q(people[2].id)},'Pacific/Auckland')`)
  const intent=crypto.randomUUID(),before=(await get(`/api/conversations/${room.id}/replay`)).data.frontier
  const refusal=await send({intent},owner.cookie,409)
  assert.equal(refusal.data.broadcast.recipients,117);assert.equal(refusal.data.broadcast.quiet,1);assert.equal(refusal.data.broadcast.otherZones,1)
  assert.equal((await get(`/api/conversations/${room.id}/replay`)).data.frontier,before)
  const message=(await send({intent,confirmBroadcast:true})).data
  assert.equal(message.broadcast.recipients,117)
  const recipients=await snapshot(message.id);assert.equal(recipients.length,117);assert.ok(!recipients.some(p=>[owner.user.id,member.user.id,people[0].id].includes(p.id)))
  const counts=(await sql(`SELECT (SELECT count(*) FROM nook_attention WHERE message=${q(message.id)} AND reason='broadcast') AS attention,(SELECT count(*) FROM nook_notify_queue WHERE message=${q(message.id)} AND channel='email' AND reason='broadcast') AS email`))[0]
  assert.equal(counts.attention,117);assert.equal(counts.email,9)
  await patch(`/api/conversations/${room.id}/broadcast-ignore`,{ignore:false},member.cookie)
  await post(`/api/conversations/${room.id}/members`,{user:people[1].id,remove:true})
  await restart()
  const retry=(await send({intent},owner.cookie)).data
  assert.equal(retry.id,message.id);assert.deepEqual(await snapshot(message.id),recipients,'retries never re-resolve the audience')
  await send({intent,body:'@channel Different payload',confirmBroadcast:true},owner.cookie,409)
  await get(`/api/messages/${message.id}/broadcast-recipients`,outsider.cookie,403)
  await request(`/api/conversations/${room.id}/broadcast-preview`,{method:'POST',body:{body:'@channel test'},status:401})
  const explicit=(await send({confirmBroadcast:true,mentions:[member.user.id]})).data
  const attention=(await get('/api/attention',member.cookie)).data
  assert.equal(attention.items.find(item=>item.message?.id===explicit.id)?.reason,'mention','explicit mentions outrank broadcasts')
 })
 await check('NOOK-065 fresh presence, default-only everyone, owner policy and Slack mention syntax',async()=>{
  const now=Date.now(),fresh=people.slice(10,40)
  await sql(`INSERT INTO oa_sessions(id,token_hash,operator_id,operator_version,kind,created_at,expires_at) VALUES ${people.slice(10,44).map((p,index)=>`(${q('broadcast-session-'+p.id)},${q('broadcast-token-'+p.id)},${q(p.id)},1,'native',${now},${index===33?now-1:now+3600000})`).join(',')}`)
  await sql(`INSERT INTO nook_broadcast_presence(page,user,session,heartbeat) VALUES ${people.slice(10,44).map((p,index)=>`(${q('broadcast-page-'+p.id)},${q(p.id)},${q('broadcast-session-'+p.id)},${index===30?now-600001:now})`).join(',')}`)
  await sql(`INSERT INTO nook_broadcast_choices(user,away) VALUES(${q(people[41].id)},1)`)
  await sql(`UPDATE oa_sessions SET revoked_at=${now} WHERE id=${q('broadcast-session-'+people[42].id)}`)
  const here=(await send({body:'@here Can the active team check the launch?',confirmBroadcast:true})).data
  assert.deepEqual((await snapshot(here.id)).map(p=>p.id).sort(),fresh.map(p=>p.id).sort())
  await send({body:'@everyone Briefing for the organization',confirmBroadcast:true},owner.cookie,403)
  const defaults=(await get('/api/team/default-channels')).data
  await patch('/api/team/default-channels',{version:defaults.version,channels:[...defaults.channels.filter(c=>c.enabled).map(c=>({id:c.id,mandatory:!!c.mandatory})),{id:room.id,mandatory:false}]})
  const policy=(await get('/api/broadcast/policy')).data
  await patch('/api/broadcast/policy',{version:policy.version,level:'admins',people:[],everyoneChannel:room.id})
  const before=(await get(`/api/conversations/${room.id}/replay`)).data.frontier
  await send({body:'<!channel> Refused member broadcast',confirmBroadcast:true},member.cookie,403)
  assert.equal((await get(`/api/conversations/${room.id}/replay`)).data.frontier,before)
  const everyone=(await send({body:'@everyone The company briefing is ready.',confirmBroadcast:true})).data
  const expected=(await get('/api/users')).data.filter(p=>p.mode==='member'&&p.id!==owner.user.id&&p.id!==people[0].id).map(p=>p.id).sort()
  assert.deepEqual((await snapshot(everyone.id)).map(p=>p.id).sort(),expected)
  const channelPolicy=(await get(`/api/channels/${room.id}/broadcast`)).data
  await patch(`/api/channels/${room.id}/broadcast`,{version:channelPolicy.version,level:'selected',people:[member.user.id],everyoneChannel:null})
  const allowed=(await send({body:'<!here> Active teammates: thanks for reviewing.',confirmBroadcast:true},member.cookie)).data
  assert.equal(allowed.broadcast.kind,'here')
  await patch('/api/messages/'+allowed.id,{version:1,body:'@channel Changed broadcast type'},member.cookie,400)
  const current=(await get('/api/broadcast/policy')).data
  await patch('/api/broadcast/policy',{version:current.version,level:'everyone',people:[],everyoneChannel:null})
 })
 return {room,people}
}
