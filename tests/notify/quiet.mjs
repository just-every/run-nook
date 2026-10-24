import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {mkdtemp,rm,writeFile,mkdir} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {expect} from '@playwright/test'
const require=createRequire(import.meta.url),{build}=createRequire(require.resolve('wrangler'))('esbuild')
// Keep the actual Worker/API, actual D1 queue and actual delivery implementation.
// The runner's existing explicit clock crosses calendar boundaries without a
// fake application endpoint or days of sleeping; only the send edge is fake.
export async function quietJourney({installation,rowan,sam,room,say,browser,evidence}){
 const temp=await mkdtemp(join(tmpdir(),'nook-quiet-clock-'))
 try{
  const output=join(temp,'run.mjs');await build({stdin:{contents:"export {drainNotifications} from './src/notify/run';export {quietAt} from './src/notify/quiet-time';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile:output,logLevel:'silent'})
  const {drainNotifications,quietAt}=await import(pathToFileURL(output))
  const baseline=(await rowan.get('/api/notify')).quietSchedule,days=baseline.days.map(d=>({...d,enabled:true}))
  const schedule={enabled:true,zone:'America/New_York',days,version:baseline.version}
  let saved=await rowan.patch('/api/notify',{mentions:true,quietSchedule:schedule})
  // The ownership of an overnight rule is its starting weekday; an exception
  // disabling Friday does not erase Thursday night's Friday morning interval.
  const fridayOff={...saved.quietSchedule,days:days.map(d=>({...d,enabled:d.day!==5}))};delete fridayOff.until;delete fridayOff.next
  saved=await rowan.patch('/api/notify',{quietSchedule:fridayOff})
  const year=new Date().getUTCFullYear()+1
  const sunday=(month,ordinal)=>{const date=new Date(Date.UTC(year,month,1));date.setUTCDate(1+(7-date.getUTCDay())%7+7*(ordinal-1));return date.toISOString().slice(0,10)}
  const spring=sunday(2,2),autumn=sunday(10,1),proof=[]
  const db=installation.database(),env={DB:db,AUTH_ORIGIN:installation.origin,AUTH_LOCAL:'true'}
  for(const [date,start,expectedEnd,elapsed] of [[spring,'03:00:00Z','11:00:00.000Z',8],[autumn,'02:00:00Z','12:00:00.000Z',10]]){
   const config={...saved.quietSchedule,days};delete config.until;delete config.next
   saved=await rowan.patch('/api/notify',{quietSchedule:config})
   const at=Date.parse(date+'T05:00:00Z'),before=Date.parse(date+'T'+start),end=Date.parse(date+'T'+expectedEnd)
   assert.equal(quietAt(config,before).until,end);assert.equal((end-before)/3600000,elapsed)
   const channel=await room('Quiet calendar '+date,rowan),message=await say(sam,channel,'Calendar boundary mention',{mentions:[rowan.user.id]})
   const sent=[];await drainNotifications(env,async mail=>{sent.push(mail);return {ok:true}},at)
   let [queue]=await installation.read("SELECT state,due FROM nook_notify_queue WHERE channel='email' AND message=?",message.id)
   assert.equal(queue.state,'pending');assert.equal(queue.due,end);assert.equal(sent.length,0)
   // Cache and the held queue survive the actual emitted Worker restarting.
   await installation.stop();await installation.start();env.DB=installation.database()
   await drainNotifications(env,async mail=>{sent.push(mail);return {ok:true}},end-1);assert.equal(sent.length,0)
   await drainNotifications(env,async mail=>{sent.push(mail);return {ok:true}},end)
   ;[queue]=await installation.read("SELECT state FROM nook_notify_queue WHERE channel='email' AND message=?",message.id);assert.equal(queue.state,'sent');assert.ok(sent.some(mail=>mail.deliveryId===message.id+'.'+rowan.user.id))
   proof.push({date,zone:config.zone,localStart:'22:00',localEnd:'07:00',elapsedHours:elapsed,heldUntil:new Date(end).toISOString(),released:true,restarted:true})
  }
  const exceptional={...saved.quietSchedule,days:fridayOff.days};delete exceptional.until;delete exceptional.next
  // A fixed local Friday night is disabled, while Saturday's explicit exception
  // remains active. These are calendar dates, not elapsed-hour approximations.
  const friday=new Date(Date.UTC(year,0,1));while(friday.getUTCDay()!==5)friday.setUTCDate(friday.getUTCDate()+1)
  const next=new Date(friday);next.setUTCDate(next.getUTCDate()+1)
  assert.equal(quietAt(exceptional,Date.parse(next.toISOString().slice(0,10)+'T04:00:00Z')).until,0)
  saved=await rowan.patch('/api/notify',{quietSchedule:exceptional})
  // Snooze has a public, bounded door and explains the affected Attention item.
  await rowan.patch('/api/settings',{dndUntil:Date.now()+8*86400000},400)
  const quietRoom=await room('Quiet explanation',rowan),item=await say(sam,quietRoom,'Explain this held mention',{mentions:[rowan.user.id]})
  await rowan.patch('/api/settings',{dndUntil:Date.now()+3600000})
  const attention=await rowan.get('/api/attention');assert.ok(attention.heldItems.some(r=>r.id===item.id+'.'+rowan.user.id&&r.explanation.includes('quiet')))
  const quietOff=(await rowan.get('/api/notify')).quietSchedule;delete quietOff.until;delete quietOff.next;saved=await rowan.patch('/api/notify',{quietSchedule:{...quietOff,enabled:false}})
  await rowan.patch('/api/settings',{dndUntil:null})
  await rowan.patch(`/api/conversations/${quietRoom}/notify`,{level:'nothing'})
  const silent=await rowan.get('/api/attention');assert.ok(silent.items.some(r=>r.message?.id===item.id&&r.explanation.includes('suppressed by your level')))
  const quietOn={...saved.quietSchedule};delete quietOn.until;delete quietOn.next;await rowan.patch('/api/notify',{quietSchedule:{...quietOn,enabled:true}})
  await mkdir(evidence,{recursive:true});await writeFile(join(evidence,'quiet-calendar.json'),JSON.stringify(proof,null,2)+'\n')
  for(const width of [1440,390]){
   const context=await browser.newContext({serviceWorkers:'block',viewport:{width,height:900}}),at=rowan.cookie.indexOf('=')
   try{
    await context.addCookies([{name:rowan.cookie.slice(0,at),value:rowan.cookie.slice(at+1),url:installation.origin}]);const page=await context.newPage();await page.goto(installation.origin+'/app?view=you')
    const section=page.getByRole('region',{name:'Your quiet schedule',exact:true});await section.getByLabel('Quiet time zone',{exact:true}).fill('America/New_York');await section.getByLabel('Friday quiet enabled',{exact:true}).uncheck();await section.getByRole('button',{name:'Save quiet schedule',exact:true}).click();await expect(section.getByRole('status')).toContainText('saved')
    await section.getByRole('heading',{name:'Your quiet schedule',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:join(evidence,`quiet-${width}.png`)})
    await section.getByRole('group',{name:'Friday',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:join(evidence,`quiet-weekday-${width}.png`)})
    await section.getByRole('button',{name:'Snooze alerts for one hour',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:join(evidence,`quiet-exceptions-${width}.png`)})
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
    await page.goto(installation.origin+'/app?view=attention');await expect(page.getByText(/Explain why:/).first()).toBeVisible();await page.screenshot({path:join(evidence,`quiet-attention-${width}.png`)})
    await rowan.patch('/api/settings',{dndUntil:Date.now()+3600000});await page.reload();await expect(page.getByText(/Explain why: Held until/).first()).toBeVisible();await expect(page.getByRole('heading',{name:"You're all caught up",exact:true})).toHaveCount(0);await page.screenshot({path:join(evidence,`quiet-held-${width}.png`)});await rowan.patch('/api/settings',{dndUntil:null})
   }finally{await context.close()}
  }
  const final=(await rowan.get('/api/notify')).quietSchedule;delete final.until;delete final.next;await rowan.patch('/api/notify',{quietSchedule:{...final,enabled:false}});await rowan.patch('/api/settings',{dndUntil:null})
  const vacation={starts:Date.now()-60000,ends:Date.now()+3600000};await rowan.patch('/api/notify',{vacation,urgent:true,urgentQuiet:false});
  const away=await room('synthetic-nook vacation mail',rowan),held=await say(sam,away,'synthetic-nook vacation mention',{mentions:[rowan.user.id]});
  const sent=[];env.DB=installation.database();await drainNotifications(env,async mail=>{sent.push(mail);return {ok:true}},Date.now()+10000);
  assert.ok(!sent.some(mail=>mail.deliveryId===held.id+'.'+rowan.user.id));assert.equal((await installation.read("SELECT due FROM nook_notify_queue WHERE message=?",held.id))[0].due,vacation.ends);
  await installation.stop();await installation.start();assert.deepEqual((await rowan.get('/api/notify')).vacation,vacation);env.DB=installation.database();
  await drainNotifications(env,async mail=>{sent.push(mail);return {ok:true}},vacation.ends);assert.ok(sent.some(mail=>mail.deliveryId===held.id+'.'+rowan.user.id));
  await rowan.patch('/api/notify',{vacation:null,urgent:false,urgentQuiet:false});
  await rowan.patch('/api/notify',{mentions:false,awayEmail:true,awayInterval:15});
  const direct=await sam.post('/api/conversations',{kind:'dm',name:'synthetic-nook away bundle',participants:[rowan.user.id]});
  const first=await say(sam,direct.id,'synthetic-nook away mention',{mentions:[rowan.user.id]}),second=await say(sam,direct.id,'synthetic-nook away DM');
  const awaySent=[];env.DB=installation.database();const created=Date.now();
  await drainNotifications(env,async mail=>{awaySent.push(mail);return {ok:true}},created+14*60000);assert.ok(!awaySent.some(mail=>[first.id+'.'+rowan.user.id,second.id+'.'+rowan.user.id].includes(mail.deliveryId)));
  await drainNotifications(env,async mail=>{awaySent.push(mail);return {ok:true}},created+16*60000);assert.equal(awaySent.filter(mail=>[first.id+'.'+rowan.user.id,second.id+'.'+rowan.user.id].includes(mail.deliveryId)).length,1);
  await rowan.patch('/api/notify',{mentions:true,awayEmail:false});
 }finally{await rm(temp,{recursive:true,force:true})}
}
