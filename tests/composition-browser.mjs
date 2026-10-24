import {withRestoredArchive} from './archive-roundtrip.mjs'
import {installation} from './push/fixture.mjs'
import {auditAccessibility} from './accessibility.mjs'
import {profileFieldReadOrdering,profileFieldScopeOrdering} from './profile-fields-ordering.mjs'
import {chromium,expect} from '@playwright/test'
import {mkdir} from 'node:fs/promises'
import {resolve} from 'node:path'
import assert from 'node:assert/strict'
export async function compositionBrowser({origin,owner,member,outsider,destination,sql,directoryPerson='Elena Rivera'}){
 const base=typeof origin==='function'?origin():origin
 const call=async(path,body,actor=owner,method=body?'POST':'GET')=>{const r=await fetch(base+path,{method,headers:{cookie:actor.cookie,origin:base,...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});assert.equal(r.status,200,await r.clone().text());return r.json()}
 await call('/api/profile',{name:'Priya Chen'})
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{
  if(destination)await mkdir(destination,{recursive:true})
  for(const width of [1440,390]){
   const context=await browser.newContext({serviceWorkers:'block',viewport:{width,height:width===390?844:1000},timezoneId:'America/Los_Angeles'})
   try{
    const [name,...value]=member.cookie.split('=');await context.addCookies([{name,value:value.join('='),url:base}])
    await call('/api/profile',{presenceEnabled:true,typingEnabled:true},member)
    const room=await call('/api/conversations',{name:'Customer launch handoff '+width,kind:'private',participants:[member.user.id]})
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
    await page.goto(base+'/app?view=chat&conversation='+room.id)
    const composer=page.locator('.composer').filter({has:page.locator('textarea:visible')}),field=page.getByRole('textbox',{name:'Message '+room.name,exact:true})
    await expect(field).toBeVisible()
    const root=await call('/api/conversations/'+room.id+'/messages',{body:'synthetic-nook thread broadcast root',intent:crypto.randomUUID()});
    await page.goto(base+'/app?conversation='+room.id+'&thread='+root.id);
    const reply=page.getByRole('textbox',{name:'Reply in thread',exact:true});await expect(reply).toBeVisible();
    await reply.fill('synthetic-nook composer broadcast '+width);
    await page.getByLabel('Also send to #'+room.name,{exact:true}).check();
    await reply.press('Enter');
    await expect(page.locator('.thread-log .message-body').filter({hasText:'synthetic-nook composer broadcast '+width})).toHaveCount(1);
    await page.goto(base+'/app?conversation='+room.id);
    await expect(page.locator('.message-body').filter({hasText:'synthetic-nook composer broadcast '+width})).toHaveCount(1);
    await expect(page.locator('.nook-app')).toHaveAttribute('data-live-connected','true');
    const broadcast=await call('/api/search?q='+encodeURIComponent('synthetic-nook composer broadcast '+width),undefined,member);
    const sent=broadcast.items.find(m=>m.body==='synthetic-nook composer broadcast '+width);assert.ok(sent);
    const threadView=await context.newPage();await threadView.goto(base+'/app?conversation='+room.id+'&thread='+root.id);await expect(threadView.locator('.nook-app')).toHaveAttribute('data-live-connected','true');
    const slow=await context.newCDPSession(page);await slow.send('Emulation.setCPUThrottlingRate',{rate:4});await slow.send('Network.enable');await slow.send('Network.emulateNetworkConditions',{offline:false,latency:500,downloadThroughput:-1,uploadThroughput:-1});
    await call('/api/messages/'+sent.id,{body:'synthetic-nook composer broadcast edited '+width,version:1},member,'PATCH');
    await expect(page.locator('.message-body').filter({hasText:'synthetic-nook composer broadcast edited '+width})).toHaveCount(1);
    await expect(threadView.locator('.thread-log .message-body').filter({hasText:'synthetic-nook composer broadcast edited '+width})).toHaveCount(1);
    await call('/api/messages/'+sent.id,{delete:true,version:2},member,'PATCH');
    await expect(page.locator('[data-message="'+sent.id+'"] .message-body')).toContainText('Message deleted');
    await expect(threadView.locator('.thread-log [data-message="'+sent.id+'"] .message-body')).toContainText('Message deleted');await threadView.close();await slow.send('Emulation.setCPUThrottlingRate',{rate:1});await slow.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});await slow.detach();
    if(destination)await page.screenshot({animations:'disabled',path:resolve(destination,`thread-broadcast-${width}.png`)});
    await broadcastRestoreBrowser({browser,width,destination});
    await page.goto(base+'/app?conversation='+room.id);

    await call('/api/conversations/'+room.id+'/typing',{page:'owner-browser-'+width,typing:true})
    await expect(composer.getByRole('status')).toContainText('Priya Chen is typing')
    if(destination)await page.screenshot({animations:'disabled',path:resolve(destination,`typing-${width}.png`)})
    await call('/api/conversations/'+room.id+'/typing',{page:'owner-browser-'+width,typing:false})
    await expect(composer.getByText('Priya Chen is typing…',{exact:true})).toHaveCount(0)
    await field.pressSequentially('*Approved*')
    await expect(composer.locator('.composition-preview strong')).toHaveText('Approved')
    await field.press('Control+z');await expect(field).toHaveValue('*Approved*');await expect(composer.locator('.composition-preview')).toContainText('*Approved*')
    await field.fill('');await field.pressSequentially('_Ready_');await expect(composer.locator('.composition-preview em')).toHaveText('Ready')
    await field.fill('');await field.pressSequentially('~Draft~');await expect(composer.locator('.composition-preview del')).toHaveText('Draft')
    const formatted='Release checklist\n\n- Review the support handoff\n- Confirm the launch owner\n\n1. Brief the team\n\n> Customer privacy comes first\n\n```\nconst ready = true\n```\n\n[Launch guide](https://example.com/launch) ![External image](https://never-fetch.invalid/image.png) <script>window.bad=true</script>'
    const remote=[];page.on('request',r=>{if(r.url().includes('never-fetch.invalid'))remote.push(r.url())})
    await field.fill(formatted);await expect(composer.locator('.composition-preview ul')).toBeVisible();await expect(composer.locator('.composition-preview ol')).toBeVisible();await expect(composer.locator('.composition-preview blockquote')).toBeVisible();await expect(composer.locator('.composition-preview pre code')).toContainText('const ready')
    await composer.getByText('Format, mention or emoji',{exact:true}).click()
    await composer.getByRole('button',{name:'@Priya Chen',exact:true}).click();await composer.getByRole('button',{name:'Celebrate',exact:true}).click()
    if(destination)await page.screenshot({animations:'disabled',path:resolve(destination,`rich-composer-${width}.png`)})
    await composer.getByText('Format, mention or emoji',{exact:true}).click();await composer.getByRole('button',{name:'Send',exact:true}).click();await expect(field).toHaveValue('')
    assert.deepEqual(remote,[]);assert.equal(await page.evaluate(()=>window.bad),undefined)
    const source=' \n'+('Customer success rollout notes and escalation contacts.\n'.repeat(1000))+' Final approval. \n'
    await field.fill(source)
    if(destination)await page.screenshot({animations:'disabled',path:resolve(destination,`overlength-${width}.png`)})
    await composer.getByRole('button',{name:'Post as snippet',exact:true}).click();await expect(field).toHaveValue('')
    const history=await call('/api/conversations/'+room.id+'/messages',undefined,member),snippet=history.find(m=>m.attachments.some(f=>f.name==='snippet.txt'))
    assert.ok(snippet);const attachment=snippet.attachments.find(f=>f.name==='snippet.txt')
    const bytes=await fetch(base+'/api/attachments/'+attachment.id+'/download',{headers:{cookie:member.cookie}});assert.equal(await bytes.text(),source)
    const snippetRow=page.locator('[data-message="'+snippet.id+'"]')
    await snippetRow.getByText('Preview snippet.txt',{exact:true}).click();await expect(snippetRow.getByLabel('Text of snippet.txt',{exact:true})).toContainText('Customer success rollout notes')
    if(destination)await page.screenshot({animations:'disabled',path:resolve(destination,`snippet-${width}.png`)})
    const split=' \n'+('Launch readiness: customer support, engineering and operations.\n'.repeat(900))+' Ready to launch. \n'
    let lost=false
    const send=url=>url.pathname===`/api/conversations/${room.id}/messages`
    await page.route(send,async route=>{if(!lost&&route.request().method()==='POST'){lost=true;const response=await route.fetch();assert.equal(response.status(),200);await route.abort('failed')}else await route.continue()})
    await field.fill(split);await composer.getByRole('button',{name:'Split into messages',exact:true}).click();await expect(composer.getByRole('button',{name:'Retry send',exact:true})).toBeVisible()
    await page.unroute(send);await page.reload();await expect(composer.getByRole('button',{name:'Retry send',exact:true})).toBeVisible();await composer.getByRole('button',{name:'Retry send',exact:true}).click();await expect(field).toHaveValue('')
    const after=await call('/api/conversations/'+room.id+'/messages',undefined,member),parts=after.filter(m=>m.body.includes('Launch readiness:')||m.body.includes('Ready to launch.'))
    assert.equal(parts.map(m=>m.body).join(''),split);assert.equal(new Set(parts.map(m=>m.id)).size,parts.length);assert.equal(parts.length,2)
    await field.fill('/');await expect(composer.getByRole('button',{name:/^\/who\s/})).toBeVisible()
    if(destination)await page.screenshot({animations:'disabled',path:resolve(destination,`commands-${width}.png`)})
    await field.fill('/rename sales-us');await composer.getByRole('button',{name:'Send',exact:true}).click();await expect(page.getByLabel('Command result')).toContainText('Only the channel manager')
    if(destination)await page.screenshot({animations:'disabled',path:resolve(destination,`command-denied-${width}.png`)})
    await page.getByLabel('Command result').getByRole('button',{name:'Close',exact:true}).click()
    await field.fill('/wat');await composer.getByRole('button',{name:'Send',exact:true}).click();await expect(page.getByLabel('Command result')).toContainText('Nothing was posted')
    assert.ok(!(await call('/api/conversations/'+room.id+'/messages',undefined,member)).some(m=>m.body==='/wat'))
    await page.getByLabel('Command result').getByRole('button',{name:'Send as a message',exact:true}).click();await expect(field).toHaveValue('')
    assert.equal((await call('/api/conversations/'+room.id+'/messages',undefined,member)).filter(m=>m.body==='/wat').length,1)
    await field.fill('/who');await field.press('Enter');await expect(page.getByLabel('Command result')).toContainText('Priya Chen');await page.getByLabel('Command result').getByRole('button',{name:'Close',exact:true}).click()
    await field.fill('/mute');await field.press('Enter');await page.getByLabel('Command result').getByRole('button',{name:'Confirm',exact:true}).click();await expect(page.getByLabel('Command result')).toHaveCount(0);assert.equal((await call('/api/conversations/'+room.id+'/preferences',undefined,member)).muted,true)
    await field.fill('/dnd 1 hour');await field.press('Enter');await expect(page.getByLabel('Command result')).toContainText('Pause notifications');await page.getByLabel('Command result').getByRole('button',{name:'Confirm',exact:true}).click();await expect(page.getByLabel('Command result')).toHaveCount(0);assert.ok((await call('/api/settings',undefined,member)).dndUntil>Date.now());await call('/api/settings',{dndUntil:null},member,'PATCH')
    await field.fill('/collapse');await field.press('Enter');await expect(snippetRow.getByText('Preview snippet.txt',{exact:true})).toHaveCount(0)
    await field.fill('/expand');await field.press('Enter');await expect(snippetRow.getByText('Preview snippet.txt',{exact:true})).toBeVisible()
    await field.fill('/shrug ok');await field.press('Enter');await expect(field).toHaveValue('');assert.ok((await call('/api/conversations/'+room.id+'/messages',undefined,member)).some(m=>m.body==='ok ¯\\_(ツ)_/¯'))
    await field.fill('/status :palm_tree: Out until Monday');await composer.getByRole('button',{name:'Send',exact:true}).click();await page.getByLabel('Command result').getByRole('button',{name:'Confirm',exact:true}).click();await expect(page.getByLabel('Command result')).toHaveCount(0)
    assert.equal((await call('/api/profile',undefined,member)).profile.status.text,'Out until Monday')
    await page.goto(base+'/app?view=you')
    const profile=page.getByRole('region',{name:'Your profile',exact:true})
    await profile.getByLabel('Display name',{exact:true}).fill('Elena Rivera')
    await profile.getByLabel('Time zone',{exact:true}).fill('America/Los_Angeles')
    await profile.getByLabel('Phone',{exact:true}).fill('+1 415 555 0198')
    await profile.getByLabel('Title',{exact:true}).fill('Customer Success Lead');await profile.getByLabel('Department',{exact:true}).fill('Customer Success')
    await profile.getByLabel('Share active presence',{exact:true}).uncheck();await profile.getByLabel('Show when I am typing',{exact:true}).uncheck()
    await profile.getByRole('button',{name:'Save profile',exact:true}).click();await expect(profile.getByRole('status')).toContainText('Profile saved')
    assert.equal((await call('/api/profile',undefined,member)).profile.typingEnabled,false)
    await profile.scrollIntoViewIfNeeded();if(destination)await page.screenshot({animations:'disabled',path:resolve(destination,`profile-${width}.png`)})
    await page.goto(base+'/app?view=people');await page.getByLabel('Search people',{exact:true}).fill('Customer Success');await page.getByRole('button',{name:'Search people',exact:true}).click()
    await expect(page.locator('.people-directory .team-people>li')).toHaveCount(1)
    await expect(page.locator('.people-directory .team-person').filter({hasText:'Elena Rivera'})).toBeVisible()
    if(destination)await page.screenshot({animations:'disabled',path:resolve(destination,`people-${width}.png`)})
    await page.goto(base+'/app?view=you')
    const settings=page.getByRole('heading',{name:'Your workspace',exact:true}).locator('..')
    await settings.getByLabel('Conversation',{exact:true}).selectOption(room.id)
    await settings.getByLabel('Sidebar section',{exact:true}).fill('Customers')
    await settings.getByRole('button',{name:'Save sidebar section',exact:true}).click()
    await expect(settings.getByRole('status')).toContainText('Personal workspace saved')
    if(width===1440)await expect(page.getByRole('heading',{name:'Customers',exact:true})).toHaveCount(1)
    if(destination)await page.screenshot({animations:'disabled',path:resolve(destination,`workspace-${width}.png`)})
    const ownerContext=await browser.newContext({serviceWorkers:'block',viewport:{width,height:width===390?844:1000}})
    try{
     const [ownerName,...ownerValue]=owner.cookie.split('=');await ownerContext.addCookies([{name:ownerName,value:ownerValue.join('='),url:base}])
     const admin=await ownerContext.newPage(),ordering=width===390?await profileFieldReadOrdering(admin):null
     await admin.goto(base+'/app?view=team')
     const fields=admin.getByRole('region',{name:'Profile fields',exact:true})
     try{
     await fields.getByRole('button',{name:'Edit Phone',exact:true}).click()
     await fields.getByLabel('Visible to',{exact:true}).selectOption('self')
     await fields.getByRole('button',{name:'Save field',exact:true}).click()
     await expect(fields).toHaveAttribute('data-save','saved');await expect(fields).toHaveAttribute('aria-busy','false')
     await expect(fields.getByRole('status')).toContainText('Profile field saved');await ordering?.captured()
     await fields.getByRole('button',{name:'Add profile field',exact:true}).click()
     await fields.getByLabel('Field ID',{exact:true}).fill('region-'+width)
     await fields.getByLabel('Field label',{exact:true}).fill('Sales region '+width)
     await fields.getByRole('button',{name:'Save field',exact:true}).click()
     await expect(fields).toHaveAttribute('data-save','saved');await expect(fields).toHaveAttribute('aria-busy','false')
     await expect(fields.getByRole('status')).toHaveText('Profile field saved.');await ordering?.deliver()
     await expect(fields.getByRole('button',{name:'Edit Sales region '+width,exact:true})).toBeVisible()
     }finally{await ordering?.close()}
     const team=admin.getByLabel('Team people',{exact:true})
     const firstPeople=await call('/api/team?page=1&limit=50')
     await expect(team.locator('ul.team-people>li')).toHaveCount(firstPeople.items.length)
     if(firstPeople.hasMore){const nextPeople=await call('/api/team?page=1&limit=50&after='+encodeURIComponent(firstPeople.cursor));await team.getByRole('button',{name:'Next people',exact:true}).click();await expect(team.getByRole('status')).toContainText('51–'+(50+nextPeople.items.length))}else await expect(team.getByRole('button',{name:'Next people',exact:true})).toBeDisabled()
     if(destination)await admin.screenshot({animations:'disabled',path:resolve(destination,`team-page-${width}.png`)})
     await team.getByLabel('Find teammates',{exact:true}).fill(directoryPerson)
     await expect(team.locator('ul.team-people>li')).toHaveCount(1);await expect(team.getByText(directoryPerson,{exact:true})).toBeVisible()
     if(destination)await admin.screenshot({animations:'disabled',path:resolve(destination,`team-search-${width}.png`)})
     await team.getByLabel('Find teammates',{exact:true}).fill('')
     await fields.getByRole('button',{name:'Edit Sales region '+width,exact:true}).scrollIntoViewIfNeeded()
     if(destination)await admin.screenshot({animations:'disabled',path:resolve(destination,`field-created-${width}.png`)})
     await fields.getByRole('heading',{name:'Profile fields',exact:true}).scrollIntoViewIfNeeded()
     if(destination)await admin.screenshot({animations:'disabled',path:resolve(destination,`field-policy-${width}.png`)})
     await profileFieldScopeOrdering(admin,fields,width,()=>sql(`UPDATE oa_sessions SET created_at=0 WHERE operator_id='${owner.user.id}'`))
     assert.ok(await admin.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
     if(destination)await admin.screenshot({animations:'disabled',path:resolve(destination,`field-reloaded-${width}.png`)})
     assert.equal((await call('/api/people?q=415%20555%200198',undefined,owner)).items.length,0)
     const commandsRoom=await call('/api/conversations',{name:'Command planning '+width,kind:'channel',participants:[member.user.id]})
     await admin.goto(base+'/app?view=chat&conversation='+commandsRoom.id)
     let commandField=admin.getByRole('textbox',{name:'Message '+commandsRoom.name,exact:true})
     const run=async(command,confirm=true)=>{await commandField.fill(command);await commandField.press('Enter');if(confirm){await admin.getByLabel('Command result').getByRole('button',{name:'Confirm',exact:true}).click();await expect(admin.getByLabel('Command result')).toHaveCount(0)}}
     await run('/topic Q4 launch handoff')
     assert.equal((await call('/api/channels/'+commandsRoom.id+'/details')).topic,'Q4 launch handoff')
     await run('/rename launch-us-'+width);commandField=admin.getByRole('textbox',{name:'Message launch-us-'+width,exact:true})
     if(outsider){await run('/invite @'+outsider.user.id);assert.ok((await call('/api/conversations/'+commandsRoom.id+'/members')).some(p=>p.id===outsider.user.id))}
     await run('/msg \"Elena Rivera\" Hello from the launch channel '+width);await expect(admin).not.toHaveURL(new RegExp('conversation='+commandsRoom.id))
     await expect(admin.locator('.message').filter({hasText:'Hello from the launch channel '+width})).toBeVisible()
     await admin.goto(base+'/app?view=chat&conversation='+commandsRoom.id);commandField=admin.getByRole('textbox',{name:'Message launch-us-'+width,exact:true})
     await run('/leave');await expect(admin).toHaveURL(/view=channels/)
    }finally{await ownerContext.close()}
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[])
   }finally{await context.close()}
  }
 }finally{await browser.close()}
}

