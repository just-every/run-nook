import assert from 'node:assert/strict'
import {chromium,expect} from '@playwright/test'
import {mkdir} from 'node:fs/promises'
import {resolve} from 'node:path'
export async function broadcastBrowser({origin,owner,member,people,destination='evidence/broadcast'}){
 const call=async(path,body,method='POST')=>{const response=await fetch(origin+path,{method,headers:{cookie:owner.cookie,origin,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});assert.equal(response.status,200,method+' '+path);return response.json()}
 const browser=await chromium.launch({channel:'chromium',headless:true,args:['--use-mock-keychain','--password-store=basic']})
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
    await sender.screenshot({animations:'disabled',path:resolve(destination,`confirmation-${width}.png`)})
    await confirmation.getByRole('button',{name:'Keep editing'}).click();await expect(composer).toBeEditable()
    await composer.press('Enter');await expect(confirmation).toBeVisible()
    const committed=sender.waitForResponse(response=>response.url().includes('/messages')&&response.request().method()==='POST')
    await confirmation.getByRole('button',{name:'Send broadcast',exact:true}).click();assert.equal((await committed).status(),200)
    const summary=sender.locator('summary').filter({hasText:'@channel · 6 recipients'})
    await expect(summary).toBeVisible();await summary.click();await expect(summary.locator('..').getByText(new RegExp(people[10].name))).toBeVisible()
    await sender.screenshot({animations:'disabled',path:resolve(destination,`sent-${width}.png`)})
    await recipient.goto(origin+'/app?view=attention');await expect(recipient.getByText('A channel-wide mention',{exact:true}).last()).toBeVisible();await recipient.screenshot({animations:'disabled',path:resolve(destination,`attention-${width}.png`)})
    await recipient.goto(origin+'/app?view=you');const away=recipient.getByRole('checkbox',{name:'Set yourself away for @here'});await expect(away).toBeEnabled();if(await away.isChecked()){await away.click();await expect(away).not.toBeChecked()}await away.click();await expect(away).toBeChecked();await away.scrollIntoViewIfNeeded();await recipient.screenshot({animations:'disabled',path:resolve(destination,`availability-${width}.png`)})
    const email=recipient.getByRole('checkbox',{name:'Someone uses @channel, @here or @everyone'});await expect(email).toBeChecked();await email.click();await expect(email).not.toBeChecked();await email.click();await expect(email).toBeChecked();await email.scrollIntoViewIfNeeded();await recipient.screenshot({animations:'disabled',path:resolve(destination,`email-${width}.png`)})
    const push=recipient.getByRole('checkbox',{name:'Channel-wide mentions',exact:true});await expect(push).toBeDisabled();await push.scrollIntoViewIfNeeded();await recipient.screenshot({animations:'disabled',path:resolve(destination,`push-settings-${width}.png`)})
    await recipient.goto(url)
    await recipient.locator('summary[title="Conversation options"]').click()
    await recipient.getByRole('button',{name:'Notification settings',exact:true}).click()
    const ignore=recipient.getByRole('checkbox',{name:'Ignore @channel, @here and @everyone'})
    await ignore.click();await expect(ignore).toBeChecked()
    await recipient.screenshot({animations:'disabled',path:resolve(destination,`ignore-${width}.png`)})
    await recipient.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click()
    await sender.getByRole('button',{name:'Details',exact:true}).click()
    const policy=sender.getByRole('region',{name:'Channel broadcasts'})
    await policy.getByLabel('Who can use @channel, @here and @everyone?').selectOption('admins')
    const changed=sender.waitForResponse(response=>response.url().endsWith('/broadcast')&&response.request().method()==='PATCH')
    await policy.getByRole('button',{name:'Save broadcast policy'}).click();assert.equal((await changed).status(),200)
    await policy.scrollIntoViewIfNeeded();await sender.screenshot({animations:'disabled',path:resolve(destination,`policy-${width}.png`)})
    const memberComposer=recipient.getByRole('textbox',{name:'Message '+room.name,exact:true})
    await memberComposer.fill('<!channel> Please read the new launch checklist.')
    const denied=recipient.waitForResponse(response=>response.url().includes('/messages')&&response.request().method()==='POST')
    await memberComposer.press('Enter');assert.equal((await denied).status(),403)
    await expect(recipient.getByText(/You cannot broadcast under this channel/).first()).toBeVisible()
    await recipient.screenshot({animations:'disabled',path:resolve(destination,`denied-${width}.png`)})
    await sender.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();await sender.locator('summary[title="Conversation options"]').click();await sender.getByRole('button',{name:'Schedule message',exact:true}).click();const scheduled=sender.getByRole('dialog');await scheduled.getByLabel('Message for later').fill('@channel The next launch briefing starts at 10am.');const consent=scheduled.getByRole('checkbox',{name:'Allow this broadcast at each scheduled occurrence'});await consent.check();await scheduled.getByRole('button',{name:'Schedule message',exact:true}).scrollIntoViewIfNeeded();await sender.screenshot({animations:'disabled',path:resolve(destination,`scheduled-${width}.png`)});await scheduled.getByRole('button',{name:'Schedule message',exact:true}).click();await expect(scheduled).toHaveCount(0)
    await composer.fill('/remind #'+room.id+' "@channel Post your customer update" tomorrow at 9am');await composer.press('Enter');const reminder=sender.getByRole('dialog');await reminder.getByRole('button',{name:'Preview reminder'}).click();await reminder.getByRole('checkbox',{name:'Allow this broadcast at each scheduled occurrence'}).check();await reminder.getByRole('button',{name:'Confirm reminder',exact:true}).scrollIntoViewIfNeeded();await sender.screenshot({animations:'disabled',path:resolve(destination,`reminder-${width}.png`)});await reminder.getByRole('button',{name:'Confirm reminder',exact:true}).click();await expect(reminder).toHaveCount(0)
    await sender.goto(origin+'/app?view=team');const workspace=sender.getByRole('region',{name:'Workspace broadcasts'});await workspace.getByLabel('Who can use @channel, @here and @everyone?').selectOption('admins');await workspace.getByLabel('Organization-wide default channel').selectOption({label:'#Team broadcast planning'});await workspace.getByRole('button',{name:'Save broadcast policy'}).click();await expect(workspace.getByText('Broadcast policy saved.',{exact:true})).toBeVisible();await workspace.scrollIntoViewIfNeeded();await sender.screenshot({animations:'disabled',path:resolve(destination,`workspace-policy-${width}.png`)});await workspace.getByLabel('Who can use @channel, @here and @everyone?').selectOption('everyone');await workspace.getByLabel('Organization-wide default channel').selectOption('');await workspace.getByRole('button',{name:'Save broadcast policy'}).click();await expect(workspace.getByText('Broadcast policy saved.',{exact:true})).toBeVisible()

   }finally{for(const context of contexts)await context.close()}
  }
 }finally{await browser.close()}
}
