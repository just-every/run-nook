import {chromium,expect} from '@playwright/test'
import {mkdir} from 'node:fs/promises'
import {resolve} from 'node:path'
import assert from 'node:assert/strict'
export async function scheduledBrowser({origin,owner,member,destination='evidence/scheduled',memberOccurrences=false}){
 const call=async(path,body)=>{const response=await fetch(origin+path,{method:'POST',headers:{cookie:owner.cookie,origin,'content-type':'application/json'},body:JSON.stringify(body)});assert.equal(response.status,200,await response.clone().text());return response.json()}
 const browser=await chromium.launch({channel:'chromium',headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{await mkdir(destination,{recursive:true});for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:width===390?844:1000}})
  try{
   const [name,...value]=owner.cookie.split('=');await context.addCookies([{name,value:value.join('='),url:origin}]);const page=await context.newPage()
   const room=await call('/api/conversations',{name:'US support handoff '+width,kind:'private',participants:[member.user.id]})
   await page.goto(origin+'/app?conversation='+room.id);await page.getByRole('textbox',{name:'Message US support handoff '+width,exact:true}).fill('Thursday rollout: please check the support rotation before the 9am customer briefing.');await page.getByLabel('Attach file',{exact:true}).setInputFiles({name:'support-rotation.txt',mimeType:'text/plain',buffer:Buffer.from('Morgan: Thursday briefing\nAlex: Friday handoff\n')});await expect(page.locator('.staged-files')).toContainText('support-rotation.txt');await page.getByRole('button',{name:'Schedule for later'}).click()
   const dialog=page.getByRole('dialog');await dialog.getByLabel('Message for later').fill('Thursday rollout: please check the support rotation before the 9am customer briefing.')
   const at=new Date(Date.now()+3600000).toISOString().slice(0,16)
   await dialog.getByLabel('Time zone',{exact:true}).fill('America/New_York');await dialog.getByLabel('Send at',{exact:true}).fill(at);await dialog.getByLabel('Repeat',{exact:true}).selectOption('weekly')
   await dialog.getByLabel('End date',{exact:true}).fill(new Date(Date.now()+21*86400000).toISOString().slice(0,10))
   await expect(dialog.getByRole('heading',{name:'Review send times'})).toBeVisible();await page.screenshot({animations:'disabled',path:resolve(destination,`compose-${width}.png`)})
   await dialog.getByRole('button',{name:'Schedule message',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({animations:'disabled',path:resolve(destination,`compose-controls-${width}.png`)})
   const saved=page.waitForResponse(r=>r.url().endsWith('/scheduled')&&r.request().method()==='POST');await dialog.getByRole('button',{name:'Schedule message',exact:true}).click();assert.equal((await saved).status(),200);await expect(dialog).toHaveCount(0)
   await page.goto(origin+'/app?view=scheduled');const card=page.getByRole('article',{name:'Scheduled message in US support handoff '+width});await expect(card.getByText(/Thursday rollout/)).toBeVisible();await expect(card.getByText(/support-rotation.txt/)).toBeVisible()
   await card.scrollIntoViewIfNeeded();await page.screenshot({animations:'disabled',path:resolve(destination,`pending-${width}.png`)})
   await card.getByRole('button',{name:'Pause future messages'}).click();await expect(card.getByText('Paused',{exact:true})).toBeVisible()
   await card.getByRole('button',{name:'Review and resume'}).click();const edit=page.getByRole('dialog');await expect(edit.getByText(/Owner: NativeOwner/)).toBeVisible();await edit.getByLabel('Message for later').fill('Updated briefing: customer success has approved the Thursday rollout.')
   await edit.getByLabel('Send at',{exact:true}).fill(new Date(Date.now()+7200000).toISOString().slice(0,16));await page.screenshot({animations:'disabled',path:resolve(destination,`edit-${width}.png`)})
   await edit.getByRole('button',{name:'Save schedule'}).scrollIntoViewIfNeeded();await page.screenshot({animations:'disabled',path:resolve(destination,`edit-controls-${width}.png`)})
   const updated=page.waitForResponse(r=>r.url().includes('/scheduled/')&&r.request().method()==='PATCH');await edit.getByRole('button',{name:'Save schedule'}).click();assert.equal((await updated).status(),200);await expect(edit).toHaveCount(0)
   await expect(card.getByText(/Updated briefing/)).toBeVisible();await card.getByRole('button',{name:'Cancel scheduled message'}).click();await expect(card.getByText('Cancelled',{exact:true})).toBeVisible();await card.scrollIntoViewIfNeeded();await page.screenshot({animations:'disabled',path:resolve(destination,`cancelled-${width}.png`)})
   // A real malformed-time response stays in the dialog with the draft intact.
   await page.goto(origin+'/app?conversation='+room.id);await page.locator('summary[title="Conversation options"]').click();await page.getByRole('button',{name:'Schedule message',exact:true}).click();await page.getByLabel('Message for later').fill('Keep this draft when a time is refused.');await page.getByLabel('Send at',{exact:true}).fill('2026-01-01T09:00')
   await page.getByRole('dialog').getByRole('button',{name:'Schedule message',exact:true}).click();await expect(page.getByRole('alert').getByText('Choose a future time within one year')).toBeVisible();await expect(page.getByLabel('Message for later')).toHaveValue('Keep this draft when a time is refused.');await page.screenshot({animations:'disabled',path:resolve(destination,`refused-${width}.png`)})
   if(memberOccurrences){
    await context.clearCookies();const [memberName,...memberValue]=member.cookie.split('=');await context.addCookies([{name:memberName,value:memberValue.join('='),url:origin}]);await page.goto(origin+'/app?view=scheduled')
    const sent=page.getByRole('article').filter({has:page.getByText('Sent',{exact:true})});await expect(sent).toHaveCount(1)
    await sent.getByText('Occurrence history',{exact:true}).click();await expect(sent.getByRole('button',{name:'Open sent message'})).toBeVisible()
    await expect(page.getByText('Needs review',{exact:true})).toBeVisible();await expect(page.getByText('Failed',{exact:true}).first()).toBeVisible();await page.screenshot({animations:'disabled',path:resolve(destination,`occurrences-${width}.png`)})
    const held=page.getByRole('article').filter({has:page.getByText('Needs review',{exact:true})});await held.scrollIntoViewIfNeeded();await page.screenshot({animations:'disabled',path:resolve(destination,`held-${width}.png`)})
    const failed=page.getByRole('article',{name:'Scheduled message in Scheduled announcements'});await failed.scrollIntoViewIfNeeded();await page.screenshot({animations:'disabled',path:resolve(destination,`failed-${width}.png`)})
    await sent.getByRole('button',{name:'Open sent message'}).click();await expect(page).toHaveURL(/view=chat/);await expect(page.getByRole('region',{name:'Thread messages',exact:true}).getByText('Customer success: review the launch checklist before the Thursday briefing.',{exact:true})).toBeVisible();await page.screenshot({animations:'disabled',path:resolve(destination,`sent-${width}.png`)})
   }
  }finally{await context.close()}
 }}finally{await browser.close()}
}
