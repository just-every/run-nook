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

export async function forwardBrowser({app,owner,member,outsider,publicSource,destination,privateRoom,dm,secret,evidence}){
 const {origin,call}=app,browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});await mkdir(evidence,{recursive:true});
 try{for(const width of [1440,390]){const contexts=[];try{
  const pages=[];for(const person of [owner,outsider]){const context=await browser.newContext({serviceWorkers:'block',viewport:{width,height:width===390?844:1000}});contexts.push(context);const at=person.cookie.indexOf('=');await context.addCookies([{name:person.cookie.slice(0,at),value:person.cookie.slice(at+1),url:origin}]);pages.push(await context.newPage())}const [page,reader]=pages,errors=[];let refusalExpected=false;for(const p of pages){p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!(p===reader&&refusalExpected&&/status of 404/.test(m.text())))errors.push(m.text())})}
  const shot=(p,name)=>p.screenshot({animations:'disabled',path:resolve(evidence,`${name}-${width}.png`)}),open=async(source,room)=>{await page.goto(origin+'/app?conversation='+room.id+'&focus='+source.id);const row=page.locator('[data-message="'+source.id+'"]').first();await row.click();await row.getByLabel('More actions for message by '+source.authorName,{exact:true}).click();await row.getByRole('button',{name:'Forward',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Forward message',exact:true});await expect(dialog).toBeVisible();return dialog},choose=async(dialog,target,mode,note)=>{await dialog.getByRole('checkbox',{name:(target.kind==='dm'?'Direct message: ':'#')+target.name,exact:true}).check();await dialog.getByLabel('Forward as',{exact:true}).selectOption(mode);await dialog.getByLabel('Optional note',{exact:true}).fill(note);await dialog.getByRole('button',{name:'Review forward',exact:true}).click();await expect(dialog.getByRole('region',{name:'Disclosure preview'})).toBeVisible()},submit=async dialog=>{const result=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/forwards'&&r.request().method()==='POST');await dialog.getByRole('button',{name:'Forward message',exact:true}).click();const response=await result;assert.equal(response.status(),200);const copy=(await response.json()).messages[0];await expect(dialog).toHaveCount(0);return copy};
  const source=await call('/api/conversations/'+publicSource.id+'/messages','POST',{body:'Release readiness '+width+': review the support checklist before Thursday.',intent:crypto.randomUUID()},owner.cookie);let dialog=await open(source,publicSource);await choose(dialog,dm,'show','Please review this before our launch handoff.');await shot(page,'dialog');const publicCopy=await submit(dialog);await page.goto(origin+'/app?conversation='+dm.id+'&focus='+publicCopy.id);const row=page.locator('[data-message="'+publicCopy.id+'"]').first();await expect(row).toContainText(source.authorName);await expect(row).toContainText(publicSource.name);await expect(row).toContainText('Please review this');await shot(page,'forwarded-copy');
  dialog=await open(secret,privateRoom);await choose(dialog,destination,'link','Finance context · '+width);await expect(dialog.getByRole('region',{name:'Disclosure preview'}).locator('blockquote')).toHaveCount(0);const link=await submit(dialog);await reader.goto(origin+'/app?conversation='+destination.id+'&focus='+link.id);const linked=reader.locator('[data-message="'+link.id+'"]').first();await expect(linked).toContainText('Link only');await expect(linked).not.toContainText(secret.body);await expect(linked).not.toContainText('finance-review.txt');refusalExpected=true;const refused=reader.waitForResponse(r=>new URL(r.url()).pathname==='/api/forwards/'+link.id+'/source');await linked.getByRole('link',{name:'Open source',exact:true}).click();assert.equal((await refused).status(),404);await expect(linked.getByRole('alert')).toContainText('Message unavailable');await shot(reader,'link-only-refused');
  dialog=await open(secret,privateRoom);await choose(dialog,destination,'show','Explicit disclosure for the planning discussion.');await expect(dialog.getByRole('region',{name:'Disclosure preview'})).toContainText('Theo');await expect(dialog.getByRole('region',{name:'Disclosure preview'})).toContainText(secret.body);await shot(page,'disclosure-preview');await page.addScriptTag({path:resolve('node_modules/axe-core/axe.min.js')});assert.deepEqual(await page.evaluate(async()=> (await axe.run(document)).violations.filter(v=>['serious','critical'].includes(v.impact))),[]);const shown=await submit(dialog);await reader.goto(origin+'/app?conversation='+destination.id+'&focus='+shown.id);const shownRow=reader.locator('[data-message="'+shown.id+'"]').first();await expect(shownRow).toContainText(secret.body);await expect(shownRow).toContainText('finance-review.txt');await expect(shownRow).not.toContainText(privateRoom.name);await shot(reader,'shown-copy');
  await page.goto(origin+'/app?view=team');const policy=page.getByRole('region',{name:'Forwarding policy',exact:true});await policy.getByLabel('Allowed forwarding',{exact:true}).selectOption('link-only');await policy.getByRole('button',{name:'Save forwarding policy',exact:true}).click();await expect(policy).toContainText('Forwarding policy saved');dialog=await open(secret,privateRoom);await expect(dialog.locator('option[value="show"]')).toHaveJSProperty('disabled',true);await expect(dialog).toContainText('Owner policy allows Link only');await shot(page,'link-only-policy');await dialog.getByRole('button',{name:'Close',exact:true}).click();const current=await call('/api/forwards/policy','GET',undefined,owner.cookie);await call('/api/forwards/policy','POST',{mode:'allow',version:current.version},owner.cookie);
  await call('/api/messages/'+source.id,'PATCH',{delete:true,version:source.version},owner.cookie);await page.goto(origin+'/app?conversation='+dm.id);await expect(page.locator('[data-message="'+publicCopy.id+'"]').first()).toContainText('Message deleted');await expect(page.locator('[data-message="'+publicCopy.id+'"]').first()).not.toContainText(source.body);await shot(page,'tombstoned-copy');for(const p of pages)assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
 }finally{for(const context of contexts)await context.close()}}}finally{await browser.close()}
}
