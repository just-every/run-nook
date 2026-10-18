import assert from 'node:assert/strict'
import {chromium,expect} from '@playwright/test'
import {mkdir,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {quickSwitcherGaps} from './quick-switcher.mjs'

export async function keyboardGaps({origin,owner,member,destination='evidence/keyboard-gaps'}){
 const call=async(person,path,body,method=body?'POST':'GET')=>{
  const response=await fetch(origin+'/api/'+path,{method,headers:{cookie:person.cookie,origin,'content-type':'application/json'},body:body?JSON.stringify(body):undefined})
  assert.equal(response.status,200,'public door '+path);return response.json()
 }
 const send=(person,room,body,parent=null)=>call(person,`conversations/${room}/messages`,{body,parent,intent:crypto.randomUUID()})
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']}),checks=[],errors=[]
 try{
  await mkdir(destination,{recursive:true})
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1440,height:1000}})
  const [name,...value]=member.cookie.split('=');await context.addCookies([{name,value:value.join('='),url:origin}])
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message))
  const room=await call(owner,'conversations',{name:'Customer success handoff',kind:'private',participants:[member.user.id]})
  assert.equal(await call(member,`conversations/${room.id}/messages/latest-editable`),null)
  const own=await send(member,room.id,'Please send the revised onboarding plan before Thursday’s customer call.')
  let latest
  for(let i=0;i<53;i++)latest=await send(owner,room.id,'Handoff update '+(i+1)+': Customer success has confirmed the support coverage.')
  assert.equal((await call(member,`conversations/${room.id}/messages/window`)).items.some(m=>m.id===own.id),false)
  await page.goto(origin+`/app?view=chat&conversation=${room.id}&focus=${latest.id}`)
  const composer=page.getByLabel('Message '+room.name,{exact:true}),editor=page.getByRole('dialog',{name:'Edit message',exact:true})
  await expect(composer).toBeVisible();await expect(page.locator(`.chat [data-message="${own.id}"]`)).toHaveCount(0)
  let lookups=0;page.on('request',r=>{if(r.url().includes('/messages/latest-editable'))lookups++})
  await composer.fill('Unsent draft');await composer.press('ArrowUp');await expect(composer).toHaveValue('Unsent draft');await expect(editor).toHaveCount(0)
  await composer.fill('');await composer.dispatchEvent('keydown',{key:'ArrowUp',isComposing:true})
  for(const modifier of ['shiftKey','ctrlKey','metaKey'])await composer.dispatchEvent('keydown',{key:'ArrowUp',[modifier]:true})
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));assert.equal(lookups,0,'draft, modifiers and IME do not request an edit')
  await composer.press('ArrowUp');await expect(editor.getByLabel('Message',{exact:true})).toHaveValue(own.body)
  await editor.getByLabel('Message',{exact:true}).fill('Updated plan: customer success owns the Thursday onboarding call.');await editor.getByRole('button',{name:'Save edit',exact:true}).click();await expect(editor).toHaveCount(0)
  assert.equal((await call(member,'messages/'+own.id)).body,'Updated plan: customer success owns the Thursday onboarding call.')
  await expect(composer).toBeFocused()
  checks.push('empty-composer Up edits the authoritative own root outside the loaded window; draft, modifier and IME guards; save restores composer focus')
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:width===390?844:1000})
   await composer.press('ArrowUp');await expect(editor.getByLabel('Message',{exact:true})).toHaveValue('Updated plan: customer success owns the Thursday onboarding call.')
   await page.screenshot({animations:'disabled',path:resolve(destination,`last-root-${width}.png`)})
   await page.keyboard.press('Escape');await expect(composer).toBeFocused()
   await page.screenshot({animations:'disabled',path:resolve(destination,`composer-${width}.png`)})
  }
  const root=await send(owner,room.id,'Can everyone confirm the customer onboarding handoff?'),reply=await send(member,room.id,'I can cover the customer briefing at 10 am Eastern.',root.id)
  for(let i=0;i<53;i++)latest=await send(owner,room.id,'Checklist update '+(i+1)+': The onboarding notes are ready for review.',root.id)
  assert.equal((await call(member,`conversations/${room.id}/messages/window?thread=${root.id}`)).items.some(m=>m.id===reply.id),false)
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:width===390?844:1000})
   await page.goto(origin+`/app?view=chat&conversation=${room.id}&thread=${root.id}&focus=${latest.id}`)
   const threadComposer=page.getByLabel('Reply in thread',{exact:true});await expect(threadComposer).toBeVisible()
   await threadComposer.press('ArrowUp');await expect(editor.getByLabel('Message',{exact:true})).toHaveValue(reply.body)
   await page.screenshot({animations:'disabled',path:resolve(destination,`last-reply-${width}.png`)})
   await page.keyboard.press('Escape');await expect(threadComposer).toBeFocused()
   await page.locator('.decisions .composer').getByRole('button',{name:'Edit last message',exact:true}).click();await expect(editor.getByLabel('Message',{exact:true})).toHaveValue(reply.body)
   await page.keyboard.press('Escape')
  }
  checks.push('thread Up and visible edit button select only that thread’s latest own reply at 1440/390, independent of the loaded window')
  await page.setViewportSize({width:1440,height:1000})
  await page.goto(origin+'/app?view=threads')
  const card=page.getByRole('article',{name:'Thread in '+room.name}).filter({hasText:root.body})
  await card.getByRole('button',{name:'Reply in thread',exact:true}).click()
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:width===390?844:1000})
   const inline=card.getByLabel('Reply in thread',{exact:true})
   await inline.scrollIntoViewIfNeeded();await expect(inline).toBeInViewport()
   await inline.press('ArrowUp');await expect(editor.getByLabel('Message',{exact:true})).toHaveValue(reply.body)
   await page.screenshot({animations:'disabled',path:resolve(destination,`inline-edit-${width}.png`)})
   await page.keyboard.press('Escape');await expect(inline).toBeFocused();await expect(inline).toBeInViewport()
   await page.screenshot({animations:'disabled',path:resolve(destination,`inline-composer-${width}.png`)})
   await page.keyboard.press('Control+/')
   const help=page.getByRole('dialog',{name:'Keyboard shortcuts',exact:true})
   await help.getByText('in an empty composer edits your last message in that conversation or thread.',{exact:false}).scrollIntoViewIfNeeded()
   await page.screenshot({animations:'disabled',path:resolve(destination,`help-${width}.png`)})
   await page.keyboard.press('Escape')
  }
  checks.push('inline Threads composer opens the existing message edit dialog')
  await quickSwitcherGaps({origin,page,owner,member,call,send,destination,checks})
  const denied=await call(owner,'conversations',{name:'Private management review',kind:'private'})
  const checkStatus=async(path,person,status)=>{
   const response=await fetch(origin+'/api/'+path,{headers:{origin,...(person?{cookie:person.cookie}:{})}})
   assert.equal(response.status,status)
  }
  await checkStatus(`conversations/${denied.id}/messages/latest-editable`,member,403)
  await checkStatus(`conversations/${room.id}/messages/latest-editable`,null,401)
  const details=await call(owner,`channels/${room.id}/details`)
  await call(owner,`channels/${room.id}/posting`,{version:details.version,level:'admins',replies:'same',people:[]},'PATCH')
  assert.equal(await call(member,`conversations/${room.id}/messages/latest-editable`),null)
  assert.equal(await call(member,`conversations/${room.id}/messages/latest-editable?thread=${root.id}`),null)
  checks.push('latest-edit door requires current identity, conversation membership and current root/thread posting permission')
  assert.deepEqual(errors,[],'focused keyboard journeys have no browser errors')
  await writeFile(resolve(destination,'keyboard-gaps.json'),JSON.stringify({status:'passed',checks},null,2)+'\n')
  return {checks}
 }finally{await browser.close().catch(()=>{})}
}
