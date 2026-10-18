import {signIn} from './auth-support.mjs'
import assert from 'node:assert/strict'
const until=async(check,label)=>{const end=Date.now()+25_000;while(Date.now()<end){if(await check())return;await new Promise(resolve=>setTimeout(resolve,150))}throw Error('Timed out: '+label)}
export async function savedRemindersJourney({post,patch,get,request,owner,member,outsider,restart,check,origin}){
 await check('NOOK-020 due reminders survive restart, stay private and keep unread/work independent',async()=>{
  const room=(await post('/api/conversations',{name:'Launch support handoff',kind:'private',participants:[member.user.id]})).data
  const root=(await post(`/api/conversations/${room.id}/messages`,{body:'Prepare the Thursday support briefing',intent:crypto.randomUUID()})).data
  const file=(await post(`/api/conversations/${room.id}/attachments`,{name:'Support checklist.txt',mime:'text/plain',data:Buffer.from('Check support rotations before launch').toString('base64')})).data
  await post(`/api/conversations/${room.id}/messages`,{body:'The support checklist',intent:crypto.randomUUID(),attachments:[file.id]})
  const savedFile=(await post('/api/saved',{conversation:room.id,attachment:file.id},member.cookie)).data
  const saved=(await post('/api/saved',{conversation:room.id,message:root.id},member.cookie)).data
  const link=(await post('/api/saved',{conversation:room.id,url:'https://example.test/support-checklist'},member.cookie)).data
  const schedule=(item,due,cookie=member.cookie,status=200)=>patch('/api/saved/'+item.id,{due,timeZone:'America/New_York'},cookie,status)
  const attention=async()=>(await get('/api/attention',member.cookie)).data
  const due=Date.now()+10_000
  await schedule(saved,due,outsider.cookie,404)
  await schedule(saved,Date.now()-1000,member.cookie,400)
  await patch('/api/saved/'+saved.id,{due,timeZone:'Not/AZone'},member.cookie,400)
  await schedule(saved,due);await schedule(link,due);await schedule(savedFile,due)
  await schedule(link,null)
  assert.ok(!(await attention()).reminders.items.some(item=>item.id===saved.id))
  const before=(await get('/api/conversations',member.cookie)).data.find(c=>c.id===room.id)
  await restart()
  const second=await signIn(typeof origin==='function'?origin():origin,member.user.name.toLowerCase()+'@example.test')
  const persistent=(await get('/api/saved',second.cookie)).data.items.find(item=>item.id===saved.id)
  assert.equal(persistent.reminder.due,due);assert.equal(persistent.reminder.timeZone,'America/New_York')
  await until(async()=>(await attention()).reminders.items.some(item=>item.id===saved.id),'due saved reminder')
  assert.ok(!(await attention()).reminders.items.some(item=>item.id===link.id))
  assert.ok((await attention()).reminders.items.some(item=>item.id===savedFile.id&&item.attachment.name===file.name))
  await post('/api/attention/saved:'+savedFile.id,{action:'done'},member.cookie)
  assert.ok(!(await get('/api/attention',owner.cookie)).data.reminders.items.some(item=>item.id===saved.id))
  assert.equal((await get('/api/conversations',member.cookie)).data.find(c=>c.id===room.id).unread,before.unread)
  assert.deepEqual((await get(`/api/conversations/${room.id}/outcomes`,member.cookie)).data,[])
  await post('/api/attention/saved:'+saved.id,{action:'snooze',until:Date.now()+1500},member.cookie)
  assert.ok(!(await attention()).reminders.items.some(item=>item.id===saved.id))
  await until(async()=>(await attention()).reminders.items.some(item=>item.id===saved.id),'snoozed reminder returns')
  await post('/api/attention/saved:'+saved.id,{action:'done'},member.cookie)
  assert.ok(!(await attention()).reminders.items.some(item=>item.id===saved.id))
  await schedule(link,Date.now()+1500)
  await patch('/api/settings',{dndUntil:Date.now()+60_000},member.cookie)
  await until(async()=>(await get('/api/saved',member.cookie)).data.items.find(item=>item.id===link.id).reminder.state==='ready','quiet reminder due')
  assert.ok(!(await attention()).reminders.items.length)
  assert.ok((await attention()).deferredCount>0)
  await patch('/api/settings',{dndUntil:null},member.cookie)
  assert.ok((await attention()).reminders.items.some(item=>item.id===link.id))
  await schedule(saved,Date.now()+2000)
  await post(`/api/conversations/${room.id}/members`,{user:member.user.id,remove:true})
  await until(async()=>(await get('/api/saved',member.cookie)).data.items.find(item=>item.id===saved.id).reminder.state==='cancelled','revoked reminder cancelled')
  assert.ok(!(await attention()).reminders.items.some(item=>[saved.id,link.id].includes(item.id)))
  const erasedSave=(await post('/api/saved',{conversation:room.id,message:root.id})).data
  await schedule(erasedSave,Date.now()+1500,owner.cookie)
  await patch(`/api/messages/${root.id}`,{version:root.version,delete:true})
  await until(async()=>(await get('/api/saved')).data.items.find(item=>item.id===erasedSave.id).reminder.state==='cancelled','erased reminder cancelled')
  assert.ok(!(await get('/api/attention')).data.reminders.items.some(item=>item.id===erasedSave.id))
  await request('/api/saved/'+saved.id,{method:'DELETE',body:{},cookie:member.cookie})
  assert.ok(!(await get('/api/saved',member.cookie)).data.items.some(item=>item.id===saved.id))
 })
}
