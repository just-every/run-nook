import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {chromium,expect} from '@playwright/test'
import {installation,until} from './push/fixture.mjs'
import {subscriber,packet} from './push/packet.mjs'

// NOOK-072: real Worker/D1/alarms; only the push vendor is substituted.
test('NOOK-072 [NOOK-118, NOOK-123, NOOK-124] thread counting, broadcast follows and device overrides through the product',async()=>{
 const recipients=new Map(),packets=[];let key
 const app=await installation(async request=>{const sub=recipients.get(request.url);assert.ok(sub);packets.push({endpoint:request.url,value:await packet(request,sub,key)});return new Response(null,{status:201})},{workerOptions:{assets:{directory:process.cwd()+'/dist/client',binding:'ASSETS',run_worker_first:true}}})
 try{
  const {call,ownerCookie,owner,db,origin}=app
  const room=await call('/api/conversations','POST',{name:'Customer launch coordination',kind:'private'},ownerCookie)
  const member=await app.invite('Ana-Martinez',room.id)
  key=(await call('/api/devices','GET',undefined,member.cookie)).publicKey
  const register=async(name,deviceClass)=>{const sub=subscriber(name);recipients.set(sub.subscription.endpoint,sub);return {...await call('/api/devices','POST',{transport:'webpush',subscription:sub.subscription,deviceClass},member.cookie),...sub}}
  const desktop=await register('thread-desktop','desktop'),mobile=await register('thread-phone','mobile')
  const defaults=(await call('/api/notify','GET',undefined,member.cookie)).push
  assert.ok(defaults.mentions&&defaults.direct&&defaults.threads,'first registration enables supported default events without opening settings')
  const send=(conversation,body,parent=null)=>call(`/api/conversations/${conversation.id}/messages`,'POST',{body,parent,intent:crypto.randomUUID()},ownerCookie)
  const row=async message=>(await db.prepare("SELECT * FROM nook_notify_queue WHERE channel='push' AND message=?").bind(message.id).all()).results
  const broadcast=await send(room,'@channel Please review the Thursday rollout checklist.')
  assert.equal((await call(`/api/conversations/${room.id}/preferences`,'GET',undefined,member.cookie)).threadFollows.find(f=>f.message===broadcast.id)?.source,'mentioned')
  await call(`/api/conversations/${room.id}/read`,'POST',{seq:broadcast.sequence},member.cookie)
  await call('/api/notify','PATCH',{push:{threadBadge:'mentions'}},member.cookie)
  const reply=await send(room,'Support coverage is confirmed for Thursday.',broadcast.id)
  assert.equal((await call('/api/devices/sync','GET',undefined,member.cookie)).badge,0)
  assert.equal((await call('/api/conversations','GET',undefined,member.cookie)).find(c=>c.id===room.id).unread,0)
  assert.equal((await call('/api/threads','GET',undefined,member.cookie)).items.find(t=>t.root.id===broadcast.id).unread,1,'count choice keeps reply visible in Threads')
  await until(async()=>{const rows=await row(reply);return rows.length===2&&rows.every(r=>r.state==='sent')},'two followed reply alerts')
  const actual=packets.filter(p=>new URL(p.value.url).searchParams.get('focus')===reply.id)
  assert.equal(actual.length,2);assert.ok(actual.every(p=>p.value.badge===0&&p.value.thread===broadcast.id),'encrypted packets carry chosen badge and thread action')
  await call(`/api/messages/${broadcast.id}/follow`,'POST',{follow:false},member.cookie)
  await send(room,'@channel Please confirm the revised window.',broadcast.id)
  assert.ok(!(await call(`/api/conversations/${room.id}/preferences`,'GET',undefined,member.cookie)).threads.includes(broadcast.id),'broadcast respects sticky unfollow')
  const untouched=await call('/api/conversations','POST',{name:'Incident response',kind:'private',participants:[member.user.id]},ownerCookie)
  const root=await send(untouched,'Incident checklist and customer communication plan')
  await call(`/api/conversations/${untouched.id}/read`,'POST',{seq:root.sequence},member.cookie)
  await call(`/api/conversations/${untouched.id}/notify`,'PATCH',{mobileThreads:'all'},member.cookie)
  const mobileReply=await send(untouched,'The primary region is healthy again.',root.id)
  assert.deepEqual((await row(mobileReply)).map(r=>r.device),[mobile.id])
  assert.equal((await call('/api/threads','GET',undefined,member.cookie)).items.find(t=>t.root.id===root.id).source,'all')
  assert.equal((await call('/api/notify/conversations','GET',undefined,member.cookie)).find(c=>c.conversation===untouched.id).mobileThreads,'all')
  // A setting change after enqueue cancels at final delivery, rather than sending stale policy.
  await call(`/api/conversations/${untouched.id}/notify`,'PATCH',{mobileThreads:'followed'},member.cookie)
  await until(async()=>(await row(mobileReply))[0]?.state==='cancelled','mobile override cancels queued reply')
  await call('/api/notify','PATCH',{push:{mentions:false,direct:false,threads:false,urgent:false}},member.cookie)
  await call('/api/devices','POST',{transport:'webpush',subscription:desktop.subscription,deviceClass:'desktop'},member.cookie)
  assert.equal((await call('/api/notify','GET',undefined,member.cookie)).push.threads,false,'re-registration preserves explicit opt-out')
  await call('/api/notify','PATCH',{push:{threads:true}},member.cookie)
  await call(`/api/messages/${broadcast.id}/follow`,'POST',{follow:true},member.cookie)
  const frontier=(await call('/api/conversations','GET',undefined,member.cookie)).find(c=>c.id===room.id).seq
  await call(`/api/conversations/${room.id}/read`,'POST',{seq:frontier},member.cookie)
  await send(room,'Customer success will staff the Thursday support handoff.',broadcast.id)
  // Finish setup once through its native public form before the real browser journey.
  await fetch(origin+'/setup',{method:'POST',redirect:'manual',headers:{cookie:ownerCookie,origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'})
  await browserJourney({origin,person:{cookie:member.cookie,user:member.user},room})
  await call(`/api/conversations/${untouched.id}/members`,'POST',{user:member.user.id,remove:true},ownerCookie)
  await call(`/api/conversations/${untouched.id}/notify`,'PATCH',{mobileThreads:'all'},member.cookie,403)
  assert.ok(!(await call('/api/threads','GET',undefined,member.cookie)).items.some(t=>t.conversation.id===untouched.id))
  assert.equal((await call('/api/me','GET',undefined,ownerCookie)).id,owner.id)
 }finally{await app.close()}
})

async function browserJourney({origin,person,room}){
 const executable=chromium.executablePath();assert.ok(!executable.includes('1194'),'current browser required')
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{await mkdir('evidence/thread-delivery',{recursive:true});for(const width of [1440,390]){
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width,height:width===390?844:1000}})
  try{
   const [name,...v]=person.cookie.split('=');await context.addCookies([{name,value:v.join('='),url:origin}]);const page=await context.newPage();page.on('pageerror',error=>console.error('Browser error:',error.message))
   await page.goto(origin+'/app?view=you')
   const badge=page.getByRole('checkbox',{name:'Count thread replies only when they mention me'});await expect(badge).toBeChecked();await badge.click();await expect(badge).not.toBeChecked();await badge.click();await expect(badge).toBeChecked()
   await page.getByLabel('This device',{exact:true}).selectOption(width===390?'mobile':'desktop');await badge.scrollIntoViewIfNeeded();await page.screenshot({animations:'disabled',path:`evidence/thread-delivery/counting-${width}.png`})
   await page.goto(origin+'/app?conversation='+room.id);await page.getByLabel('Conversation options',{exact:true}).click();await page.getByRole('button',{name:'Notification settings',exact:true}).click()
   const threads=page.getByLabel('Phone and tablet thread replies',{exact:true});await threads.selectOption('all');await expect(threads).toHaveValue('all');await expect(threads).toBeEnabled();await threads.scrollIntoViewIfNeeded();await page.screenshot({animations:'disabled',path:`evidence/thread-delivery/mobile-${width}.png`})
   await page.reload();await page.getByLabel('Conversation options',{exact:true}).click();await page.getByRole('button',{name:'Notification settings',exact:true}).click();await expect(page.getByLabel('Phone and tablet thread replies',{exact:true})).toHaveValue('all')
   await page.getByRole('button',{name:'Reset to defaults',exact:true}).click();await expect(page.getByLabel('Phone and tablet thread replies',{exact:true})).toHaveValue('')
   await page.getByRole('dialog').getByRole('button',{name:'Close dialog',exact:true}).click()
   await page.goto(origin+'/app?view=threads');await expect(page.getByRole('heading',{name:'Threads',exact:true})).toBeVisible();await expect(page.getByText('@channel Please review the Thursday rollout checklist.',{exact:true})).toBeVisible();await page.screenshot({animations:'disabled',path:`evidence/thread-delivery/threads-${width}.png`})
  }finally{await context.close()}
 }}finally{await browser.close()}
}
