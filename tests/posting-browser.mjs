import {createRequire} from 'node:module'
import {signIn} from './auth-support.mjs'
const require=createRequire(import.meta.url)
import assert from 'node:assert/strict'
import {chromium,expect} from '@playwright/test'
import {mkdir} from 'node:fs/promises'
import {resolve} from 'node:path'

export async function postingBrowser({origin,owner,member,sql,destination='evidence/posting'}){
 const call=async(path,body,method='POST')=>{const r=await fetch(origin+path,{method,headers:{cookie:owner.cookie,origin,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});assert.equal(r.status,200);return r.json()}
 const adminEmail='synthetic-nook-962@example.test';const scope=await call('/api/conversations',{name:'Synthetic policy admin scope',kind:'channel'});await call('/api/team/invitations',{email:adminEmail,role:'admin',mode:'member',scopes:[scope.id]});const invited=await fetch(origin+'/auth/invite',{method:'POST',headers:{origin,cookie:owner.cookie,'content-type':'application/json'},body:JSON.stringify({email:adminEmail,role:'admin',displayName:'Synthetic policy admin'})});assert.equal(invited.status,202);const admin=await signIn(origin,adminEmail,{requestLink:false})
 const pagingFixtures=[]
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{
  await mkdir(destination,{recursive:true})
  for(const width of [1440,390]){
   const room=await call('/api/conversations',{name:'Company announcements '+width,kind:'channel',participants:[member.user.id]})
   await call(`/api/conversations/${room.id}/members`,{user:admin.user.id})
   const root=await call(`/api/conversations/${room.id}/messages`,{body:'The autumn launch is on Thursday. Read the support checklist before the team briefing.',intent:crypto.randomUUID()})
   const contexts=[]
   const page=async person=>{const context=await browser.newContext({viewport:{width,height:width===390?844:1000},serviceWorkers:'block'});contexts.push(context);const [name,...value]=person.cookie.split('=');await context.addCookies([{name,value:value.join('='),url:origin}]);return context.newPage()}
   const manager=await page(owner),reader=await page(member),administrator=await page(admin),errors=[],url=origin+'/app?conversation='+room.id
   for(const p of [manager,reader,administrator]){p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())})}
   try{
    await manager.goto(url);await expect(manager.locator('.nook-app')).toHaveAttribute('data-live-connected','true');await manager.getByRole('button',{name:'Details',exact:true}).click()
    await expect(manager.getByLabel('Channel name',{exact:true})).toHaveValue(room.name);await manager.screenshot({animations:'disabled',path:resolve(destination,`channel-settings-top-${width}.png`)})
    await manager.getByRole('textbox',{name:'Description',exact:true}).fill('Synthetic channel description '+width);const described=manager.waitForResponse(r=>r.url().endsWith('/api/channels/'+room.id)&&r.request().method()==='PATCH');await manager.getByRole('button',{name:'Save channel details',exact:true}).click();assert.equal((await described).status(),200);await manager.goto(url);await expect(manager.locator('.nook-app')).toHaveAttribute('data-live-connected','true');await manager.getByRole('button',{name:'Details',exact:true}).click();await expect(manager.getByRole('textbox',{name:'Description',exact:true})).toHaveValue('Synthetic channel description '+width);await expect(manager.getByRole('button',{name:'Save channel details',exact:true})).toBeDisabled();await manager.getByRole('textbox',{name:'Description',exact:true}).scrollIntoViewIfNeeded();await manager.screenshot({animations:'disabled',path:resolve(destination,`channel-description-${width}.png`)})
    const workspace=manager.getByRole('region',{name:'Workspace policy',exact:true});await expect(workspace).toBeVisible();await workspace.getByLabel('Who can create public channels?').selectOption('owners');await workspace.getByLabel('Who can create private channels?').selectOption('admins');await workspace.getByLabel('Who can archive channels?').selectOption('owners');await workspace.getByRole('button',{name:'Save workspace policy',exact:true}).click();await expect(workspace.getByRole('status')).toHaveText('Workspace channel policy saved.')
    await workspace.scrollIntoViewIfNeeded();await manager.screenshot({animations:'disabled',path:resolve(destination,`workspace-policy-owner-${width}.png`)})
    await administrator.goto(url);await expect(administrator.locator('.nook-app')).toHaveAttribute('data-live-connected','true');await administrator.getByRole('button',{name:'Details',exact:true}).click();const readonly=administrator.getByRole('region',{name:'Workspace policy',exact:true});await expect(readonly.getByText('Owners only',{exact:true})).toHaveCount(2);await expect(readonly.getByRole('combobox')).toHaveCount(0);await expect(readonly.getByRole('button')).toHaveCount(0);await readonly.scrollIntoViewIfNeeded();await administrator.screenshot({animations:'disabled',path:resolve(destination,`workspace-policy-admin-${width}.png`)})
    for(const p of [manager,administrator]){await p.addScriptTag({path:require.resolve('axe-core/axe.min.js')});assert.deepEqual(await p.evaluate(async()=>{const r=await window.axe.run(document.querySelector('dialog[open]'));return r.violations.filter(v=>['serious','critical'].includes(v.impact))}),[]);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.equal(await p.evaluate(()=>window.__rerHydration?.count??0),0)}
    for(const label of ['Who can create public channels?','Who can create private channels?','Who can archive channels?'])await workspace.getByLabel(label).selectOption('members');await workspace.getByRole('button',{name:'Save workspace policy',exact:true}).click();await expect(workspace.getByRole('status')).toHaveText('Workspace channel policy saved.')
    const settings=manager.getByRole('region',{name:'Posting permissions'})
    await settings.getByLabel('Who can post messages?').selectOption('admins')
    await settings.getByLabel('Who can reply in threads?').selectOption('same')
    const saved=manager.waitForResponse(r=>r.url().endsWith('/posting')&&r.request().method()==='PATCH')
    await settings.getByRole('button',{name:'Save posting permissions'}).click();assert.equal((await saved).status(),200)
    await settings.getByText('Permission history and overrides').click()
    await expect(settings.getByText(/Owners and admins · replies: same people/)).toBeVisible()
    await settings.scrollIntoViewIfNeeded();await manager.screenshot({animations:'disabled',path:resolve(destination,`permissions-${width}.png`)})
    await reader.goto(url);await expect(reader.getByText('Posting is restricted by this channel’s permissions.',{exact:false})).toBeVisible()
    await expect(reader.getByRole('textbox',{name:'Message Company announcements '+width,exact:true})).toHaveCount(0)
    await reader.goto(url+'&thread='+root.id);await expect(reader.getByRole('textbox',{name:'Reply in thread',exact:true})).toHaveCount(0)
    await reader.screenshot({path:resolve(destination,`restricted-${width}.png`)})
    await settings.getByLabel('Who can reply in threads?').selectOption('everyone')
    const opened=manager.waitForResponse(r=>r.url().endsWith('/posting')&&r.request().method()==='PATCH')
    await settings.getByRole('button',{name:'Save posting permissions'}).click();assert.equal((await opened).status(),200)
    await reader.reload();const reply=reader.getByRole('textbox',{name:'Reply in thread',exact:true});await expect(reply).toBeVisible();await reply.fill('Support has reviewed the checklist and is ready for Thursday.')
    const posted=reader.waitForResponse(r=>r.url().includes('/messages')&&r.request().method()==='POST');await reply.press('Enter');assert.equal((await posted).status(),200)
    await expect(reader.getByText('Support has reviewed the checklist and is ready for Thursday.',{exact:true})).toBeVisible()
    await reader.screenshot({path:resolve(destination,`reply-${width}.png`)})
    await settings.getByLabel('Who can post messages?').selectOption('selected')
    await settings.getByRole('checkbox',{name:member.user.name,exact:true}).check()
    const selected=manager.waitForResponse(r=>r.url().endsWith('/posting')&&r.request().method()==='PATCH')
    await settings.getByRole('button',{name:'Save posting permissions'}).click();assert.equal((await selected).status(),200)
    await expect(settings.getByRole('button',{name:'Save posting permissions'})).toBeEnabled()
    await settings.scrollIntoViewIfNeeded();await manager.screenshot({animations:'disabled',path:resolve(destination,`named-${width}.png`)})
    await manager.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click()
    await manager.goto(url+'&focus='+root.id)
    await manager.getByRole('button',{name:'Post with admin override'}).click()
    const box=manager.getByRole('textbox',{name:'Message Company announcements '+width,exact:true})
    await box.fill('Executive exception: the launch briefing is now at 10am.')
    const overridden=manager.waitForResponse(r=>r.url().includes('/messages')&&r.request().method()==='POST')
    await box.press('Enter');assert.equal((await overridden).status(),200)
    await expect(manager.getByText('Admin override',{exact:true})).toBeVisible()
    await manager.screenshot({animations:'disabled',path:resolve(destination,`override-${width}.png`)})
    const privateRoom=await call('/api/conversations',{name:'Synthetic private history '+width,kind:'private',participants:[member.user.id]});await call(`/api/conversations/${privateRoom.id}/messages`,{body:'Synthetic history to disclose',intent:crypto.randomUUID()});await manager.goto(origin+'/app?conversation='+privateRoom.id);await expect(manager.locator('.nook-app')).toHaveAttribute('data-live-connected','true');await manager.getByRole('button',{name:'Details',exact:true}).click();const conversion=manager.getByRole('region',{name:'Make channel public',exact:true});await conversion.getByRole('button',{name:'Preview public history',exact:true}).click();await expect(conversion.getByText('All history becomes visible workspace-wide and cannot be re-hidden.',{exact:true})).toBeVisible();await expect(conversion.getByRole('button',{name:'Confirm make public',exact:true})).toBeDisabled();await conversion.scrollIntoViewIfNeeded();await manager.screenshot({animations:'disabled',path:resolve(destination,`channel-public-preview-${width}.png`)});await manager.addScriptTag({path:require.resolve('axe-core/axe.min.js')});assert.deepEqual(await manager.evaluate(async()=>{const r=await window.axe.run(document.querySelector('dialog[open]'));return r.violations.filter(v=>['serious','critical'].includes(v.impact))}),[]);assert.ok(await manager.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.equal(await manager.evaluate(()=>window.__rerHydration?.count??0),0);await conversion.getByRole('checkbox').check();const converted=manager.waitForResponse(r=>r.url().endsWith('/make-public')&&r.request().method()==='POST');await conversion.getByRole('button',{name:'Confirm make public',exact:true}).click();assert.equal((await converted).status(),200);await expect(conversion).toHaveCount(0)
    const discovery=await call('/api/conversations',{name:'Synthetic described channel '+width,kind:'channel'});await call('/api/channels/'+discovery.id,{version:1,description:'Synthetic discoverable description '+width},'PATCH');for(let n=0;n<51;n++)pagingFixtures.push((await call('/api/conversations',{name:'Synthetic directory browser '+width+' '+n,kind:'channel'})).id);await reader.goto(origin+'/app?view=channels');const listed=reader.locator('.team-channel-list>li');await expect(listed).toHaveCount(50);await reader.getByRole('button',{name:'More channels',exact:true}).click();await expect(listed).not.toHaveCount(50);await reader.getByLabel('Find public channels',{exact:true}).fill(discovery.name);await reader.getByRole('button',{name:'Search channels',exact:true}).click();await expect(listed).toHaveCount(1);await expect(reader.getByText('Synthetic discoverable description '+width,{exact:true})).toBeVisible();await reader.addScriptTag({path:require.resolve('axe-core/axe.min.js')});assert.deepEqual(await reader.evaluate(async()=>{const r=await window.axe.run(document.querySelector('.team-channels'));return r.violations.filter(v=>['serious','critical'].includes(v.impact))}),[]);assert.ok(await reader.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.equal(await reader.evaluate(()=>window.__rerHydration?.count??0),0);await reader.getByText('Synthetic discoverable description '+width,{exact:true}).scrollIntoViewIfNeeded();await reader.screenshot({animations:'disabled',path:resolve(destination,`channel-browser-description-${width}.png`)})
    assert.deepEqual(errors,[])
   }finally{for(const context of contexts)await context.close()}
  }
 }finally{
  await browser.close()
  // These empty synthetic rooms belong only to the paging fixture. Remove its
  // membership journal too, so later journeys keep a valid, isolated archive.
  if(pagingFixtures.length){const ids=JSON.stringify(pagingFixtures).replaceAll("'","''");for(const table of ['nook_members','nook_creator_revocations','nook_events','nook_exit_membership','nook_exit_changes'])await sql(`DELETE FROM ${table} WHERE conversation IN (SELECT value FROM json_each('${ids}'))`);await sql(`DELETE FROM nook_conversations WHERE id IN (SELECT value FROM json_each('${ids}'))`)}
 }
}
