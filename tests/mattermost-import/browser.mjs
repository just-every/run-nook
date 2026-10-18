import {chromium,expect} from '@playwright/test'
import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {resolve} from 'node:path'
export async function mattermostBrowser({origin,owner,journey,destination='evidence/mattermost-import'}){
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{
  await mkdir(destination,{recursive:true})
  for(const width of [1440,390]){
   const context=await browser.newContext({serviceWorkers:'block',viewport:{width,height:width===390?844:1000}})
   try{
    const at=owner.cookie.indexOf('=');await context.addCookies([{name:owner.cookie.slice(0,at),value:owner.cookie.slice(at+1),url:origin}])
    const page=await context.newPage(),shot=async name=>{assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no page overflow');await page.screenshot({path:resolve(destination,`${name}-${width}.png`),animations:'disabled'})}
    await page.goto(origin+'/imports');await expect(page.getByRole('heading',{name:'Bring your Slack history into Nook',exact:true})).toBeVisible();await shot('entry')
    await page.getByRole('link',{name:'Import Mattermost history',exact:true}).click();await expect(page.getByRole('heading',{name:'Bring your Mattermost history into Nook',exact:true})).toBeVisible();await shot('upload')
    await page.getByRole('link',{name:'Export format and migration guide',exact:true}).click();await expect(page.getByRole('heading',{name:'Move a Mattermost workspace into Nook',exact:true})).toBeVisible();await shot('guide')
    await page.goto(origin+'/imports?source=mattermost');await expect(page.getByLabel('Mattermost export ZIP',{exact:true})).toBeEnabled()
    await page.getByLabel('Mattermost export ZIP',{exact:true}).setInputFiles(resolve('tests/mattermost-import/fixtures/mattermost-export.zip'))
    await page.getByLabel('Source namespace',{exact:true}).fill(`mattermost-browser-${width}-${crypto.randomUUID().slice(0,8)}`)
    for(const name of ['maya','leo','aisha','sam'])await page.getByRole('combobox',{name:'Map '+name[0].toUpperCase()+name.slice(1)+' Fixture',exact:true}).selectOption(journey.people[name].user.id)
    await page.getByRole('button',{name:'Retain all source roles as historical labels',exact:true}).click()
    await page.getByRole('heading',{name:'2. Map identities and review audiences',exact:true}).scrollIntoViewIfNeeded();await shot('mapping')
    async function preview(){const response=page.waitForResponse(r=>r.url().endsWith('/api/mattermost-imports/preview')&&r.request().method()==='POST');await page.getByRole('button',{name:'Preview exact import',exact:true}).click();return(await response).json()}
    let planned=await preview()
    if(planned.needsOmissionReview){await page.getByRole('checkbox',{name:'I reviewed and accept these exact omissions',exact:true}).check();planned=await preview()}
    assert.ok(planned.fingerprint)
    await page.getByRole('heading',{name:'3. Approve the historical import',exact:true}).scrollIntoViewIfNeeded();await shot('preview')
    await page.getByRole('button',{name:'Apply reviewed plan',exact:true}).first().click();await expect(page.getByRole('status')).toContainText('Import completed:',{timeout:90_000})
    await page.getByRole('heading',{name:'Import jobs',exact:true}).scrollIntoViewIfNeeded();await shot('completed')
    const state=await journey.call(journey.base+'/'+planned.review),histories=[]
    for(const channel of state.destinations){const source=journey.upload.channels.find(c=>c.sourceId===channel.sourceId);if(source.sourceMembers.includes('maya'))histories.push(...await journey.call(`/api/conversations/${channel.id}/messages`,{actor:journey.people.maya}))}
    const root=histories.find(m=>m.body===journey.expected.posts.find(p=>p.key==='public-root').message)
    const memberCookie=journey.people.maya.cookie,memberAt=memberCookie.indexOf('=');await context.addCookies([{name:memberCookie.slice(0,memberAt),value:memberCookie.slice(memberAt+1),url:origin}])
    await page.goto(origin+'/app?conversation='+root.conversation)
    await expect(page.getByText(root.body,{exact:true}).last()).toBeVisible();await expect(page.getByLabel('Imported Mattermost reactions · read only').first()).toBeVisible();await expect.poll(()=>page.getByLabel('Imported Mattermost reactions · read only').locator('img').first().evaluate(image=>image.complete&&image.naturalWidth>0)).toBe(true);await shot('history')
    await page.getByTitle('Conversation options',{exact:true}).click();await page.getByRole('button',{name:'Pinned messages',exact:true}).click();await expect(page.getByRole('dialog')).toContainText(root.body);await shot('pins')
    // The imported private save is visible through the existing product collection.
    await page.goto(origin+'/app?view=saved')
    await expect(page.getByRole('heading',{name:'Saved',exact:true}).first()).toBeVisible();await shot('saved')
   }finally{await context.close()}
  }
 }finally{await browser.close()}
}
