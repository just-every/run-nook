import assert from 'node:assert/strict'
import {chromium,expect} from '@playwright/test'
import {keyed} from './dev-key.mjs'
import {mkdir,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {browserSignIn} from './auth-support.mjs'
export async function runKeyboard(origin,destination){
 if(process.env.TEAM_CHAT_BROWSER_HOLD==='1')throw Error('Browser launch hold is active; no browser was started')
 const browser=await keyed(chromium).launch({headless:true}),context=await browser.newContext({viewport:{width:1440,height:1000}}),other=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),bob=await other.newPage(),checks=[],errors=[]
 for(const p of [page,bob])p.on('pageerror',error=>errors.push(error.message))
 const json=async(p,path,data,method=data?'POST':'GET')=>{const r=await p.request.fetch(origin+'/api/'+path,{method,data});assert.equal(r.status(),200);return r.json()}
 try{
  await page.goto(origin+'/signin');await page.keyboard.press('Tab');await expect(page.getByLabel('Email',{exact:true})).toBeFocused()
  await page.keyboard.press('Tab');await expect(page.getByRole('button',{name:'Email a sign-in link',exact:true})).toBeFocused()
  await page.keyboard.press('Shift+Tab');await expect(page.getByLabel('Email',{exact:true})).toBeFocused();checks.push('anonymous keyboard navigation reaches the email field and sign-in submit')
  const tag=Date.now().toString(36);await browserSignIn(page,origin,tag+'-Alice');await browserSignIn(bob,origin,tag+'-Bob');const member=await json(bob,'me')
  const channel=await json(page,'conversations',{name:'Keyboard room',kind:'private',participants:[member.id]})
  await page.goto(origin+`/app?view=chat&conversation=${channel.id}`);await page.getByLabel('Message Keyboard room',{exact:true}).waitFor()
  await page.keyboard.press('Tab');await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>document.activeElement.id),'primary');checks.push('K1 skip link reaches main')
  await page.keyboard.press('Control+k')
  const switcher=page.getByRole('dialog',{name:'Jump to a conversation',exact:true})
  await expect(switcher.getByRole('combobox')).toBeFocused()
  await page.keyboard.type('kybrd')
  await expect(switcher.getByRole('option',{name:/Keyboard room/})).toBeVisible()
  await switcher.getByRole('combobox').press('Enter')
  await expect(switcher).toHaveCount(0)
  await page.getByRole('button',{name:'Keyboard shortcuts',exact:true}).click()
  const shortcuts=page.getByRole('dialog',{name:'Keyboard shortcuts',exact:true})
  await expect(shortcuts.getByRole('button',{name:/Search this conversation/})).toBeVisible()
  await page.keyboard.press('Escape');await expect(shortcuts).toHaveCount(0)
  checks.push('NOOK-052 fuzzy quick switching and discoverable keyboard controls')
  const composer=page.getByLabel('Message Keyboard room',{exact:true})
  await composer.fill('First line');await composer.press('Shift+Enter');await composer.press('X');assert.equal(await composer.inputValue(),'First line\nX');assert.equal((await json(page,`conversations/${channel.id}/messages`)).length,0)
  await composer.dispatchEvent('keydown',{key:'Enter',code:'Enter',isComposing:true});assert.equal((await json(page,`conversations/${channel.id}/messages`)).length,0)
  await composer.press('Enter');await expect(composer).toHaveValue('');assert.equal((await json(page,`conversations/${channel.id}/messages`)).length,1);checks.push('K2 Enter sends once; Shift+Enter and IME preserve draft')
  for(const body of ['Second own update','Third own update']){await composer.fill(body);await composer.press('Enter');await expect(composer).toHaveValue('')}
  assert.equal((await json(page,'conversations')).find(c=>c.id===channel.id).unread,0,'three own sends never become unread')
  assert.equal((await json(bob,'conversations')).find(c=>c.id===channel.id).unread,3,'the other participant receives three unread messages')
  // The recipient is looking at the conversation, so its page is in front.
  await bob.bringToFront();await bob.goto(origin+`/app?view=chat&conversation=${channel.id}`);await bob.getByText('Third own update',{exact:true}).waitFor()
  await expect.poll(async()=>(await json(bob,'conversations')).find(c=>c.id===channel.id).unread).toBe(0)
  checks.push('three own sends remain read for their author; the recipient sees three unread and viewing clears them')
  await page.getByRole('button',{name:'Open thread',exact:true}).first().click();await page.getByLabel('Reply in thread',{exact:true}).fill('Thread draft');await page.getByRole('button',{name:'Back',exact:true}).click();await expect(page.locator('.message').first()).toBeFocused();await page.goBack();await expect(page.getByLabel('Reply in thread',{exact:true})).toHaveValue('Thread draft');await page.getByRole('button',{name:'Back',exact:true}).click();checks.push('K3 thread Back and browser Back preserve scope and focus')
  await composer.fill('Draft survives updates');await page.locator('.chat .composer-options summary').click();await page.getByLabel('Notify a person',{exact:true}).selectOption(member.id);await page.getByLabel('Priority',{exact:true}).selectOption('urgent');await page.getByLabel('Why is this urgent?',{exact:true}).fill('Review needed today');await page.getByLabel('Why is this urgent?',{exact:true}).focus()
  await json(bob,`conversations/${channel.id}/messages`,{body:'A real remote update',intent:crypto.randomUUID()});await page.getByText('A real remote update',{exact:true}).waitFor();await expect(page.getByLabel('Why is this urgent?',{exact:true})).toBeFocused();await expect(composer).toHaveValue('Draft survives updates');checks.push('K4 stable React DOM retains composing focus during catch-up')
  await page.reload();await expect(composer).toHaveValue('Draft survives updates');await expect(page.getByLabel('Priority',{exact:true})).toHaveValue('urgent');await expect(page.getByLabel('Why is this urgent?',{exact:true})).toHaveValue('Review needed today');checks.push('K5 reload retains text, routing and urgent reason')
  await page.locator('.message-more summary').first().click();await page.getByRole('button',{name:'Edit',exact:true}).first().click();await page.getByRole('dialog').getByLabel('Message',{exact:true}).fill('Not saved');await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByRole('button',{name:'Edit',exact:true}).first()).toBeFocused();assert.equal((await json(page,`conversations/${channel.id}/messages`))[0].body,'First line\nX');checks.push('K6 Escape cancels and restores dialog trigger')
  await page.getByRole('button',{name:'Edit',exact:true}).first().click();await page.getByRole('dialog').getByLabel('Message',{exact:true}).fill('Saved edit');await page.getByRole('button',{name:'Save edit',exact:true}).click();await page.getByText('Saved edit',{exact:true}).waitFor();await expect(page.getByRole('button',{name:'Edit',exact:true}).first()).toBeFocused();checks.push('K7 acknowledged edit restores trigger without replacing message DOM')
  // Background view and unseen thread replies cannot be marked read by loaded history.
  await page.getByRole('navigation',{name:'Workspace',exact:true}).getByRole('button',{name:/^Attention( \d+)?$/}).click()
  const unseen=await json(bob,`conversations/${channel.id}/messages`,{body:'Unseen while reading Attention',intent:crypto.randomUUID()})
  await expect.poll(async()=>(await json(page,'conversations')).find(c=>c.id===channel.id).unread).toBeGreaterThan(0)
  const before=(await json(page,'conversations')).find(c=>c.id===channel.id);assert.ok(before.readSeq<unseen.sequence)
  await page.bringToFront();await page.goto(origin+`/app?view=chat&conversation=${channel.id}`)
  // The reader returns to the place they left (the edit above scrolled to the first message), then reads on to the newest.
  await page.getByText(unseen.body,{exact:true}).scrollIntoViewIfNeeded();await expect.poll(async()=>(await json(page,'conversations')).find(c=>c.id===channel.id).unread).toBe(0)
  checks.push('author-aware unread stays unread outside conversation and clears only visible messages')
  const root=(await json(page,`conversations/${channel.id}/messages`))[0]
  const hiddenReply=await json(bob,`conversations/${channel.id}/messages`,{body:'Reply not yet opened',parent:root.id,intent:crypto.randomUUID()})
  await composer.fill('Own send after an unread reply');await composer.press('Enter');await expect(composer).toHaveValue('')
  const held=(await json(page,'conversations')).find(c=>c.id===channel.id);assert.ok(held.readSeq<hiddenReply.sequence,'own send does not skip unread foreign thread reply');assert.ok(held.unread>0)
  await page.locator(`[data-message="${root.id}"]`).getByRole('button',{name:'Open thread',exact:true}).click();await page.getByText('Reply not yet opened',{exact:true}).waitFor()
  await expect.poll(async()=>(await json(page,'conversations')).find(c=>c.id===channel.id).unread).toBe(0)
  await page.reload();assert.equal((await json(page,'conversations')).find(c=>c.id===channel.id).unread,0)
  checks.push('unseen thread reply bounds read frontier through own send; opening reply and reloading persists the read')

  // Erased roots keep existing replies reachable without allowing another reply.
  await page.getByRole('navigation',{name:'Workspace',exact:true}).getByRole('button',{name:/^Attention( \d+)?$/}).click()
  const erased=await json(bob,`conversations/${channel.id}/messages`,{body:'Private root body to erase',intent:crypto.randomUUID()})
  const survivor=await json(bob,`conversations/${channel.id}/messages`,{body:'Existing reply survives its deleted root',parent:erased.id,intent:crypto.randomUUID()})
  await json(bob,`messages/${erased.id}`,{version:erased.version,delete:true},'PATCH')
  await page.goto(origin+`/app?view=chat&conversation=${channel.id}`)
  const tombstone=page.locator(`.chat [data-message="${erased.id}"]`);await tombstone.scrollIntoViewIfNeeded()
  await expect(tombstone.getByText('Message deleted',{exact:true})).toBeVisible()
  await expect(page.getByText(erased.body,{exact:true})).toHaveCount(0)
  await expect.poll(async()=>(await json(page,'conversations')).find(c=>c.id===channel.id).readSeq).toBeGreaterThanOrEqual(erased.sequence)
  assert.ok((await json(page,'conversations')).find(c=>c.id===channel.id).readSeq<survivor.sequence,'visible tombstone does not read its unopened reply')
  await tombstone.getByRole('button',{name:/\brepl(?:y|ies)$/}).click()
  await expect(page.locator('.thread-log').getByText(survivor.body,{exact:true})).toBeInViewport()
  await expect(page.locator('.thread-log').getByText('Message deleted',{exact:true})).toBeVisible()
  await expect(page.getByLabel('Reply in thread',{exact:true})).toHaveCount(0)
  await expect(page.getByText(erased.body,{exact:true})).toHaveCount(0)
  await expect.poll(async()=>(await json(page,'conversations')).find(c=>c.id===channel.id).unread).toBe(0)
  await page.reload();await expect(page.locator('.thread-log').getByText(survivor.body,{exact:true})).toBeVisible();await expect(page.getByLabel('Reply in thread',{exact:true})).toHaveCount(0)
  await page.getByRole('button',{name:'Back',exact:true}).click();await expect(tombstone).toBeFocused();await expect(page.locator('.thread-log')).toHaveCount(0)
  assert.equal(new URL(page.url()).searchParams.get('focus'),erased.id);assert.equal(new URL(page.url()).searchParams.get('thread'),null)
  await page.goBack();await expect(page.locator('.thread-log').getByText(survivor.body,{exact:true})).toBeVisible();await expect(page.getByLabel('Reply in thread',{exact:true})).toHaveCount(0)
  await page.goForward();await expect(tombstone).toBeFocused();await expect(page.getByText(erased.body,{exact:true})).toHaveCount(0)
  checks.push('visible foreign tombstone advances read safely; deleted-root thread, reload and Back retain replies and focus without erased text or a reply composer')
  // Delay real read acknowledgements at the network edge while changing rooms.
  // Both writes reach the actual server; no application response is fabricated.
  const nextRoom=await json(page,'conversations',{name:'Late acknowledgement room',kind:'private',participants:[member.id]})
  await json(bob,`conversations/${nextRoom.id}/messages`,{body:'First message in the new room',intent:crypto.randomUUID()})
  await page.locator('.sidebar .conversation-link').filter({hasText:'Keyboard room'}).click()
  let releaseOld,releaseNew,oldFrontier,newReadRequests=0,oldReadReady=false,newReadReady=false
  const oldGate=new Promise(resolve=>{releaseOld=resolve}),newGate=new Promise(resolve=>{releaseNew=resolve})
  const readPattern='**/api/conversations/*/read'
  await page.route(readPattern,async route=>{
   const path=new URL(route.request().url()).pathname
   if(path===`/api/conversations/${channel.id}/read`&&oldFrontier===undefined){
    oldFrontier=route.request().postDataJSON().seq;const response=await route.fetch();assert.equal(response.status(),200);oldReadReady=true;await oldGate;await route.fulfill({response})
   }else if(path===`/api/conversations/${nextRoom.id}/read`){
    newReadRequests++;if(newReadRequests===1){const response=await route.fetch();assert.equal(response.status(),200);newReadReady=true;await newGate;await route.fulfill({response})}else await route.continue()
   }else await route.continue()
  })
  try{
   const oldMessage=await json(bob,`conversations/${channel.id}/messages`,{body:'Visible before changing rooms',intent:crypto.randomUUID()})
   await expect(page.getByText(oldMessage.body,{exact:true})).toBeInViewport();await expect.poll(()=>oldReadReady).toBe(true)
   await page.locator('.sidebar .conversation-link').filter({hasText:'Late acknowledgement room'}).click()
   await expect(page.getByText('First message in the new room',{exact:true})).toBeInViewport();await expect.poll(()=>newReadReady).toBe(true)
   const oldDelivered=page.waitForResponse(response=>response.url().endsWith(`/api/conversations/${channel.id}/read`));releaseOld();await oldDelivered
   const second=await json(bob,`conversations/${nextRoom.id}/messages`,{body:'Read after the old acknowledgement',intent:crypto.randomUUID()})
   assert.ok(oldFrontier>second.sequence,'the old acknowledgement carries a higher, unrelated cursor')
   await expect(page.getByText(second.body,{exact:true})).toBeInViewport()
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
   assert.equal(newReadRequests,1,'the old acknowledgement cannot clear the new room’s in-flight read')
   assert.equal((await json(page,'conversations')).find(c=>c.id===nextRoom.id).unread,1)
   releaseNew()
   await expect.poll(async()=>(await json(page,'conversations')).find(c=>c.id===nextRoom.id).unread).toBe(0)
   assert.ok((await json(page,'conversations')).find(c=>c.id===channel.id).readSeq>=oldMessage.sequence,'the completed old read remains valid on the server')
   checks.push('delayed old-room read acknowledgement cannot change the new room cursor or in-flight request; visible new messages still become read')
  }finally{releaseOld();releaseNew();await page.unrouteAll({behavior:'wait'})}
  assert.deepEqual(errors,[],'keyboard journeys have no browser or hydration errors')
  await mkdir(destination,{recursive:true});await writeFile(resolve(destination,'keyboard-results.json'),JSON.stringify({status:'passed',checks},null,2)+'\n');return {checks}
 }finally{await browser.close()}
}
