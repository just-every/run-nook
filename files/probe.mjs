import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {execFileSync} from 'node:child_process'
import {installation} from '/home/agent/rer-consolidation/work/sd-nook-str-actions-1-fix1/run-nook/tests/push/fixture.mjs'
import {signIn} from '/home/agent/rer-consolidation/work/sd-nook-str-actions-1-fix1/run-nook/tests/auth-support.mjs'
import {chromium,expect} from '/home/agent/rer-consolidation/work/sd-nook-str-actions-1-fix1/run-nook/node_modules/@playwright/test/index.mjs'
const stage=process.argv[2];assert.ok(['before','after'].includes(stage))
const output=resolve('/home/agent/rer-consolidation/work/sd-nook-str-actions-1-fix1/packet',stage);await mkdir(output,{recursive:true})
const app=await installation(async()=>new Response(null,{status:201}),{workerOptions:{assets:{directory:process.cwd()+'/dist/client',binding:'ASSETS',run_worker_first:true}}})
let browser
const receipts={stage,sourceHead:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sequence:[],doors:[],screens:[]}
try{
 const {origin}=app,owner={user:app.owner,cookie:app.ownerCookie}
 const call=async(path,method='GET',body,cookie=owner.cookie,status=200)=>{
  const response=await fetch(origin+path,{method,redirect:'manual',headers:{origin,cookie,...(body===undefined?{}:{'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})})
  const raw=await response.text();assert.equal(response.status,status,method+' '+path+': '+raw)
  receipts.sequence.push({method,path,status:response.status})
  return {raw,data:response.headers.get('content-type')?.includes('application/json')?JSON.parse(raw):undefined,status:response.status}
 }
 const setup=await fetch(origin+'/setup',{method:'POST',redirect:'manual',headers:{cookie:owner.cookie,origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'});assert.equal(setup.status,303)
 const room=(await call('/api/conversations','POST',{kind:'channel',name:'B-1 welcome'})).data
 const person=async(name,email,role)=>{
  await call('/api/team/invitations','POST',{email,role,mode:'member',scopes:[room.id]})
  await call('/auth/invite','POST',{email,displayName:name,role},owner.cookie,202)
  return signIn(origin,email,{requestLink:false})
 }
 const member=await person('Dev member','synthetic-nook-b1-member@example.test','member')
 const admin=await person('Dev admin','synthetic-nook-b1-admin@example.test','admin')
 const unrelatedAdmin=await person('Unrelated admin','synthetic-nook-b1-outsider@example.test','admin')
 const dm=(await call('/api/conversations','POST',{name:'B-1 confidential DM title',kind:'dm',participants:[admin.user.id]},member.cookie)).data
 await call('/api/conversations/'+dm.id+'/messages','POST',{body:'B-1 private body must never enter audit',intent:crypto.randomUUID()},member.cookie)
 await call('/api/conversations/'+dm.id+'/messages','GET',undefined,owner.cookie,403)
 await call('/api/conversations/'+dm.id+'/messages','GET',undefined,unrelatedAdmin.cookie,403)
 const filters='kind=membership.join&scope='+encodeURIComponent(dm.id)
 for(const [reader,actor] of [['owner',owner],['unrelated-admin',unrelatedAdmin],['participant-admin',admin]]){
  for(const format of ['page','csv','json']){
   const query=filters+(format==='page'?'':'&format='+format),value=await call('/api/team/audit?'+query,'GET',undefined,actor.cookie)
   const file=reader+'-'+format+(format==='page'?'.json':'.'+format);await writeFile(resolve(output,file),value.raw+'\n')
   const items=format==='csv'?undefined:value.data.items
   const leak=items?items.some(row=>row.subject===admin.user.id&&row.subjectName===admin.user.name):value.raw.includes(admin.user.id)||value.raw.includes('Dev admin')
   assert.ok(items?items.length===2:value.raw.trim().split('\n').length===3,'both membership events retained')
   if(reader!=='participant-admin')assert.equal(leak,stage==='before',reader+' '+format+' recipient disclosure')
   else assert.equal(leak,true,'participant keeps own DM audit detail')
   receipts.doors.push({reader,format,status:value.status,file,rows:2,recipientDisclosed:leak,items})
  }
 }
 browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']})
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block',acceptDownloads:true})
  try{
   const [name,...value]=owner.cookie.split('=');await context.addCookies([{name,value:value.join('='),url:origin}])
   const page=await context.newPage();await page.goto(origin+'/app?view=team')
   const log=page.getByRole('region',{name:'Audit log',exact:true});await expect(log.locator('li').first()).toBeVisible()
   await log.getByText('Filters',{exact:true}).click();await log.getByLabel('Kind',{exact:true}).selectOption('membership.join')
   await log.getByLabel('Scope',{exact:true}).fill('a direct conversation');await log.getByRole('button',{name:'Apply text filters',exact:true}).click();await expect(log.locator('li')).toHaveCount(2)
   const text=await log.locator('ol').innerText();assert.equal(text.includes('Dev admin'),stage==='before');assert.ok(text.includes('Dev member'));assert.ok(text.includes('a direct conversation'))
   await writeFile(resolve(output,'owner-team-audit-'+width+'.txt'),text+'\n')
   for(const format of ['CSV','JSON']){
    const wait=page.waitForEvent('download');await log.getByRole('button',{name:'Download '+format,exact:true}).click();const download=await wait
    await download.saveAs(resolve(output,'owner-ui-'+format.toLowerCase()+'-'+width+'.'+format.toLowerCase()))
   }
   await log.getByText('Filters',{exact:true}).click();await log.locator('li').first().scrollIntoViewIfNeeded()
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
   const screenshot='owner-team-audit-'+width+'.png';await page.screenshot({path:resolve(output,screenshot)})
   receipts.screens.push({reader:'owner',width,height:900,file:screenshot,auditRows:2,recipientDisclosed:text.includes('Dev admin'),text})
  }finally{await context.close()}
 }
 await writeFile(resolve(output,'receipt.json'),JSON.stringify(receipts,null,2)+'\n')
 console.log(JSON.stringify({stage,doors:receipts.doors.map(({items,...row})=>row),screens:receipts.screens},null,2))
}finally{await browser?.close();await app.close()}
