import {invite} from './auth-support.mjs';
import {chromium,expect} from '@playwright/test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {mkdir,readFile} from 'node:fs/promises'
import {resolve} from 'node:path'
export async function personalBrowser({origin,owner,member,destination='evidence/personal'}){
 const post=async(path,body)=>{const r=await fetch(origin+path,{method:'POST',headers:{cookie:owner.cookie,origin,'content-type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,200,await r.clone().text());return r.json()}
 const cookie=person=>{const at=person.cookie.indexOf('=');return {name:person.cookie.slice(0,at),value:person.cookie.slice(at+1),url:origin}}
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{await mkdir(destination,{recursive:true});for(const width of [1440,390]){
  let context=await browser.newContext({serviceWorkers:'block',viewport:{width,height:width===390?844:1000}})
  try{
   await context.addCookies([cookie(owner)]);let page=await context.newPage()
   const offerContext=await browser.newContext({serviceWorkers:'block',viewport:{width,height:900}});
   try{const invitee=await invite(origin,owner.cookie,'synthetic-nook-offer-'+width+'-'+Date.now());await offerContext.addCookies([cookie(invitee)]);const offer=await offerContext.newPage();await offer.goto(origin+'/app?view=you');
    const region=offer.getByRole('region',{name:'Email notification offer',exact:true});await expect(region).toContainText('Email is off.');await region.getByLabel('Bundle interval').selectOption('60');
    await offer.screenshot({path:resolve(destination,`email-offer-before-${width}.png`),fullPage:true});
    await region.getByRole('button',{name:'Email me about mentions and DMs when I’m away',exact:true}).click();await expect(region).toHaveCount(0);
    const prefs=await(await offerContext.request.get(origin+'/api/notify')).json();assert.equal(prefs.awayEmail,true);assert.equal(prefs.awayInterval,60);
    await offer.screenshot({path:resolve(destination,`email-offer-${width}.png`),fullPage:true});
    await offerContext.request.patch(origin+'/api/notify',{headers:{Origin:origin},data:{awayEmail:false}});
   }finally{await offerContext.close()}
   await page.goto(origin+'/app?view=you');const defaults=page.getByRole('heading',{name:'New-member notifications',exact:true}).locator('..');await expect(defaults).toBeVisible();await defaults.getByRole('button',{name:'Save notification defaults',exact:true}).click();await expect(defaults.getByRole('status')).toContainText('saved');await page.screenshot({path:resolve(destination,`notification-defaults-${width}.png`),fullPage:true});
   const room=await post('/api/conversations',{name:'Product launch handoff '+width,kind:'private',participants:[member.user.id]})
   const root=await post(`/api/conversations/${room.id}/messages`,{body:'The customer success briefing is confirmed for Thursday.',intent:crypto.randomUUID()})
   await page.goto(origin+'/app?conversation='+room.id)
   await page.goto(origin+'/app?view=you');
   const vacationStart=new Date(Date.now()-60000),vacationEnd=new Date(Date.now()+3600000);
   const local=stamp=>new Date(stamp-stamp.getTimezoneOffset()*60000).toISOString().slice(0,16);
   await page.getByLabel('Vacation starts',{exact:true}).fill(local(vacationStart));await page.getByLabel('Vacation ends',{exact:true}).fill(local(vacationEnd));
   await page.getByRole('button',{name:'Save vacation',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Vacation saved.'})).toBeVisible();
   await page.screenshot({path:resolve(destination,`vacation-settings-${width}.png`),fullPage:true});
   await page.goto(origin+'/app?view=attention');await expect(page.getByText(/Your vacation holds device and email alerts/)).toBeVisible();await page.screenshot({path:resolve(destination,`vacation-attention-${width}.png`),fullPage:true});
   await page.goto(origin+'/app?view=you');await page.getByRole('button',{name:'End vacation',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Vacation ended.'})).toBeVisible();
   await page.goto(origin+'/app?conversation='+room.id);
   const draft='Before the Thursday rollout, ask Ana to confirm the West Coast support rotation.'
   await page.getByRole('textbox',{name:'Message Product launch handoff '+width,exact:true}).fill(draft)
   await page.goto(origin+'/app?view=drafts');await expect(page.getByRole('heading',{name:'Drafts & sent',exact:true})).toBeVisible();await expect(page.getByText(draft,{exact:true})).toBeVisible()
   await page.screenshot({animations:'disabled',path:resolve(destination,`drafts-${width}.png`)})
   const state=await context.storageState();await context.close();context=await browser.newContext({serviceWorkers:'block',viewport:{width,height:width===390?844:1000},storageState:state});page=await context.newPage()
   await page.goto(origin+'/app?view=drafts');await expect(page.getByText(draft,{exact:true})).toBeVisible();await page.getByRole('button',{name:'Continue draft',exact:true}).click();await expect(page.getByRole('textbox',{name:'Message Product launch handoff '+width,exact:true})).toHaveValue(draft)
   await page.getByRole('button',{name:'Send',exact:true}).click();await expect(page.getByRole('textbox',{name:'Message Product launch handoff '+width,exact:true})).toHaveValue('')
   await page.goto(origin+'/app?view=drafts');await expect(page.getByRole('heading',{name:'No drafts in this browser'})).toBeVisible();await page.getByRole('button',{name:'Sent',exact:true}).click();await expect(page.getByRole('article').filter({has:page.getByRole('heading',{name:room.name,exact:true})}).filter({hasText:draft})).toBeVisible();await page.screenshot({animations:'disabled',path:resolve(destination,`sent-${width}.png`)})
   const sent=page.getByRole('article').filter({has:page.getByRole('heading',{name:room.name,exact:true})}).filter({hasText:draft});await sent.getByRole('button',{name:'Open sent message'}).click();await expect(page.getByRole('region',{name:'Thread messages',exact:true}).locator('.message').filter({hasText:draft})).toBeVisible()
   // A thread draft retains its root context.
   await page.goto(origin+'/app?conversation='+room.id+'&thread='+root.id);await page.getByRole('textbox',{name:'Reply in thread',exact:true}).fill('Ana has confirmed the rotation. I will send the handoff notes next.')
   await page.goto(origin+'/app?view=drafts');await expect(page.getByText(/Ana has confirmed the rotation/)).toBeVisible();await page.getByRole('button',{name:'Continue draft'}).click();await expect(page).toHaveURL(new RegExp('thread='+root.id));await expect(page.getByRole('textbox',{name:'Reply in thread',exact:true})).toHaveValue(/Ana has confirmed/)
   // Scheduled edit/cancel is the same supported control within this view.
   await post(`/api/conversations/${room.id}/scheduled`,{body:'Send the updated support briefing.',intent:crypto.randomUUID(),localAt:new Date(Date.now()+7200000).toISOString().slice(0,16),zone:'UTC',recurrence:'none',endDate:null,attachments:[]})
   await page.goto(origin+'/app?view=drafts');await page.getByRole('navigation',{name:'Drafts and sent sections'}).getByRole('button',{name:'Scheduled',exact:true}).click();const card=page.getByRole('article',{name:'Scheduled message in Product launch handoff '+width})
   await card.getByRole('button',{name:'Edit schedule'}).click();const dialog=page.getByRole('dialog');await dialog.getByLabel('Message for later').fill('Send the final support briefing.');await dialog.getByLabel('Send at',{exact:true}).fill(new Date(Date.now()+10800000).toISOString().slice(0,16));await dialog.getByRole('button',{name:'Save schedule'}).click();await expect(dialog).toHaveCount(0);await expect(card.getByText('Send the final support briefing.')).toBeVisible()
   await page.screenshot({animations:'disabled',path:resolve(destination,`scheduled-${width}.png`)})
   await card.getByRole('button',{name:'Cancel scheduled message'}).click();await expect(card.getByText('Cancelled',{exact:true})).toBeVisible();await page.screenshot({animations:'disabled',path:resolve(destination,`cancelled-${width}.png`)})
   await context.clearCookies();await context.addCookies([cookie(member)]);await page.goto(origin+'/app?view=drafts');await expect(page.getByText(/Ana has confirmed the rotation/)).toHaveCount(0);await page.getByRole('button',{name:'Sent',exact:true}).click();await expect(page.getByText(draft,{exact:true})).toHaveCount(0);await expect(page.getByRole('heading',{name:'No recent sent messages'}).or(page.getByRole('article').first())).toBeVisible()
   await page.screenshot({animations:'disabled',path:resolve(destination,`other-account-${width}.png`)})
   await page.goto(origin+'/app?conversation='+room.id);await page.getByRole('textbox',{name:'Message Product launch handoff '+width,exact:true}).fill('My private handoff notes awaiting review.');await post(`/api/conversations/${room.id}/members`,{user:member.user.id,remove:true});await page.goto(origin+'/app?view=drafts');await expect(page.getByRole('heading',{name:'No drafts in this browser'})).toBeVisible();await expect(page.getByText('My private handoff notes awaiting review.',{exact:true})).toHaveCount(0);await page.screenshot({animations:'disabled',path:resolve(destination,`revoked-${width}.png`)})
   await context.clearCookies();await context.addCookies([cookie(owner)]);await page.goto(origin+'/app?view=drafts');await expect(page.getByText(/Ana has confirmed the rotation/)).toBeVisible()
  }finally{await context.close()}
 }}finally{await browser.close()}
}
