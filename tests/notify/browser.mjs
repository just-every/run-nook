import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {expect} from '@playwright/test';
// The member's "Email me when…" block and the owner's workspace line, at 1440 and
// 390, from the native sign-in sessions. The first pass turns mentions on with
// the keyboard only; axe runs when the caller supplies its published source.
export async function settingsBrowser({browser,origin,rowan,sam,evidence,axeSource,phase}){
 await mkdir(evidence,{recursive:true});
 for(const width of [1440,390])for(const [who,person] of [['member',rowan],['owner',sam]]){
  const context=await browser.newContext({...(process.env.NOOK_BROWSER_BLOCK_SERVICE_WORKERS==='1'?{serviceWorkers:'block'}:{}),viewport:{width,height:width===390?844:1000}}),at=person.cookie.indexOf('=');
  await context.addCookies([{name:person.cookie.slice(0,at),value:person.cookie.slice(at+1),url:origin}]);
  try{
   const page=await context.newPage();await page.goto(origin+'/app?view=you');
   const block=page.getByRole('region',{name:'Email me when…'});await expect(block).toBeVisible();
   const mentions=block.getByRole('checkbox',{name:/mentions me/}),urgent=block.getByRole('checkbox',{name:/sends me an urgent request/}),through=block.getByRole('checkbox',{name:/through quiet time/});
   if(phase==='settings'&&who==='member'&&width===1440){
    await expect(mentions).not.toBeChecked();await expect(through).toBeDisabled();
    await mentions.focus();await page.keyboard.press('Space');await expect(mentions).toBeChecked();
    await page.keyboard.press('Tab');await expect(urgent).toBeFocused();
    await expect.poll(async()=>(await (await context.request.get(origin+'/api/notify')).json()).mentions).toBe(true);
   }
   if(phase==='not-delivered'&&who==='member')await expect(block.getByRole('list')).toContainText('Casey');
   if(who==='owner'){
    const settings=await (await context.request.get(origin+'/api/notify')).json();assert.equal(settings.workspace.sending,'provider');
    await expect(block.getByRole('link',{name:'Set up mail'})).toHaveCount(0);
   }
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'the block fits the viewport');
   await block.scrollIntoViewIfNeeded();await page.screenshot({path:join(evidence,`${phase}-${who}-${width}.png`)});
   if(axeSource){
    await page.addScriptTag({content:axeSource});
    const violations=await page.evaluate(async()=>(await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>v.id));
    assert.deepEqual(violations,[],`axe serious and critical at ${width} (${who}, ${phase})`);
   }
  }finally{await context.close();}
 }
}
