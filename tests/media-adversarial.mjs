import assert from 'node:assert/strict'
export async function runMedia({post,patch,get,sql,facts,check,registered}){
 const a=await registered('MediaControls'),b=await registered('MediaReader'),c=(await post('/api/conversations',{name:'Media limits',participants:[b.user.id]},a.cookie)).data
 const up=body=>post(`/api/conversations/${c.id}/attachments`,body,a.cookie),input={name:'proof.txt',mime:'text/plain',data:Buffer.from('private bytes').toString('base64')},send=(body,status=200)=>post(`/api/conversations/${c.id}/messages`,body,a.cookie,status)
 await check('media base64/name/signature admission, ordered intent and atomic expiry/removal',async()=>{
  const before=await facts()
  for(const bad of [{name:'x\\y'},{name:'a\r\nHeader'},{data:'YQ='},{data:'AB=='},{mime:'text/html'}])await post(`/api/conversations/${c.id}/attachments`,{...input,...bad},a.cookie,bad.mime?415:400)
  assert.deepEqual(await facts(),before)
  const poly=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.from('<script>untrusted</script>')]),png=(await up({name:'signature.png',mime:'image/png',data:poly.toString('base64')})).data
  const origin=new URL((await get('/health')).response.url).origin,download=await fetch(origin+`/api/attachments/${png.id}/download`,{headers:{cookie:a.cookie}})
  assert.equal(download.status,200);assert.match(download.headers.get('content-disposition'),/^attachment;/);assert.equal(download.headers.get('x-content-type-options'),'nosniff');assert.deepEqual(Buffer.from(await download.arrayBuffer()),poly);await patch(`/api/attachments/${png.id}`,{delete:true},a.cookie)
  const file=(await up(input)).data
  const stage=await facts();await send({body:'Partial',intent:'partial',attachments:[file.id,'missing']},400);assert.deepEqual(await facts(),stage)
  await sql(`UPDATE nook_attachments SET expires=0 WHERE id='${file.id}'`)
  await get(`/api/attachments/${file.id}/download`,a.cookie,404);await send({body:'Expired',intent:'expired',attachments:[file.id]},400)
  const frontier=(await get(`/api/conversations/${c.id}/replay`,a.cookie)).data.frontier
  await patch(`/api/attachments/${file.id}`,{delete:true},a.cookie);assert.equal((await get(`/api/conversations/${c.id}/replay`,a.cookie)).data.frontier,frontier)
  const ids=[];for(let i=0;i<6;i++)ids.push((await up(input)).data.id)
  await send({body:'Too many',intent:'many',attachments:ids},400);await send({body:'Duplicate',intent:'dupe',attachments:[ids[0],ids[0]]},400)
  const body={body:'Ordered',intent:'ordered',attachments:ids.slice(0,2)},m=(await send(body)).data
  await send({...body,attachments:body.attachments.toReversed()},409)
  await patch(`/api/attachments/${ids[0]}`,{delete:true},a.cookie);assert.equal((await send(body)).data.id,m.id)
  assert.equal((await get('/api/attention',b.cookie)).data.items.length,0)
  for(const id of ids.slice(2))await patch(`/api/attachments/${id}`,{delete:true},a.cookie)
 })
 await check('concurrent staging admission preserves existing private bytes and frees capacity on removal',async()=>{
  let admitted=[],rejected=0
  // Paired requests exercise CAS races without hundreds of parallel Worker jobs.
  for(let i=0;i<26;i++)for(const r of await Promise.all([0,1].map(async()=>{const r=await fetch(`${(await get('/health')).response.url.replace('/health','')}/api/conversations/${c.id}/attachments`,{method:'POST',headers:{cookie:a.cookie,'content-type':'application/json'},body:JSON.stringify(input)});return {status:r.status,data:await r.json()}}))){if(r.status===200)admitted.push(r.data.id);else{assert.equal(r.status,429);rejected++}}
  assert.ok(admitted.length>0&&rejected>0);assert.equal((await upLimited()).status,429)
  for(const id of admitted)await patch(`/api/attachments/${id}`,{delete:true},a.cookie)
  const freed=await upLimited();assert.equal(freed.status,200);await patch(`/api/attachments/${freed.data.id}`,{delete:true},a.cookie)
  async function upLimited(body=input){const origin=new URL((await get('/health')).response.url).origin,r=await fetch(origin+`/api/conversations/${c.id}/attachments`,{method:'POST',headers:{cookie:a.cookie,'content-type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()}}
 })
}
