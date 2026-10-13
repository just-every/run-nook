import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tinyPng} from './team-runtime.mjs';
// The parent supplies and closes its one browser/runtime. This journey closes
// every context it creates and never writes outbox HTML or credential URLs.
export async function runTeamBrowser({browser,origin,ownerCookie,destination}){
 await mkdir(destination,{recursive:true});const checks=[];
 const [cookieName,...cookieValue]=ownerCookie.split('=');
 for(const width of [1440,390]){
  const ownerContext=await browser.newContext({viewport:{width,height:900}}),memberContext=await browser.newContext({viewport:{width,height:900}}),guestContext=await browser.newContext({viewport:{width,height:900}});
  try{
   await ownerContext.addCookies([{name:cookieName,value:cookieValue.join('='),url:origin}]);
   const owner=await ownerContext.newPage(),member=await memberContext.newPage(),guest=await guestContext.newPage();
   const stamp=crypto.randomUUID().slice(0,8),name='Invitee '+stamp,email=`invitee-${stamp}@example.test`,guestEmail=`guest-${stamp}@example.test`;
   const create=await ownerContext.request.post(origin+'/api/conversations',{data:{name:'Launch '+stamp,kind:'channel'}});assert.equal(create.status(),200);const channel=await create.json();
   const privateCreate=await ownerContext.request.post(origin+'/api/conversations',{data:{name:'Review '+stamp,kind:'private'}});assert.equal(privateCreate.status(),200);const review=await privateCreate.json();
   await owner.goto(origin+'/app?view=team');const form=owner.locator('.team-invite');await form.getByLabel('Name',{exact:true}).fill(name);await form.getByLabel('Email',{exact:true}).fill(email);await form.getByLabel(channel.name,{exact:true}).check();
   const issued=owner.waitForResponse(r=>r.url()===origin+'/auth/invite'&&r.request().method()==='POST');await form.getByRole('button',{name:'Send invitation',exact:true}).click();assert.equal((await issued).status(),202);
   async function accept(page,mailbox){await page.goto(origin+'/__dev/outbox');await page.locator('article').filter({hasText:'To: '+mailbox}).first().getByRole('link').first().click();await page.getByRole('link',{name:'Open this link',exact:true}).first().click();assert.equal((await page.request.get(origin+'/auth/session')).status(),401);await page.getByRole('button',{name:'Confirm',exact:true}).click();await page.waitForURL(url=>url.pathname==='/app');}
   await accept(member,email);await member.getByLabel('Message '+channel.name,{exact:true}).fill('Ready to work together');await member.getByLabel('Attach file',{exact:true}).setInputFiles({name:'team-preview.png',mimeType:'image/png',buffer:tinyPng});await member.locator('.staged-files').getByText('team-preview.png',{exact:false}).waitFor();await member.getByRole('button',{name:'Send',exact:true}).click();const row=member.locator('.message').filter({hasText:'Ready to work together'});await row.waitFor();
   await row.getByRole('button',{name:/^Add 👍 reaction/}).click();await row.getByRole('button',{name:/^Remove 👍 reaction/}).waitFor();await row.getByAltText('team-preview.png',{exact:true}).waitFor();assert.equal(await row.getByAltText('team-preview.png',{exact:true}).evaluate(img=>img.complete&&img.naturalWidth>0),true);
   await member.reload();await member.locator('.message').filter({hasText:'Ready to work together'}).getByRole('button',{name:/^Remove 👍 reaction/}).waitFor();
   assert.equal(await member.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await member.screenshot({path:join(destination,`team-journey-${width}.png`),fullPage:true});
   const discover=await ownerContext.request.post(origin+'/api/conversations',{data:{name:'Discover '+stamp,kind:'channel'}});const publicChannel=await discover.json();await member.goto(origin+'/app?view=channels');const item=member.locator('.team-channel-list li').filter({hasText:publicChannel.name});await item.getByRole('button',{name:'Join channel',exact:true}).click();await member.getByLabel('Message '+publicChannel.name,{exact:true}).waitFor();
   const prepare=await ownerContext.request.post(origin+'/api/team/invitations',{data:{email:guestEmail,role:'member',mode:'guest',scopes:[review.id]}});assert.equal(prepare.status(),200);assert.equal((await ownerContext.request.post(origin+'/auth/invite',{headers:{Origin:origin},data:{email:guestEmail,displayName:'Guest '+stamp,role:'member',returnTo:'/app?conversation='+review.id}})).status(),202);await accept(guest,guestEmail);
   await guest.getByLabel('Message '+review.name,{exact:true}).waitFor();assert.equal((await guestContext.request.get(origin+`/api/conversations/${channel.id}/messages`)).status(),403);assert.equal((await guestContext.request.get(origin+'/api/channels')).status(),403);await guest.screenshot({path:join(destination,`team-guest-${width}.png`),fullPage:true});
   const who=await (await memberContext.request.get(origin+'/api/me')).json();assert.equal((await ownerContext.request.post(origin+'/auth/operator/status',{headers:{Origin:origin},data:{operatorId:who.id,status:'inactive'}})).status(),200);await member.waitForURL(url=>url.pathname==='/signin');assert.equal(await member.getByText('Ready to work together',{exact:true}).count(),0);assert.equal((await memberContext.request.get(origin+'/auth/session')).status(),401);await member.screenshot({path:join(destination,`team-deactivated-${width}.png`),fullPage:true});
   checks.push({width,status:'passed',flows:['owner UI actual Base invitation','outbox GET preview and one-use native confirmation','native image upload and inline private preview','reaction add and persistence','public unjoined directory and join','guest scope denial','existing client clears after deactivation'],credentialsCaptured:false});
  }finally{await Promise.all([ownerContext.close(),memberContext.close(),guestContext.close()])}
 }
 const report={checks,notificationEvidence:'Separate browser permission/constructor journey required; no OS toast observation claimed',runtime:'parent-owned actual Worker/D1/R2/React',resourcesClosed:true};await writeFile(join(destination,'team-browser-results.json'),JSON.stringify(report,null,2)+'\n');return report;
}

export async function runTeamBrowserSuite(input){
 if(process.env.TEAM_CHAT_BROWSER_HOLD==='1')throw Error('Browser launch hold is active; no browser was started');
 const {chromium}=await import('@playwright/test'),{keyed}=await import('./dev-key.mjs'),browser=await keyed(chromium).launch({headless:true});
 try{await runTeamBrowser({...input,browser});await(await import('./team-notifications.mjs')).runTeamNotifications({...input,browser})}finally{await browser.close()}
}
