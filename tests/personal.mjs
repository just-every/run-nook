import assert from 'node:assert/strict'
export async function personalJourney({owner,registered,post,get,request,check,restart,sql}){
 const member=await registered('PersonalSender'),outsider=await registered('PersonalOutside')
 await check('NOOK-017 sent history pages own recent messages under current access',async()=>{
  const room=(await post('/api/conversations',{name:'Regional customer launch',kind:'private',participants:[member.user.id]})).data
  const expected=new Set()
  for(let n=0;n<52;n++)expected.add((await post(`/api/conversations/${room.id}/messages`,{body:`Customer briefing update ${n}`,intent:crypto.randomUUID()},member.cookie)).data.id)
  const yesterday=[...expected][0];await sql(`UPDATE nook_messages SET created='${new Date(Date.now()-86400000).toISOString()}' WHERE id='${yesterday}'`)
  const old=(await post(`/api/conversations/${room.id}/messages`,{body:'Last quarter archived briefing',intent:crypto.randomUUID()},member.cookie)).data
  await sql(`UPDATE nook_messages SET created='2026-01-01T09:00:00.000Z' WHERE id='${old.id}'`)
  const root=(await post(`/api/conversations/${room.id}/messages`,{body:'New launch context',intent:crypto.randomUUID()})).data
  const reply=(await post(`/api/conversations/${room.id}/messages`,{body:'I sent the regional notes.',parent:root.id,intent:crypto.randomUUID()},member.cookie)).data;expected.add(reply.id)
  await get('/api/sent','',401)
  await get('/api/sent?after=malformed',member.cookie,400)
  const seen=new Set();let after=''
  do{const page=(await get('/api/sent?after='+encodeURIComponent(after),member.cookie)).data
   for(const item of page.items){assert.ok(expected.has(item.id));assert.ok(!seen.has(item.id));seen.add(item.id);if(item.id===reply.id)assert.equal(item.parent,root.id)}
   if(!page.hasMore)break;assert.notEqual(after,page.cursor);after=page.cursor
  }while(true)
  assert.deepEqual(seen,expected)
  assert.equal((await get('/api/sent',outsider.cookie)).data.items.length,0)
  assert.ok(!(await get('/api/sent',owner.cookie)).data.items.some(item=>expected.has(item.id)))
  await restart()
  assert.ok((await get('/api/sent',member.cookie)).data.items.some(item=>item.id===reply.id))
  await request('/api/messages/'+reply.id,{method:'PATCH',cookie:member.cookie,body:{body:'The regional notes are confirmed.',version:reply.version}})
  assert.equal((await get('/api/sent',member.cookie)).data.items.find(item=>item.id===reply.id).body,'The regional notes are confirmed.')
  await request('/api/messages/'+reply.id,{method:'PATCH',cookie:member.cookie,body:{delete:true,version:reply.version+1}})
  assert.ok(!(await get('/api/sent',member.cookie)).data.items.some(item=>item.id===reply.id))
  await post(`/api/conversations/${room.id}/members`,{user:member.user.id,remove:true})
  assert.ok(!(await get('/api/sent',member.cookie)).data.items.some(item=>item.conversation===room.id))
 })
}
