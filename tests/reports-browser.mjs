import {chromium,expect} from '@playwright/test'
import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {resolve} from 'node:path'
const require=createRequire(import.meta.url)
export async function reportsBrowser({origin,owner,fixture,destination=process.env.TEAM_CHAT_EVIDENCE_DIR??'evidence/reports'}){
 const base=typeof origin==='function'?origin():origin
 await mkdir(destination,{recursive:true})
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block',acceptDownloads:true})
  try{
   const [name,...value]=owner.cookie.split('=');await context.addCookies([{name,value:value.join('='),url:base}])
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
   await page.goto(base+'/reports');await expect(page.locator('[data-report-ready]')).toBeVisible()
   await expect(page.getByRole('heading',{name:'Membership',exact:true})).toBeVisible()
   await page.getByLabel('From (UTC)').fill('2000-01-01T00:00');await page.getByLabel('Until (UTC)').fill('2099-01-01T00:00');await page.getByRole('button',{name:'Apply range'}).click();await expect(page.locator('[data-report-ready]')).toBeVisible()
   await expect(page.getByText('Range: 2000-01-01T00:00:00.000Z to 2099-01-01T00:00:00.000Z',{exact:false})).toBeVisible()
   await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});const violations=await page.evaluate(async()=>{const r=await window.axe.run(document.querySelector('main'));return r.violations.filter(v=>['serious','critical'].includes(v.impact))});assert.deepEqual(violations,[])
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:resolve(destination,`reports-administration-${width}.png`),fullPage:true})
   await page.getByRole('button',{name:'Commitments',exact:true}).click();await expect(page.locator('[data-report-ready]')).toBeVisible();await expect(page.getByText('=SUM(1,2)',{exact:true})).toBeVisible()
   const downloading=page.waitForEvent('download');await page.getByRole('link',{name:'Download CSV',exact:true}).click();const download=await downloading;const chunks=[];for await(const chunk of await download.createReadStream())chunks.push(chunk);assert.match(Buffer.concat(chunks).toString(),/'=SUM\(1,2\)/)
   assert.equal(await page.evaluate(()=>window.__rerHydration?.count??0),0);assert.deepEqual(await page.evaluate(async()=>{const r=await window.axe.run(document.querySelector('main'));return r.violations.filter(v=>['serious','critical'].includes(v.impact))}),[]);await page.screenshot({path:resolve(destination,`reports-commitments-${width}.png`),fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
   const target=page.locator('li').filter({hasText:'=SUM(1,2)'});await target.getByRole('link',{name:'Open source',exact:true}).click();await expect(page).toHaveURL(new RegExp('focus='+fixture.source.id));await expect(page.getByText('PRIVATE-MESSAGE-BODY-NEVER-IN-REPORT',{exact:true})).toBeVisible()
   const [adminName,...adminValue]=fixture.admin.cookie.split('=');await context.addCookies([{name:adminName,value:adminValue.join('='),url:base}]);await page.goto(base+'/reports');await expect(page.locator('[data-report-ready]')).toBeVisible()
   await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});await expect(page.getByLabel('Anonymous private summary')).toContainText('Conversations: 5');await expect(page.locator('main')).not.toContainText('PRIVATE-REPORT-MANAGEMENT');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.equal(await page.evaluate(()=>window.__rerHydration?.count??0),0);assert.deepEqual(await page.evaluate(async()=>{const r=await window.axe.run(document.querySelector('main'));return r.violations.filter(v=>['serious','critical'].includes(v.impact))}),[]);await page.screenshot({path:resolve(destination,`reports-anonymous-${width}.png`),fullPage:true})
   assert.deepEqual(errors,[])
  }finally{await context.close()}
 }}finally{await browser.close()}
}
