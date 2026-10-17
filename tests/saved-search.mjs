import assert from 'node:assert/strict'

export async function savedSearchJourney({owner,registered,post,patch,get,request,check,restart,origin}){
 const member=await registered('SavedColleague'),outside=await registered('SavedOutside')
 const room=(await post('/api/conversations',{name:'Quarterly planning',kind:'private',participants:[member.user.id]})).data
 const dm=(await post('/api/conversations',{name:'Saved direct context',kind:'dm',participants:[member.user.id]})).data
 const one=(await post(`/api/conversations/${room.id}/messages`,{body:'Q3 HR launch checklist',intent:crypto.randomUUID()})).data
 const two=(await post(`/api/conversations/${room.id}/messages`,{body:'Q3 PO needs signoff',parent:one.id,intent:crypto.randomUUID()},member.cookie)).data
 const direct=(await post(`/api/conversations/${dm.id}/messages`,{body:'Private planning note',intent:crypto.randomUUID()})).data
 const saved=(await post('/api/saved',{conversation:room.id,message:one.id},member.cookie)).data
 await post(`/api/conversations/${room.id}/pins`,{message:one.id,pinned:true},member.cookie)
 await check('NOOK-019 short terms and typed/structured filters page authorized context',async()=>{
  const day=one.created.slice(0,10),next=new Date(Date.parse(day+'T00:00:00Z')+86400000).toISOString().slice(0,10)
  const typed=`Q3 in:#${room.id} from:me after:${day} before:${next} has:pin`
  const own=(await get('/api/search?q='+encodeURIComponent(typed),owner.cookie)).data
  assert.deepEqual(own.items.map(i=>i.id),[one.id]);assert.equal(own.items[0].source,'native');assert.equal(own.items[0].created,one.created)
  const structured=(await get(`/api/search?q=Q3&conversation=${room.id}&person=${owner.user.id}&afterDate=${day}&beforeDate=${next}`,member.cookie)).data
  assert.deepEqual(structured.items.map(i=>i.id),[one.id])
  const retained=(await get('/api/search?q='+encodeURIComponent(`HR is:saved in:#${room.id}`),member.cookie)).data
  assert.deepEqual(retained.items.map(i=>i.id),[one.id])
  assert.equal((await get('/api/search?q='+encodeURIComponent(`Q3 in:#${room.id}`),member.cookie)).data.items.length,2)
  assert.ok((await get('/api/search?q=3',member.cookie)).data.items.some(i=>i.id===two.id))
  assert.ok(!(await get('/api/search?q=Q3',outside.cookie)).data.items.some(i=>i.conversation===room.id))
  await get('/api/search?q='+encodeURIComponent(`Q3 in:#${room.id}`),outside.cookie,400)
  await get('/api/search?q='+encodeURIComponent('Q3 before:2026-02-30'),member.cookie,400)
  assert.ok((await get('/api/search?q='+encodeURIComponent('unknown:Q3'),member.cookie)).data.hints.length)
  const expected=new Set()
  for(let n=0;n<105;n++)expected.add((await post(`/api/conversations/${room.id}/messages`,{body:`AI review checkpoint ${n}`,intent:crypto.randomUUID()})).data.id)
  const query=encodeURIComponent(`AI in:#${room.id}`),seen=new Set();let after=''
  do{const page=(await get('/api/search?q='+query+'&after='+encodeURIComponent(after),member.cookie)).data;for(const item of page.items){assert.ok(expected.has(item.id));assert.ok(!seen.has(item.id));seen.add(item.id)}if(!page.hasMore)break;assert.notEqual(page.cursor,after);after=page.cursor}while(true)
  assert.deepEqual(seen,expected)
  await get('/api/search?q='+encodeURIComponent(`HR in:#${room.id}`)+'&after='+encodeURIComponent(after),member.cookie,400)
 })
 await check('NOOK-020 private saves and shared pins survive restart and tombstone revoked/erased sources',async()=>{
  const directSave=(await post('/api/saved',{conversation:dm.id,message:direct.id})).data
  const duplicate=(await post('/api/saved',{conversation:room.id,message:one.id},member.cookie)).data
  assert.equal(duplicate.id,saved.id);assert.equal(duplicate.created,saved.created)
  await post('/api/saved',{conversation:room.id,url:'https://example.test/planning?q=3#checklist'},member.cookie)
  assert.ok(!(await get('/api/saved')).data.items.some(i=>i.id===saved.id))
  await restart()
  assert.ok((await get('/api/saved')).data.items.some(i=>i.id===directSave.id&&i.message.body===direct.body))
  const pins=(await get(`/api/conversations/${room.id}/pins`)).data.items
  assert.equal(pins[0].message.id,one.id);assert.equal(pins[0].pinnedBy.id,member.user.id);assert.ok(pins[0].created)
  await get(`/api/conversations/${room.id}/pins`,outside.cookie,403)
  await post(`/api/conversations/${dm.id}/pins`,{message:direct.id,pinned:true},owner.cookie,400)
  await post(`/api/conversations/${room.id}/members`,{user:member.user.id,remove:true})
  const tombstone=(await get('/api/saved',member.cookie)).data.items.find(i=>i.id===saved.id)
  assert.deepEqual(tombstone,{id:saved.id,kind:'message',created:saved.created,unavailable:true})
  assert.ok(!(await get('/api/search?q=Q3',member.cookie)).data.items.some(i=>i.id===one.id))
  await get(`/api/messages/${one.id}/collections`,member.cookie,404)
  const ownSave=(await post('/api/saved',{conversation:room.id,message:one.id})).data
  let erased=(await post('/api/erasures',{kind:'message',target:one.id,confirmation:'ERASE'})).data
  while(erased.state!=='complete')erased=(await post(`/api/erasures/${erased.id}/resume`,{})).data
  const unavailable=(await get('/api/saved')).data.items.find(i=>i.id===ownSave.id)
  assert.deepEqual(unavailable,{id:ownSave.id,kind:'message',created:ownSave.created,unavailable:true})
  assert.equal((await get(`/api/conversations/${room.id}/pins`)).data.items[0].unavailable,true)
  assert.ok(!(await get('/api/search?q=HR')).data.items.some(i=>i.id===one.id))
  await request(`/api/saved/${saved.id}`,{method:'DELETE',body:{},cookie:member.cookie})
  assert.ok(!(await get('/api/saved',member.cookie)).data.items.some(i=>i.id===saved.id))
 })
}
