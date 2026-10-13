import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {nativeRuntime,run} from './native.mjs';
import {keyed} from '../dev-key.mjs';
import {managementEdge} from './management-edge.mjs';
import {issuerKeys,claimSettings} from './claim.mjs';

async function until(check,label,timeout=10000) {const end=Date.now()+timeout;while(Date.now()<end){if(await check())return;await new Promise(ok=>setTimeout(ok,100))}throw Error(label)}
async function browserOwner(page,origin) {
 await page.goto(origin+'/signin');await page.locator('#auth-email').fill('nativeowner@example.test');
 await page.getByRole('button',{name:'Send sign-in link',exact:true}).click();await page.waitForURL(origin+'/__dev/outbox');
 await page.locator('article').filter({hasText:'nativeowner@example.test'}).first().getByRole('link').first().click();
 await page.getByRole('link',{name:'Open this link',exact:true}).click();
 await page.getByRole('button',{name:'Confirm',exact:true}).click();await page.waitForURL(origin+'/app');
}
export async function editorProof(root,platformRoot,evidence) {
 const edge=await managementEdge(root,platformRoot);let native,browser;
 try {
  const keys=await issuerKeys();
  native=await nativeRuntime(root,{...claimSettings(keys),RER_OWNER_CLAIM_ISSUER:edge.origin,RER_MANAGEMENT_ORIGIN:edge.origin,RER_INSTALLATION_ID:'nook-local'});edge.state.allowed=native.origin;
  edge.state.claimToken=()=>keys.token(native.origin,{iss:edge.origin});
  const {chromium}=createRequire(resolve(root,'package.json'))('@playwright/test');
  browser=await keyed(chromium).launch({headless:true,...(process.env.RER_BROWSER_CHANNEL?{channel:process.env.RER_BROWSER_CHANNEL}:{})});
  const context=await browser.newContext(),page=await context.newPage();
  await context.request.post(edge.origin+'/signin',{data:edge.login});
  await page.goto(edge.origin+'/installation');
  const opened=context.waitForEvent('page');await page.getByRole('button',{name:'Claim installation',exact:true}).click();const popup=await opened;
  await popup.getByRole('button',{name:'Claim your workspace',exact:true}).waitFor();
  for(const width of [1440,390]){await popup.setViewportSize({width,height:900});await until(async()=>await popup.getByRole('button',{name:'Claim your workspace',exact:true}).isEnabled(),'signed opener handshake');if(evidence){await mkdir(evidence,{recursive:true});await popup.screenshot({path:resolve(evidence,`nook-owner-claim-${width}.png`)})}}
  await popup.getByRole('button',{name:'Claim your workspace',exact:true}).click();
  // A new owner confirms first-run setup before the app opens.
  await popup.waitForURL(native.origin+'/setup');await popup.getByRole('checkbox').check();await popup.getByRole('button',{name:'Finish setup',exact:true}).click();await popup.waitForURL(native.origin+'/app');await popup.close();
  assert.equal(native.db.prepare('SELECT completed FROM oc_owner_claims').get().completed,1,'actual confirmation POST committed the signed ledger');
  // Return to an anonymous context before proving the ordinary native sign-in UI.
  await context.clearCookies();
  await page.goto(native.origin+'/');assert.equal(await page.locator('[data-rer-editor]').count(),0);
  assert.equal((await native.request('/api/editor/config')).status,403);assert.equal(edge.state.requests,0);
  await browserOwner(page,native.origin);
  const currentCookie=async()=> (await context.cookies(native.origin)).filter(c=>c.name===`operator_session_local_${new URL(native.origin).port}`).map(c=>c.name+'='+c.value).join(';');
  let cookie=await currentCookie();assert.ok(cookie);
  edge.state.authorize=async()=> (await native.request('/api/editor/session',{cookie})).status===200;
  await context.request.post(edge.origin+'/signin',{data:edge.login});
  for(const width of [1440,390]) {
   await page.setViewportSize({width,height:900});await page.goto(native.origin+'/');
   await page.getByRole('button',{name:'Open Run Edit Run',exact:true}).click();
   await until(async()=>await page.locator('[data-rer-editor]').getAttribute('data-connection')==='connected','actual editor protocol connected');
   const frame=page.frames().find(frame=>frame.url().startsWith(edge.origin+'/editor'));assert.ok(frame);
   await frame.getByRole('textbox',{name:'Draft'}).fill('Keep this draft');
   const refreshed=page.waitForResponse(response=>response.url()===native.origin+'/api/editor/config'&&response.status()===200);
   await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await refreshed;
   await until(async()=>await frame.getByRole('textbox',{name:'Draft'}).inputValue()==='Keep this draft','equivalent refresh preserves iframe draft');
   const box=await frame.locator('section').boundingBox();assert.ok(box&&box.x>=0&&box.x+box.width<=width,'usable editor viewport');
   if(evidence){await mkdir(evidence,{recursive:true});await page.screenshot({path:resolve(evidence,`nook-editor-${width}.png`)})}
  }
  const {invite,signIn}=await import(pathToFileURL(resolve(root,'tests/auth-support.mjs')).href);
  const member=await invite(native.origin,cookie,'EditorMember','editor-member@example.test');
  assert.equal((await native.request('/api/editor/config',{cookie:member.cookie})).status,403,'member denied');
  assert.equal((await native.request('/auth/operator/role',{method:'POST',cookie,body:{operatorId:member.user.id,role:'owner'}})).status,200);
  const otherOwner=await signIn(native.origin,'editor-member@example.test');
  const original=(await (await native.request('/auth/session',{cookie})).json()).operator.id;
  assert.equal((await native.request('/auth/operator/role',{method:'POST',cookie:otherOwner.cookie,body:{operatorId:original,role:'member'}})).status,200);
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await until(async()=>await page.locator('[data-rer-editor]').count()===0,'demotion removes mounted editor');
  assert.equal((await native.request('/api/editor/session',{cookie})).status,403);
  assert.equal((await native.request('/auth/operator/role',{method:'POST',cookie:otherOwner.cookie,body:{operatorId:original,role:'owner'}})).status,200);
  await browserOwner(page,native.origin);cookie=await currentCookie();await page.goto(native.origin+'/');
  await page.getByRole('button',{name:'Open Run Edit Run',exact:true}).waitFor();
  // Move only this test's real native session near expiry; the app must cap its lease.
  const nativeSession=(await(await native.request('/auth/session',{cookie})).json()).id;
  const soon=Date.now()+1800;native.db.prepare('UPDATE oa_sessions SET expires_at=? WHERE id=?').run(soon,nativeSession);
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await until(async()=>await page.locator('[data-rer-editor]').count()===0,'native session expiry tears down mount',6000);
  assert.equal((await native.request('/api/editor/session',{cookie})).status,403);
  await browserOwner(page,native.origin);cookie=await currentCookie();await page.goto(native.origin+'/');
  await page.getByRole('button',{name:'Open Run Edit Run',exact:true}).click();
  await until(async()=>await page.locator('[data-rer-editor]').getAttribute('data-connection')==='connected','reauthenticated editor');
  const session=await native.request('/api/editor/session',{cookie}),key=(await session.json()).ownerKey;
  const config=await native.request('/api/editor/config',{cookie,headers:{'X-Nook-Editor-Owner':key}}),grant=await config.json();assert.equal(config.status,200);assert.match(config.headers.get('cache-control'),/no-store/);
  const expires=native.db.prepare('SELECT expires_at FROM oa_sessions WHERE revoked_at IS NULL ORDER BY created_at DESC LIMIT 1').get().expires_at;
  assert.ok(grant.expiresAt<=expires&&grant.expiresAt<=Date.now()+60000);
  assert.equal((await native.request('/api/editor/config',{cookie,headers:{'X-Nook-Editor-Owner':'wrong'}})).status,403);
  assert.equal((await native.request('/api/editor/config',{cookie,headers:{'X-Nook-Editor-Owner':key,Origin:edge.origin}})).status,403,'foreign origin cannot obtain grant');
  assert.equal((await native.request('/api/editor/session',{cookie,headers:{'Sec-Fetch-Site':'cross-site'}})).status,403,'cross-site owner read refused');
  assert.equal((await context.request.post(edge.origin+'/edits',{headers:{Origin:native.origin},data:{revision:1,edits:[]}})).status(),403,'management write requires its own origin');
  assert.equal(edge.state.saved,0,'foreign origin did not persist source');
  const frame=page.frames().find(frame=>frame.url().startsWith(edge.origin+'/editor'));
  await frame.getByRole('button',{name:'Save local edit'}).click();await frame.getByText('Source saved',{exact:true}).waitFor();
  await page.getByRole('heading',{name:'Published local source proof',exact:true}).waitFor();assert.equal(edge.state.saved,1);
  const persisted=JSON.parse(await readFile(resolve(root,'src/editor/visual-edits.json'),'utf8'));assert.equal(persisted.edits[0].change.text,'Published local source proof');
  const denied=await context.newPage();await denied.goto(edge.origin+'/unauthorized');
  await new Promise(ok=>setTimeout(ok,350));assert.equal(denied.frames().filter(f=>f.url().startsWith(edge.origin+'/editor')).length,0,'actual browser frame-ancestors refusal');await denied.close();
  await page.goto(native.origin+'/app');assert.equal(await page.locator('[data-rer-editor]').count(),0);
  await page.goto(native.origin+'/signin');await page.goto(native.origin+'/');await page.getByRole('button',{name:'Open Run Edit Run',exact:true}).waitFor();
  assert.equal((await native.request('/auth/signout',{method:'POST',body:{},cookie})).status,204);
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await until(async()=>await page.locator('[data-rer-editor]').count()===0,'logout revokes owner mount');
  assert.equal((await native.request('/api/editor/config',{cookie,headers:{'X-Nook-Editor-Owner':key}})).status,403);
  assert.equal((await context.request.post(edge.origin+'/edits',{headers:{Origin:edge.origin},data:{revision:2,edits:[]}})).status(),403,'source write refused after native logout');
  // Compile the exact persisted source through the real application build.
  await native.stop();await run(root,['scripts/rer.mjs','build','--non-interactive']);await native.start();
  const anonymous=await browser.newContext(),publicPage=await anonymous.newPage();await publicPage.goto(native.origin+'/');
  await publicPage.getByRole('heading',{name:'Published local source proof',exact:true}).waitFor();assert.equal(await publicPage.locator('[data-rer-editor]').count(),0);
  await publicPage.reload();await publicPage.getByRole('heading',{name:'Published local source proof',exact:true}).waitFor();
  await anonymous.close();await context.close();
  console.log('PASS actual 1440/390 homepage editor, native form sign-in, scoped config, refresh/draft, role loss/session expiry, HTTP frame refusal, real platform compiler/source persistence, rebuilt anonymous publication, logout/write denial');
 }finally{
  const closed=await Promise.allSettled([browser?.close(),native?.close(),edge.close()]);
  const failure=closed.find(result=>result.status==='rejected');if(failure)throw failure.reason;
 }
}