// A fresh source keeps this archive independent of unrelated clock and erasure
// fixtures in the encompassing browser stage.
async function broadcastRestoreBrowser({browser,width,destination}){
 const source=await installation(undefined)
 try{
  const room=await source.call('/api/conversations','POST',{name:'Synthetic restored broadcast',kind:'private'},source.ownerCookie)
  const root=await source.call('/api/conversations/'+room.id+'/messages','POST',{body:'Synthetic restored thread root',intent:crypto.randomUUID()},source.ownerCookie)
  const reply=await source.call('/api/conversations/'+room.id+'/messages','POST',{body:'Synthetic restored broadcast reply',parent:root.id,channelBroadcast:true,intent:crypto.randomUUID()},source.ownerCookie)
  const request=async(path,{method='GET',body,cookie=source.ownerCookie,status=200}={})=>{const response=await source.raw(path,method,body,cookie),raw=await response.text();assert.equal(response.status,status,raw);return {response,raw,data:response.headers.get('content-type')?.includes('application/json')?JSON.parse(raw):undefined}}
  await withRestoredArchive({request,owner:{cookie:source.ownerCookie,user:source.owner}},async restored=>{
   const setup=await fetch(restored.origin+'/setup',{method:'POST',redirect:'manual',headers:{cookie:restored.owner.cookie,Origin:restored.origin,'Content-Type':'application/x-www-form-urlencoded'},body:'confirm=yes'});assert.equal(setup.status,303)
   const context=await browser.newContext({serviceWorkers:'block',viewport:{width,height:width===390?844:1000}})
   try{
    const [name,...value]=restored.owner.cookie.split('=');await context.addCookies([{name,value:value.join('='),url:restored.origin}]);const page=await context.newPage()
    for(const [view,query,scope] of [['channel','','.chat'],['thread','&thread='+root.id,'.thread-log']]){
     await page.goto(restored.origin+'/app?conversation='+room.id+query)
     const row=page.locator(scope+' [data-message="'+reply.id+'"]');await expect(row).toHaveCount(1);await expect(row.locator('.message-body')).toHaveText(reply.body);await expect(row.locator('.message-body')).toBeVisible()
     assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
     await auditAccessibility(page,destination??'evidence/composition',`restored-broadcast-${view}-${width}`)
    }
   }finally{await context.close()}
  })
 }finally{await source.close()}
}
