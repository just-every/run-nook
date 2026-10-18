import assert from 'node:assert/strict'
const until=async(fn,label)=>{const end=Date.now()+30000;while(Date.now()<end){if(await fn())return;await new Promise(r=>setTimeout(r,300))}throw Error('Timed out: '+label)}
export async function remindersJourney({post,get,patch,request,owner,member,outsider,sql,restart,check}){
 const change=patch??((path,body,cookie=owner.cookie,status=200)=>request(path,{method:'PATCH',body,cookie,status}))
 await check('NOOK-033 durable personal and channel reminders, independent triage and current-authority delivery',async()=>{
  const room=(await post('/api/conversations',{name:'standup',kind:'private',participants:[member.user.id]})).data
  const message=(await post(`/api/conversations/${room.id}/messages`,{body:'Call Ana about the US customer rollout.',intent:crypto.randomUUID()})).data
  const create=async(phrase,extra={},cookie=owner.cookie)=>{const p=(await post('/api/reminders/preview',{phrase,zone:'UTC',...extra},cookie)).data;const input={phrase,zone:'UTC',...extra,confirmedDue:p.due,intent:crypto.randomUUID()};return {row:(await post('/api/reminders',input,cookie)).data,input,p}}
  const personal=await create('me in 20 minutes to call Ana',{conversation:room.id,sourceKind:'message',source:message.id})
  assert.equal((await post('/api/reminders',personal.input)).data.id,personal.row.id)
  await post('/api/reminders',{...personal.input,phrase:'me in 20 minutes to change the ask'},owner.cookie,409)
  const channel=await create('#standup "Post your update" every weekday at 9am')
  const cancelled=await create('me tomorrow at 9am to send the deck')
  const refused=await create('#standup "This must not post" tomorrow at 9am',{},member.cookie)
  await change('/api/reminders/'+cancelled.row.id,{action:'cancel',version:1})
  await change('/api/reminders/'+personal.row.id,{action:'cancel',version:1},outsider.cookie,404)
  const hidden=(await get('/api/reminders',outsider.cookie)).data;assert.equal(hidden.items.length,0)
  await change(`/api/channels/${room.id}/posting`,{version:1,level:'admins',replies:'same',people:[]})
  const ids=[personal.row.id,channel.row.id,refused.row.id].map(id=>"'"+id+"'").join(',')
  await sql(`UPDATE nook_reminders SET next_due=${Date.now()-1000} WHERE id IN (${ids})`)
  const frontier=(await get('/api/conversations/'+room.id+'/messages')).data.length
  await restart();await post('/api/reminders',personal.input)
  await until(async()=>{const rows=(await get('/api/reminders')).data.items;return rows.find(r=>r.id===personal.row.id)?.delivery==='delivered'&&rows.find(r=>r.id===channel.row.id)?.delivery==='delivered'},'real alarm reminders after restart').catch(async e=>{console.error(await sql('SELECT id,text,state,reason,next_due FROM nook_reminders'));throw e})
  assert.equal((await get('/api/conversations/'+room.id+'/messages')).data.length,frontier+1)
  assert.equal((await get('/api/reminders',member.cookie)).data.items.find(r=>r.id===refused.row.id).state,'failed')
  assert.equal((await sql(`SELECT count(*) AS n FROM nook_reminder_occurrences WHERE reminder='${personal.row.id}'`))[0].n,1)
  assert.equal((await get('/api/attention')).data.personalReminders[0].text,'call Ana')
  assert.equal((await get('/api/conversations/'+room.id+'/outcomes')).data.length,0)
  const file=(await post(`/api/conversations/${room.id}/attachments`,{name:'briefing.txt',mime:'text/plain',data:Buffer.from('Thursday customer briefing').toString('base64'),intent:crypto.randomUUID()})).data
  await post(`/api/conversations/${room.id}/messages`,{body:'Briefing attachment',attachments:[file.id],intent:crypto.randomUUID()})
  const fileReminder=await create('me tomorrow at 9am to check the briefing file',{conversation:room.id,sourceKind:'attachment',source:file.id});assert.ok(fileReminder.row.id)
  const peopleRoom=(await post('/api/conversations',{name:'Reminder permission',kind:'private',participants:[member.user.id]})).data
  await post('/api/reminders/preview',{phrase:'@'+owner.user.id+' tomorrow at 9am to approve the deck',zone:'UTC',conversation:peopleRoom.id},member.cookie,403)
  const delegated=await create('@'+member.user.id+' tomorrow at 9am to review the customer deck',{conversation:peopleRoom.id});assert.ok((await get('/api/reminders',member.cookie)).data.items.some(r=>r.id===delegated.row.id))
  await change('/api/settings',{dndUntil:Date.now()+60000})
  assert.equal((await get('/api/attention')).data.personalReminders.length,0)
  assert.equal((await get('/api/reminders')).data.items.find(r=>r.id===personal.row.id).delivery,'held')
  await change('/api/settings',{dndUntil:null})
  await change('/api/reminders/'+personal.row.id,{action:'snooze',version:1,until:Date.now()+120000})
  assert.equal((await get('/api/attention')).data.personalReminders.length,0)
  await change('/api/reminders/'+personal.row.id,{action:'complete',version:2})
  assert.equal((await get('/api/reminders')).data.items.find(r=>r.id===personal.row.id).delivery,'done')
  // Same real alarm after another restart cannot replay the committed channel occurrence.
  const beforeRestart=(await get('/api/conversations/'+room.id+'/messages')).data.length
  await restart();await post('/api/reminders',channel.input)
  assert.equal((await get('/api/conversations/'+room.id+'/messages')).data.length,beforeRestart)
  const lost=await create('me in 20 minutes to revisit context',{conversation:room.id,sourceKind:'message',source:message.id},member.cookie)
  await post(`/api/conversations/${room.id}/members`,{user:member.user.id,remove:true})
  await sql(`UPDATE nook_reminders SET next_due=${Date.now()-1000} WHERE id='${lost.row.id}'`)
  await post('/api/reminders',lost.input,member.cookie,403);await post('/api/reminders',personal.input)
  await until(async()=>(await get('/api/reminders',member.cookie)).data.items.find(r=>r.id===lost.row.id)?.state==='failed','revoked reminder denied')
  const unavailable=(await get('/api/reminders',member.cookie)).data.items.find(r=>r.id===lost.row.id);assert.equal(unavailable.text,null);assert.equal(unavailable.conversation,null)
 })
 await check('NOOK-033 grammar preview, audience denial and DST recurrence preserve the declared wall clock',async()=>{
  await post('/api/reminders/preview',{phrase:'me sometime soonish',zone:'America/New_York'},owner.cookie,400)
  const one=(await post('/api/reminders/preview',{phrase:'me in 20 minutes to call Ana',zone:'America/New_York'})).data
  assert.ok(Math.abs(one.due-Date.now()-20*60000)<10000)
  const weekday=(await post('/api/reminders/preview',{phrase:'me "Post your update" every weekday at 9am',zone:'America/New_York'})).data
  assert.equal(weekday.recurrence,'weekdays');assert.match(weekday.localAt,/T09:00$/)
  const {occurrenceAt,nextOccurrence}=await import('../src/scheduled/time.mjs')
  const next=nextOccurrence('2027-03-12T09:00','weekdays',null);assert.equal(next,'2027-03-15T09:00');assert.equal(occurrenceAt(next,'America/New_York')-occurrenceAt('2027-03-12T09:00','America/New_York'),71*3600000)
  await post('/api/reminders/preview',{phrase:'#standup "secret" tomorrow at 9am',zone:'UTC'},outsider.cookie,400)
  await post('/api/reminders',{phrase:'me in 20 minutes to skip confirmation',zone:'UTC',intent:crypto.randomUUID()},owner.cookie,400)
 })
}
