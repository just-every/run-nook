import assert from 'node:assert/strict'
import {chromium,expect} from '@playwright/test'
import {mkdir} from 'node:fs/promises'
import {resolve} from 'node:path'

export async function postingBrowser({origin,owner,member,destination='evidence/posting'}){
 const call=async(path,body,method='POST')=>{const r=await fetch(origin+path,{method,headers:{cookie:owner.cookie,origin,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});assert.equal(r.status,200);return r.json()}
 const browser=await chromium.launch({channel:'chromium',headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{
  await mkdir(destination,{recursive:true})
  for(const width of [1440,390]){
   const room=await call('/api/conversations',{name:'Company announcements '+width,kind:'channel',participants:[member.user.id]})
   const root=await call(`/api/conversations/${room.id}/messages`,{body:'The autumn launch is on Thursday. Read the support checklist before the team briefing.',intent:crypto.randomUUID()})
   const contexts=[]
   const page=async person=>{const context=await browser.newContext({viewport:{width,height:width===390?844:1000}});contexts.push(context);const [name,...value]=person.cookie.split('=');await context.addCookies([{name,value:value.join('='),url:origin}]);return context.newPage()}
   const manager=await page(owner),reader=await page(member),url=origin+'/app?conversation='+room.id
   try{
    await manager.goto(url);await manager.getByRole('button',{name:'Details',exact:true}).click()
    const settings=manager.getByRole('region',{name:'Posting permissions'})
    await settings.getByLabel('Who can post messages?').selectOption('admins')
    await settings.getByLabel('Who can reply in threads?').selectOption('same')
    const saved=manager.waitForResponse(r=>r.url().endsWith('/posting')&&r.request().method()==='PATCH')
    await settings.getByRole('button',{name:'Save posting permissions'}).click();assert.equal((await saved).status(),200)
    await settings.getByText('Permission history and overrides').click()
    await expect(settings.getByText(/Owners and admins · replies: same people/)).toBeVisible()
    await settings.scrollIntoViewIfNeeded();await manager.screenshot({path:resolve(destination,`permissions-${width}.png`)})
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
    await settings.scrollIntoViewIfNeeded();await manager.screenshot({path:resolve(destination,`named-${width}.png`)})
    await manager.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click()
    await manager.goto(url+'&focus='+root.id)
    await manager.getByRole('button',{name:'Post with admin override'}).click()
    const box=manager.getByRole('textbox',{name:'Message Company announcements '+width,exact:true})
    await box.fill('Executive exception: the launch briefing is now at 10am.')
    const overridden=manager.waitForResponse(r=>r.url().includes('/messages')&&r.request().method()==='POST')
    await box.press('Enter');assert.equal((await overridden).status(),200)
    await expect(manager.getByText('Admin override',{exact:true})).toBeVisible()
    await manager.screenshot({path:resolve(destination,`override-${width}.png`)})
   }finally{for(const context of contexts)await context.close()}
  }
 }finally{await browser.close()}
}
