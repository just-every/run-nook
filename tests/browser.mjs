import assert from 'node:assert/strict'
import {chromium,expect} from '@playwright/test'
import {keyed} from './dev-key.mjs'
import {mkdir,writeFile,readFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {browserSignIn} from './auth-support.mjs'
import {hostileMessage,assertSafeMessage} from './browser-markup.mjs'
import {auditComposerRouting} from './accessibility.mjs'
// A destination may carry its unread count in its accessible name, as in "Attention 2".
const nav=(page,name)=>page.getByRole('navigation',{name:'Workspace',exact:true}).getByRole('button',{name:new RegExp('^'+name+'( \\d+)?$')})
async function json(page,origin,path,data,method=data?'POST':'GET'){
 const response=await page.request.fetch(origin+'/api/'+path,{method,data});assert.equal(response.status(),200,`${method} ${path}`);return response.json()
}
export async function runBrowser(origin,destination){
 if(process.env.TEAM_CHAT_BROWSER_HOLD==='1')throw Error('Browser launch hold is active; no browser was started')
 const browser=await keyed(chromium).launch({headless:true}),checks=[],captures=[]
 await mkdir(resolve(destination,'captures'),{recursive:true})
 try{
  for(const [label,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
   const aliceContext=await browser.newContext({viewport}),bobContext=await browser.newContext({viewport}),alice=await aliceContext.newPage(),bob=await bobContext.newPage(),errors=[],failedRequests=[]
   let intentionalAbort=false,abortedMessages=0,abortedUploads=0,revocationExpected=false
   const expectedFailures=new Map()
   for(const p of [alice,bob]){
    p.on('pageerror',e=>errors.push(e.message))
    p.on('console',message=>{if(message.type()==='error'&&!(intentionalAbort&&/net::ERR_FAILED/.test(message.text()))&&!(revocationExpected&&/status of 403/.test(message.text())))errors.push(new URL(message.location().url||origin).pathname+': '+message.text().replace(/\?[^\s]+/g,'?[redacted]'))})
    // Navigation and revocation cancel in-flight reads on purpose; failed writes still count.
    p.on('requestfailed',request=>{if(request.failure()?.errorText==='net::ERR_ABORTED'&&request.method()==='GET')return;const kind=expectedFailures.get(request.url());if(kind){expectedFailures.delete(request.url());if(kind==='upload')abortedUploads++;else abortedMessages++}else failedRequests.push({path:new URL(request.url()).pathname,error:request.failure()?.errorText})})
   }
   const suffix=Date.now().toString(36),aliceName=`Studio${suffix}-Alice`,bobName=`Studio${suffix}-Bob`,channelName=`Launch ${label}`
   const shot=async(page,state)=>{const file=resolve(destination,'captures',`${label}-${state}.png`);await page.screenshot({path:file,fullPage:true});captures.push(file)}
   try{
    await browserSignIn(alice,origin,aliceName);await browserSignIn(bob,origin,bobName)
    const aliceUser=await json(alice,origin,'me'),bobUser=await json(bob,origin,'me')
    await alice.getByRole('button',{name:'Create channel',exact:true}).last().click()
    await alice.getByLabel('Channel name',{exact:true}).fill(channelName)
    await alice.getByLabel(bobName,{exact:true}).check()
    await alice.getByRole('dialog').getByRole('button',{name:'Create channel',exact:true}).click()
    await alice.getByRole('heading',{name:channelName,exact:false}).waitFor()
    const channel=(await json(alice,origin,'conversations')).find(c=>c.name===channelName)
    const messages=[]
    for(const [i,body] of ['The onboarding review is ready. Please check the last two screens.','I checked the welcome step. The wording is clearer now.','The help link is now visible on smaller screens.','We can keep the first release focused on the onboarding flow.','The support handover is ready for a final review.','Let’s agree who will send the launch notes.'].entries())messages.push(await json(i%2?bob:alice,origin,`conversations/${channel.id}/messages`,{body,intent:crypto.randomUUID()}))
    await alice.reload();await alice.getByText(messages[5].body,{exact:true}).waitFor()
    await shot(alice,'channel')
    await auditComposerRouting(alice,alice.locator('.chat .composer'),destination,`${label}-channel`)
    const geometry=await alice.evaluate(()=>({title:document.querySelector('.heading h1').getBoundingClientRect().toJSON(),messages:[...document.querySelectorAll('.chat .message')].map(e=>e.getBoundingClientRect().toJSON()),composer:document.querySelector('.chat .composer').getBoundingClientRect().toJSON(),width:innerWidth,scrollWidth:document.documentElement.scrollWidth}))
    assert.ok(geometry.scrollWidth<=geometry.width,'conversation fits viewport')
    await writeFile(resolve(destination,`${label}-geometry.json`),JSON.stringify(geometry,null,2))
    await alice.locator('[data-message="'+messages[5].id+'"]').getByRole('button',{name:'Ask someone',exact:true}).click()
    await alice.getByLabel('What needs to happen?',{exact:true}).fill('Send the launch notes to the team')
    await alice.getByLabel('Ask a person',{exact:true}).selectOption(bobUser.id)
    await alice.getByLabel('Do by',{exact:true}).fill('2026-10-30')
    await alice.getByRole('button',{name:'Ask person',exact:true}).click()
    // The dialog closes once the request is saved; until then the page behind it is inert.
    await alice.getByRole('dialog').waitFor({state:'hidden'})
    const proposal=(await json(alice,origin,`conversations/${channel.id}/outcomes`))[0]
    const composer=alice.getByLabel('Message '+channelName,{exact:true})
    await composer.fill('Please review the handover before the team meets.')
    await alice.locator('.chat .composer-options summary').click()
    await alice.getByLabel('Notify a person',{exact:true}).selectOption(bobUser.id)
    await alice.getByLabel('Priority',{exact:true}).selectOption('urgent')
    await alice.getByLabel('Why is this urgent?',{exact:true}).fill('The team meeting starts in an hour.')
    await composer.press('Enter')
    await expect(composer).toHaveValue('')
    await nav(bob,'Attention').click();await bob.getByText('Send the launch notes to the team',{exact:true}).waitFor()
    await bob.getByText('The team meeting starts in an hour.',{exact:true}).waitFor();await shot(bob,'attention')
    await bob.getByRole('button',{name:'Quiet for one hour',exact:true}).click()
    await bob.getByText('The team meeting starts in an hour.',{exact:true}).waitFor()
    await expect(bob.getByText('Send the launch notes to the team',{exact:true})).toHaveCount(0)
    await bob.getByRole('button',{name:'End quiet time',exact:true}).click()
    // Real short deadlines exercise the one-shot server-directed wake without a
    // new message, manual refresh or recurring client poll.
    await json(bob,origin,'settings',{dndUntil:Date.now()+3000},'PATCH')
    await expect(bob.getByText('Send the launch notes to the team',{exact:true})).toHaveCount(0)
    await bob.getByText('Send the launch notes to the team',{exact:true}).waitFor()
    const inbox=await json(bob,origin,'attention')
    const urgent=inbox.items.find(item=>item.reason==='urgent-request'&&item.conversation===channel.id)
    assert.ok(urgent)
    // Another session snoozes; this open tab learns of it from the live hub.
    await json(bob,origin,`attention/${urgent.id}`,{action:'snooze',until:Date.now()+8000})
    await expect(bob.getByText('The team meeting starts in an hour.',{exact:true})).toHaveCount(0,{timeout:7000})
    await bob.getByText('The team meeting starts in an hour.',{exact:true}).waitFor()
    checks.push(`${label}: quiet and snooze expire in the open Attention view without another message or reload`)


    const proposalCard=bob.locator('.attention-card').filter({hasText:'Send the launch notes to the team'})
    await proposalCard.getByRole('button',{name:'Accept',exact:true}).click()
    await expect(proposalCard.getByText('Accepted',{exact:true})).toBeVisible()
    assert.equal(new URL(bob.url()).searchParams.get('view'),'attention','one tap acceptance stays in Attention')
    assert.equal((await json(alice,origin,`conversations/${channel.id}/outcomes`))[0].status,'accepted')
    await shot(bob,'accepted');await bob.reload();await bob.getByText('Accepted',{exact:true}).waitFor()
    await proposalCard.getByRole('button',{name:'Discuss',exact:true}).click()
    await bob.getByRole('heading',{name:'Thread',exact:true}).waitFor()
    await auditComposerRouting(bob,bob.locator('.decisions .composer'),destination,`${label}-thread`)
    await expect(bob.locator('.thread-log').getByText(messages[5].body,{exact:true})).toBeInViewport()
    if(label==='mobile')assert.equal(await bob.locator('textarea:visible').count(),1,'phone thread has one composer')
    await bob.getByLabel('Reply in thread',{exact:true}).fill('I can send them after the review.')
    await bob.getByLabel('Reply in thread',{exact:true}).press('Enter')
    await bob.getByText('I can send them after the review.',{exact:true}).waitFor();await shot(bob,'thread')
    await bob.getByRole('button',{name:'Back',exact:true}).click();await bob.goBack();await bob.getByRole('heading',{name:'Thread',exact:true}).waitFor();await bob.goForward()
    await nav(bob,'Attention').click();await bob.getByRole('button',{name:'Report done',exact:true}).click();await bob.getByText('Reported done',{exact:true}).waitFor()
    await nav(alice,'Attention').click();await alice.getByText('Reported done',{exact:true}).first().waitFor();await shot(alice,'reported-done')
    await expect(alice.locator('.attention-card').filter({hasText:'Send the launch notes to the team'}),'one current card per commitment, not one per event').toHaveCount(1)
    checks.push(`${label}: real private channel, urgent request, one-tap exact acceptance, discussion source/thread, reported completion visible to author, reload and history`)
    // A material revision requests new agreement. Stale compare-and-swap cannot accept.
    const unfinished=await json(alice,origin,`conversations/${channel.id}/outcomes`,{kind:'commitment',body:'Review next week’s handover',assignee:bobUser.id,source:messages[0].id})
    await json(bob,origin,`outcomes/${unfinished.id}`,{version:unfinished.version,action:'accept'},'PATCH')
    await json(alice,origin,`outcomes/${unfinished.id}`,{version:2,body:'Review the revised handover',deadline:'2026-11-02'},'PATCH')
    const stale=await bob.request.patch(origin+`/api/outcomes/${unfinished.id}`,{data:{version:2,action:'accept'}});assert.equal(stale.status(),409)
    await nav(bob,'Attention').click();await bob.getByText('Review the revised handover',{exact:true}).first().waitFor()
    await expect(bob.locator('.attention-card').filter({hasText:'Review the revised handover'}).first().getByRole('button',{name:'Accept',exact:true})).toBeVisible()
    // Real history crosses a page boundary, then search opens the exact thread context.
    const deep=await json(alice,origin,`conversations/${channel.id}/messages`,{body:'Detailed planning context',intent:crypto.randomUUID()})
    const updates=Array.from({length:155},(_,i)=>`Planning update ${i+1}`)
    for(const body of updates)await json(alice,origin,`conversations/${channel.id}/messages`,{body,intent:crypto.randomUUID()})
    const deepReply=await json(bob,origin,`conversations/${channel.id}/messages`,{body:'Deep context reply for the release',parent:deep.id,intent:crypto.randomUUID()})
    const historyRequests=[]
    // Workspace refreshes bundle bounded history; target discovery still uses
    // the dedicated message-window endpoint. Observe both public transports.
    const bundledHistory=url=>url.pathname==='/api/workspace'&&url.searchParams.get('view')==='chat'&&url.searchParams.get('conversation')===channel.id
    const recordHistory=request=>{const url=new URL(request.url());if(request.method()==='GET'&&(url.pathname.startsWith(`/api/conversations/${channel.id}/messages`)||bundledHistory(url)))historyRequests.push(url)}
    alice.on('request',recordHistory)
    // The bounded-latest-history scenario opens an explicit cursor at the authorized current frontier.
    const frontier=(await json(alice,origin,'conversations')).find(c=>c.id===channel.id).seq
    await alice.goto(origin+`/app?view=chat&conversation=${channel.id}&before=${frontier+1}`)
    await alice.getByText(updates.at(-1),{exact:true}).waitFor()
    const latestIds=await alice.locator('.chat [data-message]').evaluateAll(nodes=>nodes.map(n=>n.dataset.message))
    assert.ok(latestIds.length>0&&latestIds.length<updates.length,'latest conversation mounts a bounded portion of the real history')
    assert.ok(!latestIds.includes(deep.id),'opening latest history does not fetch or mount the old source')
    const heldRead=(await json(alice,origin,'conversations')).find(c=>c.id===channel.id)
    assert.ok(heldRead.readSeq<deepReply.sequence&&heldRead.unread>0,'a bounded root window does not read an omitted foreign reply')
    await composer.fill('Draft while reading history')
    await alice.locator('.chat').getByRole('button',{name:'Load earlier messages',exact:true}).click()
    await expect(alice.getByText(updates.at(-1),{exact:true})).toHaveCount(0)
    await expect(composer).toHaveValue('Draft while reading history')
    const earlierIds=await alice.locator('.chat [data-message]').evaluateAll(nodes=>nodes.map(n=>n.dataset.message))
    assert.ok(earlierIds.length>0&&!earlierIds.some(id=>latestIds.includes(id)),'earlier action replaces the window instead of accumulating mounted history')
    await alice.goBack();await alice.getByText(updates.at(-1),{exact:true}).waitFor()
    await expect(composer).toHaveValue('Draft while reading history')
    await nav(alice,'Search').click();await alice.getByLabel('Search conversations',{exact:true}).fill('Deep context reply');await alice.locator('.search-form').getByRole('button',{name:'Search',exact:true}).click();await alice.getByRole('button',{name:'Open in conversation',exact:true}).click()
    await expect(alice.locator('.thread-log').getByText('Deep context reply for the release',{exact:true})).toBeInViewport();await shot(alice,'deep-context')
    assert.ok(historyRequests.some(url=>url.searchParams.has('before')),'earlier history is fetched on explicit navigation')
    assert.ok(historyRequests.some(url=>url.searchParams.get('around')===deepReply.id||bundledHistory(url)&&url.searchParams.get('focus')===deepReply.id),'search uses direct target lookup')
    assert.ok(historyRequests.every(url=>url.pathname.endsWith('/messages/window')||bundledHistory(url)),'the mounted conversation never exhausts the legacy full-history endpoint')
    alice.off('request',recordHistory)
    checks.push(`${label}: material revision and stale acceptance rejection; bounded latest and earlier windows, draft/history restoration, direct deep-context search`)
    await nav(bob,'Attention').click()
    const revisedCard=bob.locator('.attention-card').filter({hasText:'Review the revised handover'}).first()
    await revisedCard.getByRole('button',{name:'Dismiss',exact:true}).click()
    assert.equal((await json(alice,origin,`conversations/${channel.id}/outcomes`)).find(o=>o.id===unfinished.id).status,'proposed','dismissing attention never accepts or completes work')
    const urgentCard=bob.locator('.attention-card').filter({hasText:'Please review the handover before the team meets.'})
    await urgentCard.getByRole('button',{name:'Remind me in an hour',exact:true}).click();await bob.reload();await bob.getByText(/saved for later/).waitFor()
    await expect(bob.getByText('Please review the handover before the team meets.',{exact:true})).toHaveCount(0)
    checks.push(`${label}: quiet-time urgent bypass, persistent snooze and triage independent of responsibility`)

    // A delivered response is deliberately lost at the network edge; retry keeps exact intent.
    await alice.getByRole('button',{name:'Back',exact:true}).click()
    await composer.fill(hostileMessage)
    // Exercise the supported maximum through the real file picker and private
    // binary route, then verify those same bytes after the message retry.
    const handoverBytes=Buffer.alloc(25*1024*1024,32)
    handoverBytes.write('Release handover notes\n')
    handoverBytes.write('End of handover',handoverBytes.length-'End of handover'.length)
    const uploadIntents=[],uploadedFiles=[]
    await alice.route('**/api/conversations/*/attachments',async route=>{
     const request=route.request(),headers=request.headers()
     assert.equal(headers['content-type'],'text/plain','file bytes use the binary upload route')
     assert.equal(decodeURIComponent(headers['x-filename']),'handover.txt')
     assert.ok(headers['x-upload-intent'],'the upload carries its own intent')
     uploadIntents.push(headers['x-upload-intent'])
     const response=await route.fetch();assert.equal(response.status(),200)
     uploadedFiles.push(await response.json())
     if(uploadedFiles.length===1){expectedFailures.set(request.url(),'upload');intentionalAbort=true;await route.abort('failed')}else await route.fulfill({response})
    })
    const fileInput=alice.locator('.chat input[type=file]')
    await fileInput.setInputFiles({name:'handover.txt',mimeType:'text/plain',buffer:handoverBytes})
    await expect(alice.getByRole('button',{name:'Retry upload',exact:true})).toBeEnabled()
    await expect(alice.locator('.chat .send')).toBeDisabled()
    await composer.fill(hostileMessage+' Draft remains editable.')
    await composer.press('Enter');await expect(composer).toHaveValue(hostileMessage+' Draft remains editable.')
    await alice.reload();await expect(composer).toHaveValue(hostileMessage+' Draft remains editable.')
    await expect(alice.getByRole('button',{name:'Retry upload',exact:true})).toBeDisabled()
    await expect(alice.locator('.chat .send')).toBeDisabled()
    // Identical metadata with different bytes must not reuse the reservation.
    const differentBytes=Buffer.from(handoverBytes);differentBytes[differentBytes.length-1]^=1
    await fileInput.setInputFiles({name:'handover.txt',mimeType:'text/plain',buffer:differentBytes})
    await expect(alice.getByRole('alert')).toBeVisible()
    await expect(alice.getByRole('button',{name:'Retry upload',exact:true})).toBeDisabled()
    assert.equal(uploadIntents.length,1,'a different file does not issue a retry')
    await alice.getByRole('alert').getByRole('button',{name:'Dismiss',exact:true}).click()
    await fileInput.setInputFiles({name:'handover.txt',mimeType:'text/plain',buffer:handoverBytes})
    await expect(alice.getByRole('button',{name:'Retry upload',exact:true})).toBeEnabled()
    assert.equal(uploadIntents.length,1,'reselection verifies bytes without an automatic retry')
    await alice.getByRole('button',{name:'Retry upload',exact:true}).click()
    await alice.getByRole('button',{name:'Discard handover.txt',exact:true}).waitFor()
    await alice.unroute('**/api/conversations/*/attachments')
    assert.equal(uploadIntents.length,2,'one initial upload and one explicit retry')
    assert.equal(uploadIntents[1],uploadIntents[0],'upload intent survives the lost acknowledgement and reload')
    assert.equal(uploadedFiles[1].id,uploadedFiles[0].id,'retry reuses the same private upload reservation')
    await expect(alice.getByRole('button',{name:'Discard handover.txt',exact:true})).toHaveCount(1)
    await composer.fill(hostileMessage)
    let lost=false
    const messageSend=url=>url.pathname===`/api/conversations/${channel.id}/messages`
    await alice.route(messageSend,async route=>{if(!lost&&route.request().method()==='POST'){lost=true;const response=await route.fetch();assert.equal(response.status(),200);expectedFailures.set(route.request().url(),'message');intentionalAbort=true;await route.abort('failed')}else await route.continue()})
    await composer.press('Enter');await alice.getByRole('button',{name:'Retry send',exact:true}).waitFor();await alice.unroute(messageSend);await alice.reload()
    await alice.getByRole('button',{name:'Retry send',exact:true}).click();await expect(composer).toHaveValue('')
    const all=[];let after='';for(;;){const page=await json(alice,origin,`conversations/${channel.id}/messages?after=${encodeURIComponent(after)}&limit=100`);all.push(...page);if(page.length<100)break;after=page.at(-1).created+page.at(-1).id}
    assert.equal(all.filter(m=>m.body===hostileMessage).length,1,'unknown acknowledgement retry does not duplicate')
    await assertSafeMessage(alice)
    assert.equal(abortedUploads,1,'exactly one upload acknowledgement was deliberately lost')
    assert.equal(abortedMessages,1,'exactly one message acknowledgement was deliberately lost')
    const selectedMessage=all.find(m=>m.body===hostileMessage)
    await bob.goto(origin+`/app?view=chat&conversation=${channel.id}&focus=${selectedMessage.id}`);await assertSafeMessage(bob)
    const messageFiles=selectedMessage.attachments
    assert.equal(messageFiles.length,1,'only one staged upload binds to the message')
    const file=messageFiles[0];assert.equal(file.id,uploadedFiles[0].id,'message binds the original private reservation')
    const download=await bob.request.get(origin+`/api/attachments/${file.id}/download`);assert.equal(download.status(),200);assert.ok((await download.body()).equals(handoverBytes),'authorized download preserves every uploaded byte')
    const downloaded=bob.waitForEvent('download');await bob.getByRole('link',{name:/handover.txt/}).click()
    const browserDownload=await downloaded;assert.ok((await readFile(await browserDownload.path())).equals(handoverBytes),'the actual browser downloads the authorized file without truncation')
    await alice.getByRole('button',{name:'Remove file',exact:true}).click();await alice.getByText('Attachment removed',{exact:true}).waitFor();await bob.getByText('Attachment removed',{exact:true}).waitFor()
    await bob.reload();await assertSafeMessage(bob)
    await alice.goto(origin+`/app?view=chat&conversation=${channel.id}&focus=${selectedMessage.id}`)
    await alice.reload();await assertSafeMessage(alice)
    for(const page of [alice,bob])assert.deepEqual(await page.evaluate(()=>{const ids=[...document.querySelectorAll('[id]')].map(node=>node.id);return ids.filter((id,i)=>ids.indexOf(id)!==i)}),[],'no duplicate DOM IDs')
    checks.push(`${label}: maximum-size binary upload reservation retry after lost acknowledgement and reload, authorized download/remove, literal human markup, exact-intent retry after lost acknowledgement and reload`)
    // Two interactions create a DM, named for the other participant in each session.
    await nav(alice,'Channels').click();await alice.getByRole('button',{name:'New message',exact:true}).last().click();await alice.getByRole('dialog').getByRole('button',{name:bobName,exact:true}).click()
    await expect(alice.getByRole('heading',{name:bobName,exact:true})).toBeVisible()
    const dm=(await json(alice,origin,'conversations')).find(c=>c.kind==='dm'&&c.name===bobName)
    await bob.goto(origin+`/app?view=chat&conversation=${dm.id}`);await expect(bob.getByRole('heading',{name:aliceName,exact:true})).toBeVisible()
    checks.push(`${label}: two-interaction DM with participant-correct names`)
    await (await import('./group-dm.mjs')).groupDmFlow({alice,bob,origin,aliceUser,bobUser,bobName})
    checks.push(`${label}: app-created three-person DM, exact fixed roster and shared private history`)
    // Revocation clears active private content and all access-controlled views.
    await json(alice,origin,`conversations/${channel.id}/messages`,{body:'The final handoff is ready for review.',parent:deep.id,intent:crypto.randomUUID()})
    let releaseRead
    const revoked=new Promise(resolve=>{releaseRead=resolve})
    const threadReadPath=`/api/messages/${deep.id}/read`
    const readHeld=bob.waitForRequest(request=>new URL(request.url()).pathname===threadReadPath)
    const readResponse=bob.waitForResponse(response=>new URL(response.url()).pathname===threadReadPath)
    await bob.route(url=>url.pathname===threadReadPath,async route=>{await revoked;await route.continue()})
    await bob.goto(origin+`/app?view=chat&conversation=${channel.id}&thread=${deep.id}`);await bob.getByText('Detailed planning context',{exact:true}).waitFor()
    await readHeld
    await shot(bob,'revocation-pending')
    revocationExpected=true
    try{await json(alice,origin,`conversations/${channel.id}/members`,{user:bobUser.id,remove:true})}finally{releaseRead()}
    assert.equal((await readResponse).status(),403,'an in-flight read reports loss of its known conversation scope')
    // Removal reaches an open view through the live hub (its alarm when post-commit hints are dropped).
    await expect(bob.getByText('Detailed planning context',{exact:true})).toHaveCount(0,{timeout:12000})
    await expect(bob.getByText('Deep context reply for the release',{exact:true})).toHaveCount(0)
    await expect(bob.getByRole('button',{name:'Browse channels',exact:true})).toBeVisible()
    await shot(bob,'revoked-conversation')
    await nav(bob,'Attention').click();await expect(bob.getByText('Review the revised handover',{exact:true})).toHaveCount(0)
    await nav(bob,'Search').click();await bob.getByLabel('Search conversations',{exact:true}).fill('Deep context reply');await bob.locator('.search-form').getByRole('button',{name:'Search',exact:true}).click();await bob.getByText('No matching messages in your conversations.',{exact:true}).waitFor()
    await shot(bob,'revoked');assert.deepEqual(errors,[],'no page, hydration or unexpected console errors');assert.deepEqual(failedRequests,[],'no unexpected failed network requests')
    checks.push(`${label}: immediate membership removal clears thread, outcomes, attention and search`)
   }finally{await aliceContext.close();await bobContext.close()}
  }
  const report={status:'passed',runtime:'actual Worker/D1 with fake mail provider network edge',checks,captures};await writeFile(resolve(destination,'browser-results.json'),JSON.stringify(report,null,2)+'\n');return report
 }finally{await browser.close()}
}
