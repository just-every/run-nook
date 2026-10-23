import assert from 'node:assert/strict'
import {chromium} from '@playwright/test'
import {mkdir} from 'node:fs/promises'
import {auditAccessibility} from './accessibility.mjs'
export const evidenceDirectory=name=>(process.env.NOOK_EVIDENCE_DIR??'evidence')+'/'+name
// One headless browser, a fresh context per person and width; the service worker is blocked because these screens are not about push.
export async function browserWidths(work,destination){
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});await mkdir(destination,{recursive:true})
 try{for(const width of [1440,390])await work(width,async(person,{errors=[]}={})=>{
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width,height:width===390?844:1000}}),[name,...value]=person.cookie.split('=')
  await context.addCookies([{name,value:value.join('='),url:person.origin}]);const page=await context.newPage()
  page.on('pageerror',error=>errors.push(String(error)));page.on('console',message=>{if(message.type()==='error')errors.push(message.text())})
  return {page,close:()=>context.close()}
 })}finally{await browser.close()}
}
export async function checkScreen(page,destination,state,errors){
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false,state+': no horizontal overflow')
 await auditAccessibility(page,destination,state)
 assert.deepEqual(errors,[],state+': no console or page error')
}
