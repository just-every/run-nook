import {chromium,expect} from '@playwright/test'
import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {resolve} from 'node:path'
// NOOK-079 owner screen: create shows the token once, rotate replaces it, revoke ends it.
export async function integrationTokensBrowser({origin,owner,alerts,destination='evidence/integration-tokens'}){
 const cookie=()=>{const at=owner.cookie.indexOf('=');return {name:owner.cookie.slice(0,at),value:owner.cookie.slice(at+1),url:origin}}
 const postWith=(secret,key,body)=>fetch(origin+`/api/conversations/${alerts.id}/messages`,{method:'POST',headers:{authorization:'Bearer '+secret,'idempotency-key':key,'content-type':'application/json'},body:JSON.stringify({body})})
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{await mkdir(destination,{recursive:true});for(const width of [1440,390]){
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width,height:width===390?844:1000}})
  try{
   await context.addCookies([cookie()]);const page=await context.newPage(),name='Uptime alerts '+width
   const shot=step=>page.screenshot({animations:'disabled',fullPage:true,path:resolve(destination,`${step}-${width}.png`)})
   await page.goto(origin+'/app?view=team')
   const section=page.getByRole('region',{name:'Integration tokens'})
   await expect(section.getByRole('heading',{name:'Integration tokens',exact:true})).toBeVisible()
   await section.getByLabel('Integration name',{exact:true}).fill(name)
   await section.getByRole('checkbox',{name:'#ops-alerts',exact:true}).check()
   await section.getByRole('button',{name:'Create token',exact:true}).click()
   const shown=section.getByRole('region',{name:'New token'})
   await expect(shown).toContainText('shown this once')
   const secret=(await shown.locator('code').textContent()).trim();assert.match(secret,/^nookit_/)
   await shot('created')
   const posted=await postWith(secret,'uptime-'+width,`Uptime check ${width}: all green.`);assert.equal(posted.status,200)
   await shown.getByRole('button',{name:'Done',exact:true}).click();await expect(shown).toHaveCount(0)
   await page.reload()
   await expect(section.getByRole('article',{name})).toContainText('last used')
   await expect(section.getByRole('row').filter({hasText:name}).filter({hasText:'Posted'})).toHaveCount(1)
   await expect(section.locator('code')).toHaveCount(0)
   await section.getByRole('button',{name:'Rotate '+name,exact:true}).click()
   await expect(shown).toContainText(name)
   const replacement=(await shown.locator('code').textContent()).trim();assert.notEqual(replacement,secret)
   assert.equal((await postWith(secret,'uptime-old-'+width,'Old token')).status,401,'the rotated-out token stops at once')
   await shown.getByRole('button',{name:'Done',exact:true}).click()
   await section.getByRole('button',{name:'Revoke '+name,exact:true}).click()
   await section.getByRole('button',{name:'Confirm revoke '+name,exact:true}).click()
   await expect(section.getByRole('article',{name})).toContainText('Revoked')
   assert.equal((await postWith(replacement,'uptime-revoked-'+width,'Revoked token')).status,401)
   await expect(section.getByRole('row').filter({hasText:name}).filter({hasText:'Refused (integration_token_rotated)'})).toHaveCount(1)
   await shot('revoked')
   await page.goto(origin+'/app?conversation='+alerts.id)
   await expect(page.locator('.message').filter({hasText:`Uptime check ${width}: all green.`}).getByText('via '+name,{exact:true})).toBeVisible()
   await shot('posted')
  }finally{await context.close()}
 }}finally{await browser.close()}
}

export async function notificationAppsBrowser({origin,owner,room,destination}){
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
 try{await mkdir(destination,{recursive:true});for(const width of [1440,390]){const context=await browser.newContext({serviceWorkers:'block',viewport:{width,height:width===390?844:1000}});try{
  const at=owner.cookie.indexOf('=');await context.addCookies([{name:owner.cookie.slice(0,at),value:owner.cookie.slice(at+1),url:origin}]);const page=await context.newPage(),name='Slate release updates '+width;
  await page.goto(origin+'/app?view=team');const section=page.getByRole('region',{name:'Notification apps',exact:true});await expect(section).toBeVisible();await section.getByLabel('App name',{exact:true}).fill(name);await section.getByRole('checkbox',{name:'#'+room.name,exact:true}).check();await section.getByRole('button',{name:'Approve app',exact:true}).click();
  const shown=section.getByRole('region',{name:'New app tokens'});await expect(shown).toBeVisible();const token=(await shown.locator('code').textContent()).trim();assert.ok(token.startsWith('nookapp_'));
  // Proof images never contain even a synthetic credential.
  await page.screenshot({path:resolve(destination,`approval-${width}.png`),fullPage:true,mask:[shown.locator('code')],animations:'disabled'});
  const body='Release 4.2: customer handoff is ready for review. <script>alert(1)</script>';const response=await fetch(origin+`/api/notification-destinations/${room.id}/messages`,{method:'POST',headers:{authorization:'Bearer '+token,'idempotency-key':'browser-'+width,'content-type':'application/json'},body:JSON.stringify({body})});assert.equal(response.status,200);
  await shown.getByRole('button',{name:'I have saved the tokens'}).click();await page.reload();await expect(section.locator('code')).toHaveCount(0);
  await page.goto(origin+'/app?conversation='+room.id);const row=page.locator('.message').filter({hasText:body}).filter({hasText:name});await expect(row.getByText(name,{exact:true})).toBeVisible();await expect(row.getByText('App',{exact:true})).toBeVisible();assert.equal(await row.locator('script').count(),0);await page.getByPlaceholder('Message '+room.name+'…',{exact:true}).focus();await page.mouse.move(0,0);await page.screenshot({path:resolve(destination,`posted-${width}.png`),fullPage:true,animations:'disabled'});
  await page.goto(origin+'/app?view=team');await section.getByRole('button',{name:`Revoke ${name} in ${room.name}`,exact:true}).click();await expect(section.getByRole('article',{name:name+' in '+room.name,exact:true})).toContainText('Revoked');await page.screenshot({path:resolve(destination,`revoked-${width}.png`),fullPage:true,animations:'disabled'});
 }finally{await context.close()}}}finally{await browser.close()}
}
