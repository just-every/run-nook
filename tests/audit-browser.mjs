import {chromium,expect} from '@playwright/test'
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
export async function auditBrowser({origin,admin,member,destination='evidence/audit'}){
 await mkdir(destination,{recursive:true})
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{
  for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block',acceptDownloads:true})
   const cookie=actor=>{const [name,...value]=actor.cookie.split('=');return {name,value:value.join('='),url:origin}}
   try{
    await context.addCookies([cookie(admin)]);const page=await context.newPage();await page.goto(origin+'/app?view=team')
    const log=page.getByRole('region',{name:'Audit log',exact:true});await expect(log.locator('ol').getByText('Posted with admin permission',{exact:true})).toBeVisible()
    await log.getByText('Filters',{exact:true}).click();await log.getByLabel('Kind',{exact:true}).selectOption('policy.posting');await expect(log.locator('li')).toHaveCount(1)
    await expect(log.locator('ol').getByText('confirmed',{exact:true})).toBeVisible()
    const downloaded=page.waitForEvent('download');await log.getByRole('button',{name:'Download JSON',exact:true}).click();await(await downloaded).saveAs(resolve(destination,`audit-filtered-${width}.json`))
    await log.getByLabel('Kind',{exact:true}).selectOption('');await log.getByLabel('Outcome',{exact:true}).selectOption('uncertain');await expect(log.locator('ol').getByText('Cancelled an export',{exact:true})).toBeVisible()
    await log.getByRole('heading',{name:'Audit log',exact:true}).scrollIntoViewIfNeeded();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:resolve(destination,`audit-${width}.png`)})
    await log.locator('li').filter({hasText:'Cancelled an export'}).scrollIntoViewIfNeeded();await page.screenshot({path:resolve(destination,`audit-items-${width}.png`)})
    await context.clearCookies();await context.addCookies([cookie(member)]);await page.goto(origin+'/app?view=team');await expect(page.getByRole('region',{name:'Audit log',exact:true})).toHaveCount(0)
   }finally{await context.close()}
  }
  await writeFile(resolve(destination,'screens.json'),JSON.stringify({widths:[1440,390],adminFiltersAndDownloads:true,memberHidden:true})+'\n')
 }finally{await browser.close()}
}
