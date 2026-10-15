import {test} from 'node:test';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import assert from 'node:assert/strict';
import {mkdir,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {installation,until} from './push/fixture.mjs';

// Build the production Worker, then use actual D1 migrations, public auth
// and notification routes, and real ChatHub alarms. Only the relay edge is fake.
test('Managed Worker sends sign-in/invites, refuses redirects, retries 429 and explains 401',{timeout:120_000},async t=>{
 execFileSync('pnpm',['build:app'],{stdio:'pipe'});
 const origin='https://maple-house.example.test',relay='https://rer.example.test/api/managed-mail/send';
 const bindings={AUTH_ORIGIN:origin,AUTH_LOCAL:'false',OWNER_EMAIL:'sam@example.test',SESSION_SECRET:crypto.randomUUID()+crypto.randomUUID(),SETUP_TOKEN:crypto.randomUUID()+crypto.randomUUID(),MAIL_PROVIDER:'rer',MAIL_FROM:'nook@example.test',MAIL_RELAY_URL:relay,MAIL_API_KEY:'synthetic-managed-mail-credential'};
 const messages=[];let status=202,edgeError,browser,uiServer;
 // Guard the actual fetch init inside workerd. Miniflare's Node network bridge
 // reconstructs Request.redirect as "follow", so inspecting it there is invalid.
 const modules=[{type:'ESModule',path:resolve('dist/server/mail-edge-guard.js'),contents:`import worker from './index.js';export * from './index.js';const transport=globalThis.fetch;globalThis.fetch=(url,init)=>{if(String(url)==='https://rer.example.test/api/managed-mail/send'&&init?.redirect!=='manual')throw Error('Mail fetch must use manual redirects');return transport(url,init)};export default worker;`},
  {type:'ESModule',path:resolve('dist/server/index.js')},...(await readdir('dist/server/assets')).filter(name=>name.endsWith('.js')).map(name=>({type:'ESModule',path:resolve('dist/server/assets',name)}))];
 const app=await installation(async request=>{
  try{
   assert.equal(request.url,relay,'no request follows the relay redirect');
   assert.equal(request.method,'POST');
   const wire=await request.text();
   assert.deepEqual(Object.fromEntries(request.headers),{authorization:'Bearer '+bindings.MAIL_API_KEY,'content-type':'application/json',host:new URL(relay).host,'cf-worker':'nook-push-test.example.com','content-length':String(Buffer.byteLength(wire))});
   const body=JSON.parse(wire);
   assert.deepEqual(Object.keys(body).sort(),body.html?['html','subject','text','to']:['subject','text','to']);
   assert.equal(typeof body.to,'string');assert.ok(body.subject&&body.text);
   messages.push({body,at:Date.now(),status});
   return Response.json(status===202?{accepted:true}:{error:'Mail refused'},{status,headers:status===302?{Location:'https://redirect.example.test/steal'}:status===429?{'Retry-After':'15'}:{}});
  }catch(error){edgeError=error;throw error}
 },{bootstrap:false,origin,workerOptions:{upstream:origin,modules,bindings,assets:{directory:resolve('dist/client'),binding:'ASSETS',run_worker_first:true}}});
 try{
  const raw=(path,method='GET',body,cookie='',extra={})=>app.raw(path,method,body,cookie,{'CF-Connecting-IP':'192.0.2.10',...extra});
  const call=async(path,method='GET',body,cookie='',status=200)=>{
   const response=await raw(path,method,body,cookie);if(edgeError)throw edgeError;assert.equal(response.status,status,method+' '+path);return response.json();
  };
  const boot=await raw('/auth/bootstrap','POST',{token:bindings.SETUP_TOKEN,displayName:'Sam Rivera'});
  assert.equal(boot.status,303);const ownerCookie=boot.headers.get('set-cookie').split(';')[0];
  const finished=await app.mf.dispatchFetch(origin+'/setup',{method:'POST',redirect:'manual',headers:{origin,cookie:ownerCookie,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'});
  assert.equal(finished.status,303);
  const signin=await raw('/signin?login_hint=sam%40example.test');assert.match(await signin.text(),/value="sam@example.test"/);
  await call('/auth/magic-link','POST',{email:bindings.OWNER_EMAIL},'',202);
  assert.equal(messages.length,1,'one sign-in submission reaches the relay');
  assert.equal(messages[0].body.to,bindings.OWNER_EMAIL);
  assert.match(messages[0].body.text,/https:\/\/maple-house\.example\.test\/auth\/confirm\?token=/);
  t.diagnostic('workerd: sign-in POST MAIL_RELAY_URL; redirect=manual; exact Authorization/Content-Type and {to,subject,text,html}; Auto-Submitted accepted, relay owns stamping.');

  const conversation=await call('/api/conversations','POST',{name:'Kitchen plans',kind:'channel'},ownerCookie);
  await call('/api/team/invitations','POST',{email:'rowan@example.test',role:'member',mode:'member',scopes:[conversation.id]},ownerCookie);
  await call('/auth/invite','POST',{email:'rowan@example.test',displayName:'Rowan Chen',role:'member'},ownerCookie,202);
  const token=new URL(messages.at(-1).body.text.trim().split('\n').at(-1)).searchParams.get('token');
  const joined=await raw('/auth/confirm','POST',{token});assert.equal(joined.status,303);
  const memberCookie=joined.headers.get('set-cookie').split(';')[0],member=await call('/api/me','GET',undefined,memberCookie);
  await call('/api/notify','PATCH',{mentions:true},memberCookie);
  const mention=room=>call(`/api/conversations/${room.id}/messages`,'POST',{body:'Rowan, can you pick up the groceries?',intent:crypto.randomUUID(),mentions:[member.id]},ownerCookie);
  const queue=()=>app.db.prepare("SELECT state,attempts,error,due FROM nook_notify_queue WHERE channel='email' ORDER BY created,id").all().then(r=>r.results);
  status=429;await mention(conversation);
  await until(async()=>{if(edgeError)throw edgeError;return (await queue())[0]?.state==='retrying'},'429 is durably queued');
  const retry=(await queue())[0];assert.equal(retry.attempts,1);assert.equal(retry.error,'rate-limited');
  const count=messages.length;
  await new Promise(resolve=>setTimeout(resolve,1000));assert.equal(messages.length,count,'no early retry');
  status=202;await until(async()=>(await queue())[0].state==='sent','real alarm retries the queued email',25_000);
  assert.equal(messages.length,count+1);assert.ok(messages.at(-1).at>=retry.due,'retry respects its durable due time');
  assert.equal(messages.at(-1).body.to,'rowan@example.test');assert.doesNotMatch(messages.at(-1).body.text,/pick up the groceries/);
  t.diagnostic('workerd: invitation accepted; notification 429 -> retrying(attempts=1, rate-limited) -> sent after real 15-second alarm; no early retry or private message text.');

  status=302;const redirectedAt=messages.length;
  await call('/auth/magic-link','POST',{email:bindings.OWNER_EMAIL},'',503);
  assert.equal(messages.length,redirectedAt+1,'redirect is refused with one relay request');
  const redirectedToken=new URL(messages.at(-1).body.text.trim().split('\n').at(-1)).searchParams.get('token');
  assert.equal((await raw('/auth/confirm','POST',{token:redirectedToken})).status,400,'refused link is revoked');
  t.diagnostic('workerd: relay 302 refused; target never fetched; sign-in returns 503 and its token is revoked.');

  status=401;const refusedRoom=await call('/api/conversations','POST',{name:'Weekend plans',kind:'private',participants:[member.id]},ownerCookie);
  await mention(refusedRoom);await until(async()=>(await queue()).at(-1)?.state==='failed','retired credential becomes failed');
  const failure=(await queue()).at(-1);assert.equal(failure.error,'refused');assert.equal(failure.attempts,1);
  const problem=(await call('/api/notify','GET',undefined,ownerCookie)).workspace.notDelivered;
  assert.equal(problem.count,1);assert.equal(problem.error,'refused');
  // Use the actual browser form protocol for the owner-visible failure redirect.
  const form=await app.mf.dispatchFetch(origin+'/auth/magic-link',{method:'POST',redirect:'manual',headers:{origin,'CF-Connecting-IP':'192.0.2.11','content-type':'application/x-www-form-urlencoded',accept:'text/html'},body:new URLSearchParams({email:bindings.OWNER_EMAIL,returnTo:'/app'}).toString()});
  assert.equal(form.status,303);const problemPath=form.headers.get('location');assert.match(problemPath,/notice=mail_unavailable/);
  const notice=await (await raw(problemPath)).text();
  const alert=notice.match(/<p class="notice" role="alert">([^<]+)<\/p>/)?.[1];assert.ok(alert);assert.doesNotMatch(alert,/mail_unavailable|provider_rejected/);
  assert.equal((await app.db.prepare('SELECT count(*) AS n FROM rer_mail_development_outbox').first()).n,0);
  if(edgeError)throw edgeError;
  t.diagnostic('workerd: relay 401 -> failed/refused without retry; owner notification problem and plain sign-in alert; zero captured mail.');

  // Optional local visual proof uses the real Worker responses and built assets.
  if(process.env.NOOK_MAIL_SHOTS){
   const {chromium,expect}=await import('@playwright/test');
   // A real loopback HTTP bridge preserves browser redirect/cookie semantics;
   // every status, header and body still comes from the emitted Worker.
   uiServer=createServer(async(request,response)=>{
    try{
     const chunks=[];for await(const chunk of request)chunks.push(chunk);
     const headers={...request.headers,host:new URL(origin).host,'CF-Connecting-IP':'192.0.2.12'};
     if(headers.origin)headers.origin=origin;
     const body=Buffer.concat(chunks),result=await app.mf.dispatchFetch(new URL(request.url,origin).href,{method:request.method,headers,redirect:'manual',...(body.length?{body}:{})});
     response.writeHead(result.status,Object.fromEntries(result.headers));response.end(Buffer.from(await result.arrayBuffer()));
    }catch(error){edgeError=error;response.writeHead(500);response.end()}
   });
   await new Promise(resolve=>uiServer.listen(0,'127.0.0.1',resolve));
   const browserOrigin='http://127.0.0.1:'+uiServer.address().port;
   browser=await chromium.launch({headless:true});
   await mkdir(process.env.NOOK_MAIL_SHOTS,{recursive:true});
   for(const width of [1440,390]){
    const context=await browser.newContext({viewport:{width,height:width===390?844:1000}});
    const page=await context.newPage();await page.goto(browserOrigin+'/signin?login_hint=sam%40example.test');
    await expect(page.getByLabel('Email',{exact:true})).toHaveValue(bindings.OWNER_EMAIL);
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Email',{exact:true})).toBeFocused();
    await page.screenshot({path:resolve(process.env.NOOK_MAIL_SHOTS,`login-hint-${width}.png`)});
    await page.getByRole('button',{name:'Email a sign-in link'}).click();
    await page.waitForLoadState('networkidle');
    await page.screenshot({path:resolve(process.env.NOOK_MAIL_SHOTS,`mail-refused-${width}.png`)});
    await expect(page.getByRole('alert')).toBeVisible();
    assert.doesNotMatch(await page.getByRole('alert').innerText(),/mail_unavailable|provider_rejected/);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await context.close();
   }
  }
 }finally{await browser?.close();if(uiServer){uiServer.closeAllConnections();await new Promise(resolve=>uiServer.close(resolve))}await app.close()}
});
