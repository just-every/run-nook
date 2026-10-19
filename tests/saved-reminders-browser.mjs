import assert from 'node:assert/strict'
import {chromium,expect} from '@playwright/test'
import {mkdir} from 'node:fs/promises'
import {resolve} from 'node:path'

export async function savedRemindersBrowser({origin,owner,member,destination='evidence/saved-reminders'}){
 const call=async(path,body,cookie=owner.cookie,method='POST')=>{const r=await fetch(origin+path,{method,headers:{cookie,origin,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});assert.equal(r.status,200);return r.json()}
 const browser=await chromium.launch({channel:'chromium',headless:true,args:['--use-mock-keychain','--password-store=basic']})
 const localTime=(minutes)=>{const d=new Date(Date.now()+minutes*60000),pad=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`}
 try{
  await mkdir(destination,{recursive:true})
  for(const width of [1440,390]){
   const room=await call('/api/conversations',{name:'Support handoff '+width,kind:'dm',participants:[member.user.id]})
   const root=await call(`/api/conversations/${room.id}/messages`,{body:`Please review the ${width===390?'mobile':'desktop'} support handoff before Thursday’s launch briefing.`,intent:crypto.randomUUID()})
   const context=await browser.newContext({viewport:{width,height:width===390?844:1000}})
   try{
    const [name,...value]=member.cookie.split('=');await context.addCookies([{name,value:value.join('='),url:origin}]);const page=await context.newPage()
    await page.goto(origin+'/app?conversation='+room.id+'&focus='+root.id)
    await page.locator('[data-message="'+root.id+'"]').getByLabel('More actions for message by '+owner.user.name,{exact:true}).click()
    await page.getByRole('button',{name:'Save for later',exact:true}).click()
    await expect(page.getByRole('button',{name:'Remove from Saved',exact:true})).toBeVisible()
    await page.goto(origin+'/app?view=saved')
    const item=page.getByRole('listitem').filter({hasText:root.body});await expect(item).toBeVisible()
    await item.getByRole('button',{name:'Remind me',exact:true}).click()
    await item.getByLabel('Remind me at').fill(localTime(-5))
    await item.getByRole('button',{name:'Save reminder',exact:true}).click()
    await expect(item.getByText('Choose a future date and time.',{exact:true})).toBeVisible()
    await page.screenshot({path:resolve(destination,`invalid-${width}.png`)})
    await item.getByLabel('Remind me at').fill(localTime(5))
    await page.screenshot({path:resolve(destination,`schedule-${width}.png`)})
    const scheduled=page.waitForResponse(r=>r.url().includes('/api/saved/')&&r.request().method()==='PATCH')
    await item.getByRole('button',{name:'Save reminder',exact:true}).click();const response=await scheduled;assert.equal(response.status(),200);const saved=(await response.json()).saved
    await expect(item.getByText(/^Reminder:/)).toBeVisible()
    await item.getByRole('button',{name:'Edit reminder',exact:true}).click();const editedTime=localTime(10);await item.getByLabel('Remind me at').fill(editedTime)
    // Returning to the tab refreshes Saved without discarding an open edit.
    const refreshed=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/saved'&&r.request().method()==='GET')
    await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await refreshed
    await expect(item.getByLabel('Remind me at')).toHaveValue(editedTime)
    await page.screenshot({path:resolve(destination,`edit-${width}.png`)})
    await item.getByRole('button',{name:'Save reminder',exact:true}).click();await expect(item.getByRole('button',{name:'Edit reminder',exact:true})).toBeVisible()
    await page.reload();await expect(item.getByText(/^Reminder:/)).toBeVisible()
    await page.screenshot({path:resolve(destination,`pending-${width}.png`)})
    // Move this same reminder through its public API to exercise due display
    // without making CI wait ten minutes for the edited browser choice.
    await call('/api/saved/'+saved,{due:Date.now()+2000,timeZone:'America/New_York'},member.cookie,'PATCH')
    await page.goto(origin+'/app?view=attention')
    const card=page.locator('[data-reminder="'+saved+'"]');await expect(card).toBeVisible({timeout:15000});await expect(card).toContainText(root.body)
    await page.screenshot({path:resolve(destination,`due-${width}.png`)})
    await card.getByRole('button',{name:'Remind me in an hour',exact:true}).click();await expect(card).toHaveCount(0)
    await page.goto(origin+'/app?view=saved');await item.getByRole('button',{name:'Cancel reminder',exact:true}).click();await expect(item.getByText('Reminder cancelled',{exact:true})).toBeVisible()
    await page.waitForLoadState('networkidle');await expect(item.getByText('Reminder cancelled',{exact:true})).toBeVisible()
    await page.screenshot({path:resolve(destination,`cancelled-${width}.png`)})
   }finally{await context.close()}
  }
 }finally{await browser.close()}
}
