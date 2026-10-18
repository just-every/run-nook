import {chromium,expect} from '@playwright/test'
import {mkdir} from 'node:fs/promises'
import {resolve} from 'node:path'
import assert from 'node:assert/strict'
import {searchPdf} from './search.mjs'
export async function searchBrowser({origin,owner,member,destination}){
 const base=typeof origin==='function'?origin():origin
 const call=async(path,body)=>{const r=await fetch(base+path,{method:'POST',headers:{cookie:owner.cookie,origin:base,'content-type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,200,await r.clone().text());return r.json()}
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{
  if(destination)await mkdir(destination,{recursive:true})
  for(const width of [1440,390]){
   const context=await browser.newContext({serviceWorkers:'block',viewport:{width,height:width===390?844:1000},timezoneId:'America/New_York'})
   try{
    const [name,...value]=member.cookie.split('=');await context.addCookies([{name,value:value.join('='),url:base}])
    const room=await call('/api/conversations',{name:'Customer success launch '+width,kind:'private',participants:[member.user.id]})
    const file=await call(`/api/conversations/${room.id}/attachments`,{name:'Customer-success-Q3-brief.pdf',mime:'application/pdf',data:searchPdf('Customer success handoff: PO 5k. HR approved the Q3 rollout.').toString('base64'),intent:crypto.randomUUID()})
    const root=await call(`/api/conversations/${room.id}/messages`,{body:'The signed launch brief and support handoff are ready for review.',attachments:[file.id],intent:crypto.randomUUID()})
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
    await page.goto(base+'/app?view=search&q='+encodeURIComponent(`"Customer success handoff" in:#${room.id} has:file`))
    const result=page.locator('.search-result').filter({hasText:file.name})
    await expect(result).toBeVisible();await expect(result).toContainText('PO 5k')
    await expect(page.getByRole('button',{name:'Remove filter has:file',exact:true})).toBeVisible()
    if(destination)await page.screenshot({animations:'disabled',path:resolve(destination,`file-text-${width}.png`)})
    await page.getByRole('button',{name:'Remove filter has:file',exact:true}).click();await expect(result).toBeVisible()
    await page.getByLabel('Search conversations',{exact:true}).fill('HR Q3 -draft')
    await page.getByText('Filters',{exact:true}).click()
    await page.getByLabel('Conversation type',{exact:true}).selectOption('private')
    await page.locator('.search-form').getByRole('button',{name:'Search',exact:true}).click()
    await expect(result).toBeVisible()
    await page.getByText('Filters',{exact:true}).click()
    if(destination)await page.screenshot({animations:'disabled',path:resolve(destination,`filters-${width}.png`)})
    await result.getByRole('button',{name:'Open in conversation',exact:true}).click()
    await expect(page).toHaveURL(new RegExp('focus='+root.id));await expect(page.getByRole('complementary',{name:'Thread',exact:true}).getByText(root.body,{exact:true})).toBeVisible()
    await page.goto(base+'/app?view=search&q='+encodeURIComponent('"missing quotation'))
    await expect(page.getByRole('alert')).toContainText('Close the quoted search phrase')
    if(destination)await page.screenshot({animations:'disabled',path:resolve(destination,`query-error-${width}.png`)})
    await page.goto(base+'/app?view=search&q='+encodeURIComponent(`"Customer success handoff"`))
    await expect(result).toBeVisible()
    await call(`/api/conversations/${room.id}/members`,{user:member.user.id,remove:true})
    await page.reload();await expect(result).toHaveCount(0)
    if(destination)await page.screenshot({animations:'disabled',path:resolve(destination,`revoked-${width}.png`)})
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[])
   }finally{await context.close()}
  }
 }finally{await browser.close()}
}
