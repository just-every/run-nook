import {chromium,expect} from '@playwright/test'
import {mkdir} from 'node:fs/promises'
import {resolve} from 'node:path'
// NOOK-051 owner screen at 1440 and 390: the log filters by outcome and action and
// offers CSV/JSON export; a member's Team page offers no log at all.
export async function auditBrowser({origin,owner,outsider,destination='evidence/audit-log'}){
 const cookie=actor=>{const at=actor.cookie.indexOf('=');return {name:actor.cookie.slice(0,at),value:actor.cookie.slice(at+1),url:origin}}
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{await mkdir(destination,{recursive:true});for(const width of [1440,390]){
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width,height:width===390?844:1000}})
  try{
   await context.addCookies([cookie(owner)]);const page=await context.newPage()
   const shot=step=>page.screenshot({animations:'disabled',fullPage:true,path:resolve(destination,`${step}-${width}.png`)})
   await page.goto(origin+'/app?view=team')
   const log=page.getByRole('region',{name:'Audit log'})
   await expect(log.getByRole('heading',{name:'Audit log',exact:true})).toBeVisible()
   const entries=log.getByRole('list',{name:'Audit entries'})
   await expect(entries.getByRole('article',{name:'Removed from a channel Confirmed'})).toHaveCount(1)
   await expect(entries.getByRole('article',{name:'Admin override post Confirmed'})).toContainText('#audit-ops')
   await expect(log).not.toContainText('Board-only quarterly numbers')
   await log.scrollIntoViewIfNeeded();await shot('audit-log')
   await log.getByRole('combobox',{name:/^Outcome/}).selectOption('uncertain')
   await expect(entries.getByRole('article',{name:'Readable export Uncertain'})).toContainText('started; completion not confirmed')
   await expect(entries.getByRole('article',{name:/ Confirmed$/})).toHaveCount(0)
   await log.getByRole('combobox',{name:/^Outcome/}).selectOption('')
   await log.getByRole('combobox',{name:/^Action/}).selectOption('erasure')
   await expect(entries.getByRole('article',{name:'Erasure: member Confirmed'})).toContainText('An erased person')
   await expect(entries.getByRole('article',{name:'Erasure: message Confirmed'}).first()).toContainText('a direct conversation')
   const download=page.waitForEvent('download');await log.getByRole('link',{name:'CSV',exact:true}).click()
   const file=await download;await expect.poll(()=>file.suggestedFilename()).toMatch(/^nook-audit-.*\.csv$/)
   await log.scrollIntoViewIfNeeded();await shot('audit-log-filtered')
  }finally{await context.close()}
  const member=await browser.newContext({serviceWorkers:'block',viewport:{width,height:width===390?844:1000}})
  try{await member.addCookies([cookie(outsider)]);const page=await member.newPage();await page.goto(origin+'/app?view=team');await expect(page.getByText('Only owners and admins manage the team.')).toBeVisible();await expect(page.getByRole('region',{name:'Audit log'})).toHaveCount(0)}
  finally{await member.close()}
 }}finally{await browser.close()}
}
