import assert from 'node:assert/strict'
const until=async(check,label)=>{const end=Date.now()+80000;while(Date.now()<end){if(await check())return;await new Promise(r=>setTimeout(r,300))}throw Error('Timed out: '+label)}
export async function scheduledJourney({post,get,request,owner,member,outsider,check,restart,sql}){
 const patch=(path,body,cookie=owner.cookie,status=200)=>request(path,{method:'PATCH',body,cookie,status})
 await check('NOOK-034 and NOOK-066 one-off and recurring sends survive restart, commit once, and recheck posting permission and membership at firing',async()=>{
  const room=(await post('/api/conversations',{name:'Thursday launch briefing',kind:'private',participants:[member.user.id]})).data
  const restricted=(await post('/api/conversations',{name:'Scheduled announcements',kind:'channel',participants:[member.user.id]})).data
  const revoked=(await post('/api/conversations',{name:'Private launch plans',kind:'private',participants:[member.user.id]})).data
  const bytes='Support rotation and launch checklist\n'
  const upload=async()=>(await post(`/api/conversations/${room.id}/attachments`,{name:'briefing-notes.txt',mime:'text/plain',data:Buffer.from(bytes).toString('base64'),intent:crypto.randomUUID()},member.cookie)).data
  const oneFile=await upload(),repeatFile=await upload()
  const at=new Date(Date.now()+65000).toISOString().slice(0,16),date=at.slice(0,10)
  const base={body:'Customer success: review the launch checklist before the Thursday briefing.',localAt:at,zone:'UTC',recurrence:'none',endDate:null,attachments:[oneFile.id],intent:crypto.randomUUID()}
  const schedule=async(conversation,input={},person=member)=>(await post(`/api/conversations/${conversation}/scheduled`,{...base,attachments:[],...input,intent:crypto.randomUUID()},person.cookie)).data
  const one=(await post(`/api/conversations/${room.id}/scheduled`,base,member.cookie)).data
  assert.equal((await post(`/api/conversations/${room.id}/scheduled`,base,member.cookie)).data.id,one.id)
  await post(`/api/conversations/${room.id}/scheduled`,{...base,body:'A changed retry'},member.cookie,409)
  const weekly=await schedule(room.id,{body:'Weekly stand-up: post the progress and blockers.',attachments:[repeatFile.id],recurrence:'weekly',endDate:new Date(Date.parse(date)+21*86400000).toISOString().slice(0,10)})
  const blocked=await schedule(restricted.id),lost=await schedule(revoked.id),paused=await schedule(room.id),cancelled=await schedule(room.id)
  const list=async(cookie=member.cookie)=>(await get('/api/scheduled',cookie)).data.items
  assert.equal((await list(outsider.cookie)).length,0)
  assert.equal((await get(`/api/conversations/${room.id}/scheduled-audience`,member.cookie)).data.total,2)
  await get(`/api/conversations/${room.id}/scheduled-audience`,outsider.cookie,403)
  assert.equal((await sql(`SELECT count(*) AS n FROM nook_schedule_files WHERE schedule IN ('${one.id}','${weekly.id}')`))[0].n,2)
  await patch('/api/scheduled/'+one.id,{action:'cancel',version:1},owner.cookie,404)
  await patch('/api/scheduled/'+paused.id,{action:'pause',version:1},member.cookie)
  await patch('/api/scheduled/'+paused.id,{action:'cancel',version:1},member.cookie,409)
  await patch('/api/scheduled/'+cancelled.id,{action:'cancel',version:1},member.cookie)
  await patch(`/api/channels/${restricted.id}/posting`,{version:1,level:'admins',replies:'same',people:[]})
  await post(`/api/conversations/${revoked.id}/members`,{user:member.user.id,remove:true})
  await restart()
  await until(async()=>{const rows=await list();return rows.find(s=>s.id===one.id)?.state==='complete'&&rows.find(s=>s.id===weekly.id)?.occurrences.length&&rows.find(s=>s.id===blocked.id)?.state==='failed'&&rows.find(s=>s.id===lost.id)?.state==='failed'},'durable scheduled occurrences')
  const rows=await list(),sent=rows.find(s=>s.id===one.id),series=rows.find(s=>s.id===weekly.id)
  assert.equal(sent.occurrences.length,1);assert.equal(sent.occurrences[0].state,'sent')
  assert.equal(series.state,'active');assert.equal(series.occurrences.length,1);assert.equal(Date.parse(series.local_at+'Z')-Date.parse(at+'Z'),7*86400000)
  assert.equal(rows.find(s=>s.id===paused.id).state,'paused');assert.equal(rows.find(s=>s.id===cancelled.id).state,'cancelled')
  assert.match(rows.find(s=>s.id===blocked.id).reason,/Posting permission/)
  assert.equal(rows.find(s=>s.id===lost.id).payload,null);assert.equal(rows.find(s=>s.id===lost.id).name,null)
  const messages=(await get(`/api/conversations/${room.id}/messages`)).data
  for(const message of messages){assert.equal(message.attachments.length,1);assert.notEqual(message.attachments[0].id,oneFile.id);assert.notEqual(message.attachments[0].id,repeatFile.id);assert.equal((await get('/api/attachments/'+message.attachments[0].id+'/download',member.cookie)).raw,bytes)}
  const postedFile=messages.find(m=>m.body.startsWith('Weekly')).attachments[0].id
  const deleted=await patch('/api/attachments/'+postedFile,{delete:true},member.cookie);assert.equal(deleted.data.receipt.state,'complete')
  assert.equal((await sql(`SELECT count(*) AS n FROM nook_schedule_files WHERE schedule='${weekly.id}'`))[0].n,1,'deleting a sent copy retains the recurring template')
  assert.equal((await sql(`SELECT count(*) AS n FROM nook_schedule_files WHERE schedule='${one.id}'`))[0].n,0,'completed one-off releases its template')
  assert.equal(messages.filter(m=>m.author===member.user.id).length,2)
  assert.equal((await get(`/api/conversations/${restricted.id}/messages`)).data.length,0)
  assert.equal((await get(`/api/conversations/${room.id}/outcomes`)).data.length,0)
  await patch('/api/scheduled/'+one.id,{action:'arm',version:1},member.cookie)
  await restart()
  assert.equal((await get(`/api/conversations/${room.id}/messages`)).data.length,2)
  await patch('/api/scheduled/'+weekly.id,{action:'pause',version:1},member.cookie)
  const resumedAt=new Date(Date.now()+3600000).toISOString().slice(0,16)
  await patch('/api/scheduled/'+weekly.id,{action:'edit',version:2,...base,attachments:[repeatFile.id],localAt:resumedAt,recurrence:'weekly',endDate:series.end_date},member.cookie)
  await patch('/api/scheduled/'+weekly.id,{action:'cancel',version:3},member.cookie)
  assert.equal((await sql(`SELECT count(*) AS n FROM nook_schedule_files WHERE schedule='${weekly.id}'`))[0].n,0)
  const erasedFile=await upload(),eraseSchedule=await schedule(room.id,{attachments:[erasedFile.id],localAt:resumedAt})
  let receipt=(await patch('/api/attachments/'+erasedFile.id,{delete:true},member.cookie)).data.receipt
  for(let i=0;receipt.state!=='complete'&&i<30;i++)receipt=(await post('/api/erasures/'+receipt.id+'/resume',{},member.cookie)).data
  assert.equal(receipt.state,'complete');assert.equal((await list()).find(s=>s.id===eraseSchedule.id).state,'failed')
  assert.equal((await sql(`SELECT count(*) AS n FROM nook_schedule_files WHERE schedule='${eraseSchedule.id}'`))[0].n,0)
  const stale=await schedule(room.id,{localAt:resumedAt})
  // A persisted due frontier models an installation returning from an outage;
  // the real alarm must hold the stale work rather than backfill it.
  const staleAt=new Date(Date.now()-3600000).toISOString().slice(0,16),due=Date.parse(staleAt+'Z')
  await sql(`UPDATE nook_schedules SET local_at='${staleAt}',next_due=${due} WHERE id='${stale.id}'`)
  await patch('/api/scheduled/'+stale.id,{action:'arm',version:1},member.cookie)
  await until(async()=>(await list()).find(s=>s.id===stale.id)?.state==='needs-review','stale occurrence held')
  assert.equal((await get(`/api/conversations/${room.id}/messages`)).data.length,2)
 })
 await check('NOOK-034 previews calendar recurrence across DST and refuses unavailable payloads',async()=>{
  const preview=(input,status=200)=>post('/api/scheduled/preview',input,owner.cookie,status)
  const spring=(await preview({localAt:'2027-03-13T09:00',zone:'America/New_York',recurrence:'daily',endDate:'2027-03-15'})).data.instances
  assert.equal(spring[1].at-spring[0].at,23*3600000)
  const overlap=(await preview({localAt:'2026-11-01T01:30',zone:'America/New_York'})).data.instances[0]
  assert.equal(overlap.at,Date.parse('2026-11-01T05:30:00Z'))
  const gap=(await preview({localAt:'2027-03-14T02:30',zone:'America/New_York'})).data.instances[0]
  assert.equal(gap.at,Date.parse('2027-03-14T07:30:00Z'))
  const weekdays=(await preview({localAt:'2027-03-12T09:00',zone:'America/New_York',recurrence:'weekdays',endDate:'2027-03-16'})).data.instances
  assert.equal(weekdays[1].localAt,'2027-03-15T09:00')
  const monthly=(await preview({localAt:'2027-01-31T09:00',zone:'UTC',recurrence:'monthly',endDate:'2027-05-31'})).data.instances
  assert.equal(monthly[1].localAt,'2027-03-31T09:00');assert.equal(monthly[2].localAt,'2027-05-31T09:00')
  await preview({localAt:'2027-03-13T09:00',zone:'America/New_York',recurrence:'weekdays',endDate:'2027-03-15'},400)
  await preview({localAt:'2027-02-30T09:00',zone:'America/New_York'},400)
  const room=(await post('/api/conversations',{name:'Schedule validation',kind:'private'})).data
  const base={body:'Review before sending',localAt:new Date(Date.now()+3600000).toISOString().slice(0,16),zone:'UTC',intent:crypto.randomUUID()}
  await post(`/api/conversations/${room.id}/scheduled`,{...base,attachments:['unavailable']},owner.cookie,400)
  await post(`/api/conversations/${room.id}/scheduled`,{...base,body:'x'.repeat(40001)},owner.cookie,400)
  await post(`/api/conversations/${room.id}/scheduled`,base,outsider.cookie,403)
 })
}
