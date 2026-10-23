import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';

export async function deltaBrowser({app,owner,monday,friday,door}){
 const {origin,call}=app,browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
 await mkdir('evidence/slack-delta',{recursive:true});
 try{for(const width of [1440,390]){
  const namespace='synthetic-nook-delta-'+width,roomName='Release planning '+width,source=await door.inspect(friday),review={namespace,channels:[{sourceId:'C1',name:roomName,members:[owner.user.id]}],actors:{U1:null,U2:null},acceptedOmissions:[]};
  const base=await door.plan(source,review);await door.finish(base);
  const room=(await call('/api/conversations','GET',undefined,owner.cookie)).find(c=>c.name===roomName),root=(await call(`/api/conversations/${room.id}/messages`,'GET',undefined,owner.cookie)).find(m=>!m.parent);
  const native=await call(`/api/conversations/${room.id}/messages`,'POST',{body:'Safety checks continue in Nook.',parent:root.id,intent:'synthetic-nook-delta-'+width},owner.cookie);
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width,height:width===390?844:1000}});
  try{
   const at=owner.cookie.indexOf('=');await context.addCookies([{name:owner.cookie.slice(0,at),value:owner.cookie.slice(at+1),url:origin}]);const page=await context.newPage(),errors=[];
   page.on('pageerror',error=>errors.push(String(error)));page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});
   const shot=async name=>{assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no delta overflow');await page.screenshot({path:`evidence/slack-delta/${name}-${width}.png`,fullPage:false,animations:'disabled'})};
   await page.goto(origin+'/imports');await expect(page.getByLabel('Slack export ZIP')).toBeEnabled();await page.getByLabel('Slack export ZIP').setInputFiles({name:'monday.zip',mimeType:'application/zip',buffer:monday});
   await page.getByLabel('Source workspace namespace').fill(namespace);
   for(const name of ['release','handoff'])await page.getByLabel(name+' public source').check();
   await page.getByLabel('New channel name',{exact:true}).nth(0).fill(roomName);await page.getByLabel('New channel name',{exact:true}).nth(1).fill('Handoff planning '+width);
   for(const select of await page.locator('select').all())await select.selectOption('external');
   await page.getByLabel('Delta pass over existing history',{exact:true}).check();
   const range={from:new Date(Date.now()-7*86400000).toISOString().slice(0,10),to:new Date().toISOString().slice(0,10)};
   await page.getByLabel('Attested from (UTC)',{exact:true}).fill(range.to);await page.getByLabel('Attested to (UTC)',{exact:true}).fill(range.from);await page.getByRole('button',{name:'Preview exact import',exact:true}).click();await expect(page.getByRole('alert')).toContainText(/date range|before|past/i);
   await page.getByLabel('Attested from (UTC)',{exact:true}).fill(range.from);await page.getByLabel('Attested to (UTC)',{exact:true}).fill(range.to);
   await page.getByRole('button',{name:'Preview exact import',exact:true}).click();await expect(page.locator('form').getByRole('heading',{name:'Delta pass report',exact:true})).toBeVisible();await page.locator('form').getByRole('heading',{name:'Delta pass report',exact:true}).evaluate(element=>element.scrollIntoView({block:'start'}));await shot('preview');
   const previewAttestation=page.locator('form').getByRole('region',{name:'attested, not verified',exact:true});await expect(previewAttestation).toContainText(range.from);await expect(previewAttestation).toContainText(range.to);await expect(previewAttestation).toContainText(owner.user.name);assert.ok(Number.isFinite(Date.parse(await previewAttestation.locator('time').getAttribute('datetime'))));await previewAttestation.scrollIntoViewIfNeeded();await shot('attestation-preview');
   await page.getByRole('checkbox',{name:'I have reviewed these omissions and accept this exact list.',exact:true}).check();
   const planned=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/operator/import/plan');await page.getByRole('button',{name:'Create dry run',exact:true}).click();const response=await planned;assert.equal(response.status(),200,await response.text());const plan=await response.json();await expect(page.getByRole('button',{name:'Apply reviewed plan',exact:true}).first()).toBeVisible();await page.getByRole('button',{name:'Apply reviewed plan',exact:true}).first().click();await expect(page.getByRole('status')).toContainText('Historical import completed.');
   const job=page.locator('.import-job').filter({hasText:plan.planId});await expect(job).toContainText('Imported through: unverified.');await job.scrollIntoViewIfNeeded();await shot('result');
   const recordedAttestation=job.getByRole('region',{name:'attested, not verified',exact:true});await expect(recordedAttestation).toContainText(range.from);await expect(recordedAttestation).toContainText(range.to);await expect(recordedAttestation).toContainText(owner.user.name);assert.ok(Number.isFinite(Date.parse(await recordedAttestation.locator('time').getAttribute('datetime'))));await recordedAttestation.scrollIntoViewIfNeeded();await shot('attestation-result');
   await page.addScriptTag({path:resolve('node_modules/axe-core/axe.min.js')});assert.deepEqual(await page.evaluate(async()=>(await axe.run(document)).violations.filter(v=>['critical','serious'].includes(v.impact))),[]);
   await page.goto(origin+`/app?conversation=${room.id}&thread=${root.id}`);await expect(page.getByText('Posted in Nook',{exact:true})).toBeVisible();await shot('thread');await page.locator('.thread-log').getByText('Imported revision history',{exact:true}).first().click();await expect(page.locator('.thread-log').getByText('Earlier text 1',{exact:true})).toBeVisible();await shot('revisions');
   await page.goto(origin+'/imports');await page.locator('.import-job').filter({hasText:plan.planId}).getByRole('button',{name:'Undo this import',exact:true}).click();await expect(page.getByRole('status')).toContainText('undone');await page.locator('.import-job').filter({hasText:plan.planId}).scrollIntoViewIfNeeded();await shot('undo');
   await expect(page.locator('.import-job').filter({hasText:plan.planId}).getByRole('region',{name:'attested, not verified',exact:true})).toHaveCount(0);
   assert.ok((await call(`/api/conversations/${room.id}/messages`,'GET',undefined,owner.cookie)).some(m=>m.id===native.id));assert.deepEqual(errors,[]);
  }finally{await context.close()}
 }}finally{await browser.close()}
}
