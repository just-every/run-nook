import {openConversationDetails} from './conversation-details.mjs'
import {chromium,expect} from '@playwright/test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {mkdir,mkdtemp,readFile,rm} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {tmpdir} from 'node:os'
import {slackFixture} from './slack-import/fixture.mjs'
import {importDoorClient} from './import-door-support.mjs'

const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
function validateBundle(bundle){
 assert.ok(bundle.report.complete)
 assert.equal(bundle.records.length,bundle.report.records)
 assert.equal(bundle.files.length,bundle.report.files)
 assert.equal(bundle.files.reduce((n,file)=>n+file.size,0),bundle.report.bytes)
 for(const file of bundle.files){const bytes=Buffer.from(file.base64,'base64');assert.equal(bytes.length,file.size);assert.equal(hash(bytes),file.sha256)}
 return bundle
}
export async function readableExportBrowser({origin,owner,member,outsider,destination='evidence/readable-export'}){
 origin=typeof origin==='function'?origin():origin
 const cookie=actor=>{const at=actor.cookie.indexOf('=');return {name:actor.cookie.slice(0,at),value:actor.cookie.slice(at+1),url:origin}}
 async function api(path,{body,actor=owner,method=body===undefined?'GET':'POST',status=200}={}){
  const response=await fetch(origin+path,{method,headers:{origin,cookie:actor.cookie,...(body===undefined?{}:{'content-type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)})
  assert.equal(response.status,status,`${method} ${path}: ${response.ok?'':await response.clone().text()}`)
  return response.headers.get('content-type')?.includes('json')?response.json():response
 }
 // Real synthetic Slack ZIP through the ordinary reviewed import doors. Its
 // omitted private channel stays named in import review, never made public.
 const suffix=crypto.randomUUID().slice(0,8),door=importDoorClient({origin,owner,users:async()=>[owner,member,outsider].map(a=>({...a.user,active:true,mode:'member'}))}),upload=await door.inspect(slackFixture())
 const review={namespace:'exit-browser-'+suffix,channels:upload.channels.map(c=>({sourceId:c.sourceId,name:'Exit source '+c.name+' '+suffix,members:[owner.user.id,member.user.id]})),actors:{U1:owner.user.id,U2:null,U404:null},acceptedOmissions:[]}
 const local=await door.prepare(upload,review);if(local.summary.needsOmissionReview)review.acceptedOmissions=[local.summary.omissionDigest]
 const preview=await door.plan(upload,review);await door.finish(preview)
 const secretRoom=await api('/api/conversations',{actor:member,body:{name:'Leadership compensation review',kind:'dm',participants:[outsider.user.id]}})
 const privateBytes=Buffer.from('Private workspace file: compensation handoff\n'),privateFile=await api(`/api/conversations/${secretRoom.id}/attachments`,{actor:member,body:{name:'leadership-handoff.txt',mime:'text/plain',data:privateBytes.toString('base64'),intent:crypto.randomUUID()}})
 await api(`/api/conversations/${secretRoom.id}/messages`,{actor:member,body:{body:'Keep the compensation handoff within this audience.',attachments:[privateFile.id],intent:crypto.randomUUID()}})
 await api('/api/readable-exports',{body:{scope:'conversation',conversationId:secretRoom.id,custodyAccepted:true},status:403})
 const directory=await mkdtemp(join(tmpdir(),'nook-readable-browser-'))
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{
  await mkdir(destination,{recursive:true})
  for(const width of [1440,390]){
   const room=await api('/api/conversations',{body:{name:'Launch handoff '+width,kind:'private',participants:[member.user.id]}})
   const send=(body,extra={})=>api(`/api/conversations/${room.id}/messages`,{body:{body,intent:crypto.randomUUID(),...extra}})
   const root=await send('Customer launch: confirm the support rotation before Thursday.')
   await api('/api/messages/'+root.id,{method:'PATCH',body:{version:root.version,body:'Customer launch: confirm the support rotation before Friday.'}})
   const reply=await api(`/api/conversations/${room.id}/messages`,{actor:member,body:{body:'The Brisbane handoff is confirmed.',parent:root.id,intent:crypto.randomUUID()}})
   await api(`/api/messages/${root.id}/reactions`,{actor:member,body:{emoji:'✅',add:true}})
   const fileBytes=Buffer.from('Launch checklist\n1. Confirm support rotation\n2. Notify customers\n'),file=await api(`/api/conversations/${room.id}/attachments`,{body:{name:'launch-checklist-'+width+'.txt',mime:'text/plain',data:fileBytes.toString('base64'),intent:crypto.randomUUID()}})
   await send('The checklist is attached.',{attachments:[file.id]})
   const work=await api(`/api/conversations/${room.id}/outcomes`,{body:{kind:'commitment',body:'Confirm the customer handoff',assignee:member.user.id,source:root.id}})
   await api('/api/outcomes/'+work.id,{method:'PATCH',actor:member,body:{version:work.version,action:'accept'}})
   await api(`/api/conversations/${room.id}/outcomes`,{body:{kind:'decision',body:'Use the Friday launch window',source:root.id}})
   for(let n=0;n<44;n++)await send(`Customer readiness update ${n+1}: support and product owners have reviewed the launch checklist.`)
   const context=await browser.newContext({serviceWorkers:'block',viewport:{width,height:width===390?844:1000},acceptDownloads:true})
   try{
    await context.addCookies([cookie(owner)])
    const page=await context.newPage();await page.goto(origin+'/app?conversation='+room.id)
    await openConversationDetails(page)
    const scoped=page.getByRole('dialog').getByRole('region',{name:'Readable export',exact:true})
    await scoped.getByRole('checkbox',{name:/I will keep downloaded copies private/}).check()
    await scoped.getByRole('button',{name:'Prepare conversation',exact:true}).click()
    await expect(scoped.getByRole('button',{name:'Download JSON',exact:true})).toBeVisible({timeout:90_000})
    const selectedEvent=page.waitForEvent('download');await scoped.getByRole('button',{name:'Download JSON',exact:true}).click()
    const selected=validateBundle(JSON.parse(await readFile(await (await selectedEvent).path(),'utf8')))
    assert.deepEqual(selected.records.filter(r=>r.type==='conversations').map(r=>r.data.id),[room.id])
    await scoped.getByRole('heading',{name:'Completeness report',exact:true}).scrollIntoViewIfNeeded()
    await page.screenshot({animations:'disabled',path:resolve(destination,`conversation-${width}.png`)})
    await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click()
    await page.goto(origin+'/app?view=you')
    const region=page.getByRole('region',{name:'Readable export',exact:true})
    await expect(region.getByRole('heading',{name:'Readable export',exact:true})).toBeVisible()
    await region.getByText('Owner workspace export policy',{exact:true}).click()
    const policy=region.getByRole('checkbox',{name:'Allow owners to export the whole workspace, including private conversations',exact:true})
    if(!await policy.isChecked()){await policy.check();await region.getByRole('button',{name:'Save workspace export policy',exact:true}).click()}
    await region.getByLabel('Export scope',{exact:true}).selectOption('workspace')
    await expect(region.getByRole('status').filter({hasText:/Workspace export policy version/})).toBeVisible()
    await region.getByText('Recent workspace export policy changes',{exact:true}).click()
    await expect(region.getByText(/announced to \d+ members/).last()).toBeVisible()
    await region.getByLabel('Export scope',{exact:true}).scrollIntoViewIfNeeded();await page.screenshot({animations:'disabled',path:resolve(destination,`scope-${width}.png`)})
    await policy.scrollIntoViewIfNeeded();await page.screenshot({animations:'disabled',path:resolve(destination,`policy-${width}.png`)})
    await region.getByRole('checkbox',{name:/I will keep downloaded copies private/}).check()
    await region.getByRole('button',{name:'Prepare whole workspace',exact:true}).click()
    await region.getByRole('button',{name:'Cancel preparation',exact:true}).click()
    await expect(region.getByText('Preparation cancelled.',{exact:false})).toBeVisible()
    await page.screenshot({animations:'disabled',path:resolve(destination,`cancelled-${width}.png`)})
    // A reload discards all browser preparation state. Resume uses only the
    // real server's durable cursor, then downloads all pages and private bytes.
    await page.reload();await region.getByRole('button',{name:'Resume',exact:true}).first().click()
    await expect(region.getByRole('button',{name:'Download offline HTML',exact:true})).toBeVisible({timeout:90_000})
    await region.getByText('Included counts and named omissions',{exact:true}).click()
    await expect(region.getByText(/Installation-local credentials, sessions/)).toBeVisible()
    await page.screenshot({animations:'disabled',path:resolve(destination,`complete-${width}.png`)})
    const htmlEvent=page.waitForEvent('download',{timeout:90_000});await region.getByRole('button',{name:'Download offline HTML',exact:true}).click()
    const htmlDownload=await htmlEvent,htmlPath=join(directory,'readable-'+width+'.html');await htmlDownload.saveAs(htmlPath)
    const html=await readFile(htmlPath,'utf8'),bundle=validateBundle(JSON.parse(html.match(/<script type="application\/json" id="nook-export">(.*?)<\/script>/s)[1]))
    assert.equal(bundle.report.scope,'workspace');assert.ok(Number.isSafeInteger(bundle.report.workspacePolicyVersion))
    assert.ok(bundle.records.some(r=>r.type==='messages'&&r.conversation===secretRoom.id&&r.data.body==='Keep the compensation handoff within this audience.'))
    assert.deepEqual(Buffer.from(bundle.files.find(file=>file.id===privateFile.id).base64,'base64'),privateBytes)
    assert.ok(bundle.records.some(r=>r.type==='workspace_configuration'))
    assert.ok(bundle.records.some(r=>r.type==='messages'&&r.data.id===reply.id&&r.data.parent===root.id))
    assert.ok(bundle.records.some(r=>r.type==='message_versions'&&r.data.message===root.id&&r.data.body.includes('before Thursday')))
    assert.ok(bundle.records.some(r=>r.type==='outcome_versions'&&r.data.outcome===work.id&&r.data.status==='accepted'))
    assert.ok(bundle.records.some(r=>r.type==='imported_messages'&&r.data.parent))
    const ownBytes=bundle.files.find(f=>f.id===file.id);assert.ok(ownBytes);assert.deepEqual(Buffer.from(ownBytes.base64,'base64'),fileBytes)
    const offline=await browser.newContext({serviceWorkers:'block',viewport:{width,height:width===390?844:1000},acceptDownloads:true})
    try{
     await offline.setOffline(true);const reader=await offline.newPage(),network=[]
     reader.on('request',request=>{if(/^https?:/i.test(request.url()))network.push(request.url())})
     await reader.goto(pathToFileURL(htmlPath).href)
     const conversation=reader.getByRole('heading',{name:room.name+' private',exact:true}).locator('..')
     await expect(conversation).toBeVisible()
     await expect(conversation.locator('pre.message').filter({hasText:'The Brisbane handoff is confirmed.'})).toBeVisible()
     await conversation.getByText('Message version history',{exact:true}).first().click()
     await reader.screenshot({animations:'disabled',path:resolve(destination,`offline-${width}.png`)})
     const byteEvent=reader.waitForEvent('download');await reader.getByRole('link',{name:'launch-checklist-'+width+'.txt',exact:true}).click()
     const downloaded=await byteEvent;assert.deepEqual(await readFile(await downloaded.path()),fileBytes)
     assert.deepEqual(network,[],'offline HTML attempts no external requests')
    }finally{await offline.close()}
    const jsonlEvent=page.waitForEvent('download',{timeout:90_000});await region.getByRole('button',{name:'Download JSONL',exact:true}).click()
    const jsonlDownload=await jsonlEvent,lines=(await readFile(await jsonlDownload.path(),'utf8')).trimEnd().split('\n').map(line=>JSON.parse(line))
    const jsonl=validateBundle({format:lines[0].format,version:lines[0].version,report:lines[0].report,records:lines.slice(1).filter(line=>line.type!=='file_bytes'),files:lines.filter(line=>line.type==='file_bytes').map(line=>line.data)})
    assert.deepEqual(jsonl,bundle)
    // A completed source changing later produces an actionable UI error.
    await api('/api/messages/'+root.id,{method:'PATCH',body:{version:root.version+1,body:'Customer launch: updated source after export.'}})
    await region.getByRole('button',{name:'Open report',exact:true}).first().click()
    await expect(region.getByRole('alert')).toContainText(/source changed|scope is no longer available/i)
    await expect(region.getByRole('button',{name:'Download offline HTML',exact:true})).toHaveCount(0)
    await expect(region.getByText(/Whole workspace · invalidated/).first()).toBeVisible()
    await region.getByRole('alert').scrollIntoViewIfNeeded();await page.screenshot({animations:'disabled',path:resolve(destination,`stale-${width}.png`)})
   }finally{await context.close()}
   // An authorized member can prepare a selected conversation, then loses all
   // report/page/file reads when removed. The UI names the unavailable job.
   let revoked=await api('/api/readable-exports',{actor:member,body:{scope:'conversation',conversationId:room.id,custodyAccepted:true}})
   for(let n=0;!revoked.complete&&n<150;n++)revoked=await api(`/api/readable-exports/${revoked.id}/step`,{actor:member,body:{}})
   assert.ok(revoked.complete)
   await api(`/api/conversations/${room.id}/members`,{body:{user:member.user.id,remove:true}})
   await api('/api/readable-exports/'+revoked.id,{actor:member,status:403})
   const limited=await browser.newContext({serviceWorkers:'block',viewport:{width,height:width===390?844:1000}})
   try{
    await limited.addCookies([cookie(member)]);const page=await limited.newPage();await page.goto(origin+'/app?view=you')
    const region=page.getByRole('region',{name:'Readable export',exact:true})
    await expect(region.getByText(/Current owners may export every published conversation/).last()).toBeVisible()
    await expect(region.getByText('Owner workspace export policy',{exact:true})).toHaveCount(0)
    await expect(region.getByLabel('Export scope',{exact:true})).toHaveCount(0)
    await expect(region.getByText(/Conversation · unavailable/).first()).toBeVisible()
    await expect(region.getByText('Start a new export from your current scope.',{exact:true}).first()).toBeVisible()
    await region.getByText(/Conversation · unavailable/).first().scrollIntoViewIfNeeded();await page.screenshot({animations:'disabled',path:resolve(destination,`revoked-${width}.png`)})
   }finally{await limited.close()}
   // The hosted exit export reports a platform HTML error page by its status, never as a parser message, and a retry downloads.
   const exit=await browser.newContext({serviceWorkers:'block',viewport:{width,height:width===390?844:1000},acceptDownloads:true})
   try{
    await exit.addCookies([cookie(owner)]);const page=await exit.newPage();let refused=0
    await page.route('**/api/portability/exports',route=>route.request().method()==='POST'&&!refused++?route.fulfill({status:502,contentType:'text/html',body:'<!DOCTYPE html><html><body>Bad gateway</body></html>'}):route.continue())
    await page.goto(origin+'/export')
    const start=page.getByRole('button',{name:'Download workspace archive',exact:true}),alert=page.getByRole('alert').filter({hasText:/HTTP/})
    await start.click();await expect(alert).toContainText('HTTP 502');await expect(alert).not.toContainText('Unexpected token')
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true)
    await page.screenshot({animations:'disabled',path:resolve(destination,`exit-502-${width}.png`)})
    const archive=page.waitForEvent('download',{timeout:90_000});await start.click()
    assert.equal((await archive).suggestedFilename(),'nook-workspace.rer');await expect(page.getByRole('status').filter({hasText:/archive is ready/})).toBeVisible({timeout:90_000})
    assert.equal(refused,2)
   }finally{await exit.close()}
  }
 }finally{await browser.close();await rm(directory,{recursive:true,force:true})}
}
