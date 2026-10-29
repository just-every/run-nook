// Browser leg of the agent-door journey, against the emitted production Worker.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {installation} from './installation.mjs';
import {heldPolicy} from '../../src/base/modules/agent-door/conformance/crypto.mjs';
const destination=process.env.NOOK_EVIDENCE_DIR;if(!destination)throw Error('Choose a private evidence directory');
const f=await installation();let browser;
try{
 const c=f.protocol();await c.adopt(heldPolicy());
 const created=await c.tool('nook.conversations.create',{name:'Launch review',kind:'private',idempotency_key:randomUUID()}),room=created.result.structuredContent;
 const team=await(await f.request('/api/team',{headers:{Cookie:f.owner.cookie}})).json(),ari=team.find(p=>p.email===f.roster[0].email);
 const prepared=await c.tool('nook.conversations.member',{id:room.id,user:ari.id,remove:false,idempotency_key:randomUUID()});
 const approval=prepared.result._meta['com.runeditrun/approval'];assert.ok(approval.url);
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});await mkdir(destination,{recursive:true});
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:width===390?844:1000},serviceWorkers:'block'});
  const [name,...value]=f.owner.cookie.split('=');await context.addCookies([{name,value:value.join('='),url:f.origin}]);
  await context.route(f.origin+'/**',async route=>{const request=route.request(),response=await f.request(request.url(),{method:request.method(),headers:await request.allHeaders(),...(request.postDataBuffer()?{body:request.postDataBuffer()}:{})});await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())})});
  const page=await context.newPage();
  for(const [state,path] of [['activity','/agents'],['pending',approval.url]]){
   await page.goto(new URL(path,f.origin).href);await page.getByText('Agent door conformance',{exact:false}).first().waitFor();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.screenshot({path:destination+'/'+width+'-'+state+'.png',fullPage:true});
  }
  await context.close();
 }
 assert.ok((await c.decideApproval(prepared)).ok);
 const blocked=heldPolicy();blocked.rules=[{id:'blocked',class:'*',do:'blocked'}];await c.adopt(blocked);await c.tool('nook.identity.read',{});
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:width===390?844:1000},serviceWorkers:'block'}),[name,...value]=f.owner.cookie.split('=');await context.addCookies([{name,value:value.join('='),url:f.origin}]);
  await context.route(f.origin+'/**',async route=>{const request=route.request(),response=await f.request(request.url(),{method:request.method(),headers:await request.allHeaders()});await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())})});
  const page=await context.newPage();await page.goto(f.origin+'/agents');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:destination+'/'+width+'-final-blocked.png',fullPage:true});await context.close();
 }
 console.log('NOOK_BROWSER '+JSON.stringify({widths:[1440,390],states:['activity','pending','final-blocked'],horizontal_overflow:false}));
}finally{await browser?.close();await f.close()}
