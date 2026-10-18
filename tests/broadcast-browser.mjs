import assert from 'node:assert/strict'
import {chromium,expect} from '@playwright/test'
import {mkdir} from 'node:fs/promises'
import {resolve} from 'node:path'
export async function broadcastBrowser({origin,owner,member,people,destination='evidence/broadcast'}){
 const call=async(path,body,method='POST')=>{const response=await fetch(origin+path,{method,headers:{cookie:owner.cookie,origin,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});assert.equal(response.status,200,method+' '+path);return response.json()}
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{
  await mkdir(destination,{recursive:true})
  for(const width of [1440,390]){
   const room=await call('/api/conversations',{name:'Launch briefing '+width,kind:'channel',participants:[member.user.id,...people.slice(10,15).map(p=>p.id)]})
   const contexts=[]
   const page=async person=>{const context=await browser.newContext({viewport:{width,height:width===390?844:1000}});contexts.push(context);const [name,...value]=person.cookie.split('=');await context.addCookies([{name,value:value.join('='),url:origin}]);return context.newPage()}
   const sender=await page(owner),recipient=await page(member),url=origin+'/app?conversation='+room.id
   try{
    await sender.goto(url)
    const composer=sender.getByRole('textbox',{name:'Message '+room.name,exact:true})
    await composer.fill('@channel The autumn launch briefing is at 10am. Please read the customer support checklist.')
    const refused=sender.waitForResponse(response=>response.url().includes('/messages')&&response.request().method()==='POST')
    await composer.press('Enter');assert.equal((await refused).status(),409)
    const confirmation=sender.getByRole('dialog',{name:'Notify 6 people?'})
    await expect(confirmation).toBeVisible();await expect(confirmation.getByText(/other time zones/).first()).toBeVisible()
    await sender.screenshot({path:resolve(destination,`confirmation-${width}.png`)})
    await confirmation.getByRole('button',{name:'Keep editing'}).click();await expect(composer).toBeEditable()
    await composer.press('Enter');await expect(confirmation).toBeVisible()
    const committed=sender.waitForResponse(response=>response.url().includes('/messages')&&response.request().method()==='POST')
    await confirmation.getByRole('button',{name:'Send broadcast',exact:true}).click();assert.equal((await committed).status(),200)
    const summary=sender.locator('summary').filter({hasText:'@channel · 6 recipients'})
    await expect(summary).toBeVisible();await summary.click();await expect(sender.getByText(/Broadcast teammate 10/)).toBeVisible()
    await sender.screenshot({path:resolve(destination,`sent-${width}.png`)})
    await recipient.goto(url)
    await recipient.getByRole('button',{name:'Conversation options',exact:true}).click()
    await recipient.getByRole('button',{name:'Notification settings',exact:true}).click()
    const ignore=recipient.getByRole('checkbox',{name:'Ignore @channel, @here and @everyone'})
    await ignore.check();await expect(ignore).toBeChecked()
    await recipient.screenshot({path:resolve(destination,`ignore-${width}.png`)})
    await recipient.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click()
    await sender.getByRole('button',{name:'Details',exact:true}).click()
    const policy=sender.getByRole('region',{name:'Channel broadcasts'})
    await policy.getByLabel('Who can use @channel, @here and @everyone?').selectOption('admins')
    const changed=sender.waitForResponse(response=>response.url().endsWith('/broadcast')&&response.request().method()==='PATCH')
    await policy.getByRole('button',{name:'Save broadcast policy'}).click();assert.equal((await changed).status(),200)
    await policy.scrollIntoViewIfNeeded();await sender.screenshot({path:resolve(destination,`policy-${width}.png`)})
    const memberComposer=recipient.getByRole('textbox',{name:'Message '+room.name,exact:true})
    await memberComposer.fill('<!channel> Please read the new launch checklist.')
    const denied=recipient.waitForResponse(response=>response.url().includes('/messages')&&response.request().method()==='POST')
    await memberComposer.press('Enter');assert.equal((await denied).status(),403)
    await expect(recipient.getByText(/You cannot broadcast under this channel/).first()).toBeVisible()
    await recipient.screenshot({path:resolve(destination,`denied-${width}.png`)})
   }finally{for(const context of contexts)await context.close()}
  }
 }finally{await browser.close()}
}
