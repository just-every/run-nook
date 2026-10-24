import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
import {keyed} from '../dev-key.mjs';
import {browserEmailSignIn} from '../auth-support.mjs';
import {createBrowserPlan} from '../import-browser-support.mjs';
import {googleChatFixture} from './fixture.mjs';
import {mkdir,readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
export async function googleChatBrowser({origin}){
 const browser=await keyed(chromium).launch({headless:true});
 try{for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();
  try{
   await browserEmailSignIn(page,origin,'nativeowner@example.test');await page.goto(origin+'/imports?source=gchat');
   await expect(page.getByRole('heading',{name:'Bring your Google Chat history into Nook'})).toBeVisible();
   await expect(page.getByLabel('Google Chat export ZIP')).toBeEnabled();
   await page.getByLabel('Google Chat export ZIP').setInputFiles({name:'synthetic-nook-gchat.zip',mimeType:'application/zip',buffer:googleChatFixture()});
   await page.getByLabel('Source workspace namespace').fill('synthetic-nook-gchat-browser-'+width+'-'+Date.now());
   const me=await(await context.request.get(origin+'/api/me')).json(),selects=page.locator('.import-actors select');
   await selects.nth(0).selectOption(me.id);
   const other=await selects.nth(1).locator('option').evaluateAll((options,id)=>options.map(o=>o.value).find(v=>v&&v!=='external'&&v!==id),me.id);assert.ok(other);await selects.nth(1).selectOption(other);
   for(const control of await page.locator('.import-choice>label input[type=checkbox]').all())await control.check();
   await page.getByRole('button',{name:'Preview exact import',exact:true}).click();
   await expect(page.getByRole('heading',{name:'Named omissions'})).toBeVisible();
   await page.getByLabel('I reviewed and accept these exact omissions').check();
   await page.addScriptTag({content:await readFile(createRequire(import.meta.url).resolve('axe-core/axe.min.js'),'utf8')});
   const serious=await page.evaluate(async()=>(await axe.run()).violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})));assert.deepEqual(serious,[]);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   const directory=process.env.TEAM_CHAT_EVIDENCE_DIR??'evidence/google-chat';await mkdir(directory,{recursive:true});await page.screenshot({path:directory+'/gchat-review-'+width+'.png',fullPage:true});
   await page.getByRole('button',{name:'Create dry run',exact:true}).click();
   await page.getByRole('button',{name:'Apply reviewed plan',exact:true}).first().waitFor();
   await page.getByRole('button',{name:'Apply reviewed plan',exact:true}).first().click();
   await page.getByRole('status').filter({hasText:'Historical import completed.'}).waitFor();
   const rooms=await(await context.request.get(origin+'/api/conversations')).json(),room=rooms.filter(c=>c.id.startsWith('gchat-')&&c.name==='synthetic-nook-space').at(-1);assert.ok(room);
   await page.goto(origin+'/app?conversation='+room.id);
   await expect(page.locator('.message-body').filter({hasText:'synthetic-nook Google Chat root'})).toBeVisible();
   await page.getByRole('button',{name:'Open thread',exact:true}).first().click();
   await expect(page.locator('.thread-log .message-body').filter({hasText:'synthetic-nook Google Chat reply'})).toBeVisible();
   await page.screenshot({path:directory+'/gchat-thread-'+width+'.png',fullPage:true});
  }finally{await context.close()}
 }}finally{await browser.close()}
}
