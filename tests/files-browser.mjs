import {chromium,expect} from '@playwright/test'
import {mkdir,readFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import assert from 'node:assert/strict'

export async function filesBrowser({origin,owner,member,destination}){
 const base=typeof origin==='function'?origin():origin
 const call=async(path,body,person=owner)=>{
  const response=await fetch(base+path,{method:'POST',headers:{cookie:person.cookie,origin:base,'content-type':'application/json'},body:JSON.stringify(body)})
  assert.equal(response.status,200,await response.clone().text());return response.json()
 }
 const png=await readFile(new URL('../public/icons/nook-192.png',import.meta.url))
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{
  if(destination)await mkdir(destination,{recursive:true})
  for(const width of [1440,390]){
   const context=await browser.newContext({serviceWorkers:'block',viewport:{width,height:width===390?844:1000}})
   try{
    const [name,...value]=member.cookie.split('=');await context.addCookies([{name,value:value.join('='),url:base}])
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message))
    const room=await call('/api/conversations',{name:'Customer rollout documents '+width,kind:'private',participants:[member.user.id]})
    const notes='Thursday rollout\nCustomer success briefing: 09:00\nSupport handoff: 09:30\nLaunch owner: Elena\n'
    const document=await call(`/api/conversations/${room.id}/attachments`,{name:(width===1440?'east':'west')+'-coast-rollout-checklist.txt',mime:'text/plain',data:Buffer.from(notes).toString('base64'),intent:crypto.randomUUID()})
    const root=await call(`/api/conversations/${room.id}/messages`,{body:'Here is the customer rollout checklist. Please review the support handoff before Thursday.',attachments:[document.id],intent:crypto.randomUUID()})
    const image=await call(`/api/conversations/${room.id}/attachments`,{name:(width===1440?'east':'west')+'-coast-launch-icon.png',mime:'image/png',data:png.toString('base64'),intent:crypto.randomUUID()},member)
    const reply=await call(`/api/conversations/${room.id}/messages`,{body:'The Nook icon for the launch briefing is attached.',parent:root.id,attachments:[image.id],intent:crypto.randomUUID()},member)
    await page.goto(base+'/app?view=you');if(destination)await page.screenshot({animations:'disabled',path:resolve(destination,`you-${width}.png`)});await page.locator('.profile-page').getByRole('button',{name:'Files',exact:true}).click()
    const textCard=page.getByRole('article',{name:'File '+document.name,exact:true}),imageCard=page.getByRole('article',{name:'File '+image.name,exact:true})
    await expect(textCard).toBeVisible();await expect(imageCard.getByRole('img',{name:image.name,exact:true})).toBeVisible()
    await page.getByLabel('Conversation',{exact:true}).selectOption(room.id)
    await expect(textCard).toBeVisible();await expect(imageCard).toBeVisible()
    if(destination)await page.screenshot({animations:'disabled',path:resolve(destination,`files-${width}.png`)})
    await page.getByLabel('File type',{exact:true}).selectOption('text')
    await expect(textCard).toBeVisible();await expect(imageCard).toHaveCount(0)
    if(destination)await page.screenshot({animations:'disabled',path:resolve(destination,`text-${width}.png`)})
    const downloaded=page.waitForEvent('download');await textCard.getByRole('link',{name:document.name,exact:true}).click()
    const download=await downloaded;assert.equal(download.suggestedFilename(),document.name)
    const chunks=[];for await(const chunk of await download.createReadStream())chunks.push(chunk)
    assert.equal(Buffer.concat(chunks).toString(),notes)
    await page.getByLabel('File type',{exact:true}).selectOption('')
    await page.getByLabel('Person',{exact:true}).selectOption('me')
    await expect(imageCard).toBeVisible();await expect(textCard).toHaveCount(0)
    if(destination)await page.screenshot({animations:'disabled',path:resolve(destination,`mine-${width}.png`)})
    await imageCard.getByRole('button',{name:'Open in conversation',exact:true}).click()
    await expect(page).toHaveURL(new RegExp('conversation='+room.id));await expect(page).toHaveURL(new RegExp('thread='+root.id))
    await expect(page.getByText(reply.body,{exact:true})).toBeVisible()
    if(destination)await page.screenshot({animations:'disabled',path:resolve(destination,`message-context-${width}.png`)})
    await page.getByRole('navigation',{name:'Conversation content',exact:true}).getByRole('button',{name:'Files',exact:true}).click()
    await expect(textCard).toBeVisible();await expect(imageCard).toBeVisible()
    await expect(page.getByLabel('Conversation',{exact:true})).toHaveCount(0)
    if(destination)await page.screenshot({animations:'disabled',path:resolve(destination,`conversation-${width}.png`)})
    const viewport=await page.evaluate(()=>({width:innerWidth,content:document.documentElement.scrollWidth}))
    assert.ok(viewport.content<=viewport.width+1,'Files view should fit the viewport')
    await call(`/api/conversations/${room.id}/members`,{user:member.user.id,remove:true})
    await page.reload();await expect(textCard).toHaveCount(0);await expect(imageCard).toHaveCount(0);await expect(page.getByRole('navigation',{name:'Conversation content',exact:true})).toHaveCount(0)
    if(destination)await page.screenshot({animations:'disabled',path:resolve(destination,`unavailable-${width}.png`)})
    await page.goto(base+'/app?view=files');await expect(page.getByLabel('File type',{exact:true})).toBeVisible()
    await expect(textCard).toHaveCount(0);await expect(imageCard).toHaveCount(0)
    if(destination)await page.screenshot({animations:'disabled',path:resolve(destination,`revoked-${width}.png`)})
    assert.deepEqual(errors,[])
   }finally{await context.close()}
  }
 }finally{await browser.close()}
}
