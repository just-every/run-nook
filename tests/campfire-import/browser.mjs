import {chromium,expect} from '@playwright/test'
import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {resolve} from 'node:path'
export async function campfireBrowser({origin,owner,journey,destination='evidence/campfire-import'}){
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{
  await mkdir(destination,{recursive:true})
  for(const width of [1440,390]){
   const context=await browser.newContext({serviceWorkers:'block',viewport:{width,height:width===390?844:1000}})
   try{
    const at=owner.cookie.indexOf('=');await context.addCookies([{name:owner.cookie.slice(0,at),value:owner.cookie.slice(at+1),url:origin}])
    const page=await context.newPage();await page.goto(origin+'/imports')
    await expect(page.getByRole('heading',{name:'Bring your Slack history into Nook',exact:true})).toBeVisible()
    await page.screenshot({path:resolve(destination,`slack-entry-${width}.png`),animations:'disabled'})
    await page.getByRole('link',{name:'Import Campfire history',exact:true}).click()
    await expect(page.getByRole('heading',{name:'Bring your Campfire history into Nook',exact:true})).toBeVisible()
    await page.screenshot({path:resolve(destination,`upload-${width}.png`),animations:'disabled'})
    await page.getByRole('link',{name:'Backup format and migration guide',exact:true}).click()
    await expect(page.getByRole('heading',{name:'Move a Campfire workspace into Nook',exact:true})).toBeVisible()
    await page.screenshot({path:resolve(destination,`guide-${width}.png`),animations:'disabled'})
    await page.goto(origin+'/imports?source=campfire')
    await expect(page.getByLabel('Campfire backup',{exact:true})).toBeEnabled()
    await page.getByLabel('Campfire backup',{exact:true}).setInputFiles(resolve('tests/campfire-import/fixtures/once-campfire-express.tar.gz'))
    await page.getByLabel('Source namespace',{exact:true}).fill(`campfire-browser-${width}-${crypto.randomUUID().slice(0,8)}`)
    for(const [index,name]of ['Maya Chen','Leo Martin','Aisha Patel','Sam Rivera'].entries())await page.getByRole('combobox',{name:'Map '+name,exact:true}).selectOption(journey.people[index].user.id)
    await page.getByRole('heading',{name:'2. Map identities and review audiences',exact:true}).scrollIntoViewIfNeeded()
    await page.screenshot({path:resolve(destination,`mapping-${width}.png`),animations:'disabled'})
    async function preview(){const response=page.waitForResponse(r=>r.url().endsWith('/api/campfire-imports/preview')&&r.request().method()==='POST');await page.getByRole('button',{name:'Preview exact import',exact:true}).click();return(await response).json()}
    let planned=await preview()
    if(planned.needsOmissionReview){await page.getByRole('checkbox',{name:'I reviewed and accept these exact omissions',exact:true}).check();planned=await preview()}
    assert.ok(planned.fingerprint)
    await page.getByRole('heading',{name:'3. Approve the historical import',exact:true}).scrollIntoViewIfNeeded()
    await page.screenshot({path:resolve(destination,`preview-${width}.png`),animations:'disabled'})
    await expect(page.getByText('supplier-estimate.csv',{exact:true})).toBeVisible()
    await page.getByRole('button',{name:'Apply reviewed plan',exact:true}).first().click()
    await expect(page.getByRole('status')).toContainText('Import completed:',{timeout:90_000})
    await page.getByRole('heading',{name:'Import jobs',exact:true}).scrollIntoViewIfNeeded()
    await page.screenshot({path:resolve(destination,`completed-${width}.png`),animations:'disabled'})
    await page.reload();const entries=planned.counts.channels+planned.counts.actors+planned.counts.messages;await expect(page.getByText(`completed · ${entries} / ${entries} source entries`,{exact:true}).last()).toBeVisible()
    const status=await journey.call(journey.base+'/'+planned.review),channel=status.destinations.find(d=>d.sourceId==='2')
    await page.goto(origin+'/app?conversation='+channel.id)
    await expect(page.getByText('Kickoff is Tuesday. Café notes and 日本語 are welcome.',{exact:true}).last()).toBeVisible()
    await page.screenshot({path:resolve(destination,`imported-${width}.png`),animations:'disabled'})
   }finally{await context.close()}
  }
 }finally{await browser.close()}
}
