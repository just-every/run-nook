import assert from 'node:assert/strict'
export async function postingJourney({post,patch,get,owner,member,outsider,check}){
 await check('NOOK-066 announcement permissions fence messages and replies while preserving read/reaction/save',async()=>{
  const room=(await post('/api/conversations',{name:'Company announcements',kind:'channel',participants:[member.user.id]})).data
  const path=`/api/channels/${room.id}/posting`,send=(input,cookie=member.cookie,status=200)=>post(`/api/conversations/${room.id}/messages`,{body:'Quarterly launch update',intent:crypto.randomUUID(),...input},cookie,status)
  const version=async()=>(await get(`/api/channels/${room.id}/details`)).data.version
  await patch(path,{version:await version(),level:'admins',replies:'same',people:[]},member.cookie,403)
  await get(path,outsider.cookie,403)
  const earlier=(await send({body:'Earlier member announcement'})).data
  const policy={version:await version(),level:'admins',replies:'same',people:[]}
  await patch(path,policy)
  await patch(path,policy,owner.cookie,409)
  const frontier=(await get(`/api/conversations/${room.id}/replay`)).data.frontier
  await send({},member.cookie,403)
  await patch(`/api/messages/${earlier.id}`,{version:earlier.version,body:'Refused edit after restriction'},member.cookie,403)
  await send({adminOverride:true},member.cookie,403)
  assert.equal((await get(`/api/conversations/${room.id}/replay`)).data.frontier,frontier)
  const root=(await send({},owner.cookie)).data
  await send({parent:root.id},member.cookie,403)
  await post(`/api/messages/${root.id}/reactions`,{emoji:'👍',add:true},member.cookie)
  await post('/api/saved',{conversation:room.id,message:root.id},member.cookie)
  assert.ok((await get(`/api/conversations/${room.id}/messages`,member.cookie)).data.some(m=>m.id===root.id))
  await patch(path,{version:await version(),level:'managers',replies:'everyone',people:[]})
  await send({},member.cookie,403)
  await send({parent:root.id})
  await patch(path,{version:await version(),level:'selected',replies:'same',people:[outsider.user.id]},owner.cookie,400)
  await patch(path,{version:await version(),level:'selected',replies:'same',people:[member.user.id]})
  const intent={body:'Executive exception',intent:crypto.randomUUID(),adminOverride:true}
  const override=(await post(`/api/conversations/${room.id}/messages`,intent)).data
  assert.equal((await post(`/api/conversations/${room.id}/messages`,intent)).data.id,override.id)
  assert.equal((await get(`/api/messages/${override.id}`)).data.adminOverride,true)
  await send()
  const savedPolicy=(await get(path)).data
  assert.equal(savedPolicy.overrides[0].id,override.id)
  assert.equal(savedPolicy.history.length,3)
  assert.equal((await get(path,member.cookie)).data.canPost,true)
 })
}
