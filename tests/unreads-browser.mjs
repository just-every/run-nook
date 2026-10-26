import {invite} from './auth-support.mjs'
import {chromium,expect} from '@playwright/test'
import {mkdir} from 'node:fs/promises'
import {resolve} from 'node:path'
import assert from 'node:assert/strict'
export async function unreadsBrowser({origin,owner,member,outsider,destination='evidence/unreads'}){
 const call=async(path,body,person=owner)=>{const r=await fetch(origin+path,{method:'POST',headers:{cookie:person.cookie,origin,'content-type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,200,await r.clone().text());return r.json()}
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{await mkdir(destination,{recursive:true});for(const width of [1440,390]){
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width,height:width===390?844:1000}})
  try{
   const [name,...value]=owner.cookie.split('=');await context.addCookies([{name,value:value.join('='),url:origin}]);const page=await context.newPage();page.on('pageerror',e=>console.error('BROWSER ERROR',e.message));page.on('console',m=>{if(m.type()==='error')console.error('BROWSER CONSOLE',m.text().slice(0,300))})
   const room=await call('/api/conversations',{name:'Customer launch · '+width,kind:'private',participants:[member.user.id]})
   await call(`/api/conversations/${room.id}/messages`,{body:'The launch checklist is ready. Customer success has confirmed the Thursday rollout and the support briefing.',intent:crypto.randomUUID()},member)
   await page.goto(origin+'/app?view=unreads');await expect(page.getByRole('heading',{name:'All unreads',exact:true})).toBeVisible()
   const card=page.getByRole('article',{name:'Unread in Customer launch · '+width});await expect(card.getByText(/The launch checklist is ready/)).toBeVisible()
   await page.screenshot({animations:'disabled',path:resolve(destination,`list-${width}.png`)})
   await card.getByRole('button',{name:'Mark conversation read'}).click();await expect(page.getByRole('button',{name:'Undo mark read'})).toBeVisible();await expect(card).toHaveCount(0)
   await page.getByRole('button',{name:'Undo mark read'}).click();await expect(card).toBeVisible()
   await page.getByRole('button',{name:'Mark all read',exact:true}).click();await expect(page.getByRole('heading',{name:'You’re all caught up'})).toBeVisible();await page.screenshot({animations:'disabled',path:resolve(destination,`caught-up-${width}.png`)})
   await page.getByRole('button',{name:'Undo mark read'}).click();await expect(card).toBeVisible()
   await page.goto(origin+'/app?view=you');await expect(page.getByRole('checkbox',{name:'Show All unreads in the sidebar'})).toBeChecked();await page.getByRole('checkbox',{name:'Show All unreads in the sidebar'}).uncheck();await page.screenshot({animations:'disabled',path:resolve(destination,`profile-${width}.png`)});await page.getByRole('checkbox',{name:'Show All unreads in the sidebar'}).check()
   await page.keyboard.press('Control+Shift+A');await expect(page.getByRole('heading',{name:'All unreads',exact:true})).toBeVisible()
   await page.keyboard.press('Control+/');await expect(page.getByRole('heading',{name:'Keyboard shortcuts',exact:true})).toBeVisible();await page.screenshot({animations:'disabled',path:resolve(destination,`shortcuts-${width}.png`)});await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click()
   await call('/api/unreads',{action:'read',conversation:room.id})
   const root=await call(`/api/conversations/${room.id}/messages`,{body:'Please review the workshop handover.',intent:crypto.randomUUID()})
   const reply=await call(`/api/conversations/${room.id}/messages`,{body:'The workshop sketches are ready.',parent:root.id,intent:crypto.randomUUID()},member)
   await page.goto(origin+'/app?conversation='+room.id);await page.locator('.nook-app[data-live-connected="true"]').waitFor()
   const composer=page.getByLabel('Message '+room.name,{exact:true});await expect(composer).toBeVisible()
   assert.equal(new URL(page.url()).searchParams.has('thread'),false,'opening a channel keeps unread replies in their threads')
   assert.equal(new URL(page.url()).searchParams.has('focus'),false)
   const update='The workshop room is confirmed.';await composer.fill(update)
   await page.getByRole('button',{name:'Send',exact:true}).click();await expect(page.locator('.chat .message-body').filter({hasText:update})).toBeVisible()
   const saved=await context.request.get(origin+`/api/conversations/${room.id}/messages`);assert.equal(saved.status(),200);assert.ok((await saved.json()).some(m=>m.body===update&&!m.parent))
   const unread=await context.request.get(origin+'/api/unreads?conversation='+room.id);assert.equal(unread.status(),200);assert.deepEqual((await unread.json()).items.map(m=>m.id),[reply.id])
   await page.locator('.chat .message').filter({hasText:root.body}).getByRole('button',{name:'1 reply',exact:true}).click()
   await expect(page.getByRole('heading',{name:'Thread',exact:true})).toBeVisible();await expect(page.getByLabel('Reply in thread',{exact:true})).toBeVisible()
   await page.goto(`${origin}/app?conversation=${room.id}&thread=${root.id}&focus=${reply.id}`)
   await expect(page.getByRole('heading',{name:'Thread',exact:true})).toBeVisible();await expect(page.locator('.thread-log').getByText(reply.body,{exact:true})).toBeVisible()
   const former=await invite(origin,owner.cookie,'Elena Martinez · Customer success','former-'+width+'-'+Date.now()+'@example.test')
   const dm=await call('/api/conversations',{name:'Autumn planning '+width,kind:'dm',participants:[owner.user.id,member.user.id]},former)
   await call(`/api/conversations/${dm.id}/messages`,{body:'Please keep the launch discussion together when this becomes a private channel.',intent:crypto.randomUUID()},member)
   await call('/auth/operator/status',{operatorId:former.user.id,status:'inactive'})
   await page.goto(origin+'/app?conversation='+dm.id);await page.getByRole('button',{name:'Details',exact:true}).click()
   await page.getByLabel('Private channel name').fill('autumn-planning-'+width)
   await page.screenshot({animations:'disabled',path:resolve(destination,`convert-${width}.png`)})
   await page.getByRole('button',{name:'Convert to private channel',exact:true}).click()
   await expect(page.getByRole('heading',{name:'autumn-planning-'+width,exact:true})).toBeVisible();await expect(page.getByText(/Please keep the launch discussion together/)).toBeVisible()
   await page.screenshot({animations:'disabled',path:resolve(destination,`channel-${width}.png`)})
   await page.getByRole('button',{name:'Details',exact:true}).click()
   await expect(page.getByRole('heading',{name:'Original group participants',exact:true})).toBeVisible()
   await expect(page.getByRole('dialog').getByText(former.user.name,{exact:true})).toBeVisible()
   await expect(page.getByRole('dialog').getByText('Inactive',{exact:true})).toBeVisible()
   await page.getByLabel('Channel name',{exact:true}).waitFor({state:'attached'})
   await page.getByRole('heading',{name:'Original group participants',exact:true}).scrollIntoViewIfNeeded()
   await page.screenshot({animations:'disabled',path:resolve(destination,`roster-${width}.png`)})
   await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click()
   await page.goto(origin+'/app?conversation='+dm.id);await expect(page.getByRole('button',{name:'Open private channel',exact:true})).toBeVisible();await expect(page.getByRole('textbox',{name:/Message /})).toHaveCount(0);await page.screenshot({animations:'disabled',path:resolve(destination,`source-${width}.png`)})
  }finally{await context.close().catch(()=>{})}
 }}finally{await browser.close().catch(()=>{})}
}
