import assert from 'node:assert/strict';
import {join} from 'node:path';
import {expect} from '@playwright/test';
import {importHistory,exerciseUndo} from './imports.mjs';
import {pilotPhase} from './progress.mjs';

export async function read(context,origin,path){const response=await context.request.get(origin+path);assert.equal(response.status(),200,path);return response.json();}
async function enterLocal(page,origin,as,open){
 await page.goto(open??`${origin}/auth/dev/enter?as=${as}&returnTo=/app`);
 await page.waitForURL(url=>['/setup','/app'].includes(url.pathname));
 if(new URL(page.url()).pathname==='/setup'){
  await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Finish setup',exact:true}).click();await page.waitForURL(url=>url.pathname==='/app');
 }
}
export async function search(page,origin,query){
 await page.goto(origin+'/app?view=search');await expect(page.locator('.nook-app[data-live-connected="true"]')).toBeVisible();await page.getByLabel('Search conversations',{exact:true}).fill(query);
 await page.locator('.search-form').getByRole('button',{name:'Search',exact:true}).click();
 await expect(page.getByRole('status').filter({hasText:/^\d+ results loaded/})).toBeVisible();
}
async function snapshot(context,origin){
 const [conversations,attention]=await Promise.all([read(context,origin,'/api/conversations'),read(context,origin,'/api/attention')]);
 return {unread:conversations.reduce((n,c)=>n+c.unread,0),attention:attention.items.length,deferred:attention.deferredCount};
}
export async function pilotBrowser({browser,installation,width,destination}){
 const {origin,key}=installation,viewport={width,height:width===390?844:1000};
 const ownerContext=await browser.newContext({viewport,extraHTTPHeaders:{'x-rer-dev-key':key}}),memberContext=await browser.newContext({viewport,extraHTTPHeaders:{'x-rer-dev-key':key}});
 try{
  const owner=await ownerContext.newPage(),member=await memberContext.newPage(),stamp=`${width}-${Date.now()}`,name='Dev member',channelName=`Pilot private ${stamp}`;
  // The supported local owner and teammate identities enter in separate browsers.
  await enterLocal(owner,origin,'owner',installation.open);
  await enterLocal(member,origin,'member');
  const person=await read(memberContext,origin,'/api/me');
  await owner.goto(origin+'/app?view=channels');await expect(owner.locator('.nook-app[data-live-connected="true"]')).toBeVisible();await owner.getByRole('button',{name:'Create channel',exact:true}).last().click();
  const dialog=owner.getByRole('dialog');await dialog.getByLabel('Channel name',{exact:true}).fill(channelName);await dialog.getByLabel('Visibility',{exact:true}).selectOption('private');await dialog.getByRole('button',{name:'Create channel',exact:true}).click();
  await owner.getByLabel('Message '+channelName,{exact:true}).waitFor();
  const channels=await read(ownerContext,origin,'/api/conversations'),conversation=channels.find(c=>c.name===channelName);assert.ok(conversation);
  const granted=await ownerContext.request.post(`${origin}/api/conversations/${conversation.id}/members`,{data:{user:person.id}});assert.equal(granted.status(),200);
  const body=`Private pilot file ${stamp}`,bytes=Buffer.from(`Only these two people can read this file: ${stamp}\n`);
  await member.goto(`${origin}/app?conversation=${conversation.id}`);await member.getByLabel('Message '+channelName,{exact:true}).fill(body);await member.getByLabel('Attach file',{exact:true}).setInputFiles({name:'pilot-private.txt',mimeType:'text/plain',buffer:bytes});await member.locator('.staged-files').getByText('pilot-private.txt',{exact:false}).waitFor();await member.getByRole('button',{name:'Send',exact:true}).click();await member.getByText(body,{exact:true}).waitFor();
  await owner.goto(`${origin}/app?conversation=${conversation.id}`);await owner.getByText(body,{exact:true}).waitFor();
  const privateLink=owner.locator('.message').filter({hasText:body}).getByRole('link',{name:/pilot-private\.txt/});const filePath=await privateLink.getAttribute('href');assert.ok(filePath);
  for(const context of [ownerContext,memberContext]){const response=await context.request.get(origin+filePath);assert.equal(response.status(),200);assert.deepEqual(await response.body(),bytes);}
  const publicResponse=await fetch(origin+filePath);assert.notEqual(publicResponse.status,200,'private bytes cannot be read without a session');
  await expect.poll(async()=>(await read(ownerContext,origin,'/api/conversations')).find(c=>c.id===conversation.id).unread).toBe(0);
  assert.equal(await owner.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await owner.screenshot({path:join(destination,`pilot-private-file-${width}.png`),fullPage:true});
  pilotPhase('private-file-complete',{width,sessions:2});
  const beforeOwner=await snapshot(ownerContext,origin),beforeMember=await snapshot(memberContext,origin);
  const imported=await importHistory({owner,member,ownerContext,memberContext,origin,stamp,name,width,destination});
  assert.deepEqual(await snapshot(ownerContext,origin),beforeOwner,'import creates no owner unread or attention');
  assert.deepEqual(await snapshot(memberContext,origin),beforeMember,'import creates no member unread or attention');
  pilotPhase('imported-activity-unchanged',{width,sessions:2});
  await exerciseUndo({owner,ownerContext,origin,stamp,name,imported,width,destination});
  pilotPhase('revocation-start',{width});
  await member.goto(`${origin}/app?conversation=${imported.shared.id}&focus=${imported.markerId}`);await expect(member.locator(`.message[data-message="${imported.markerId}"]`)).toBeVisible();
  await owner.goto(`${origin}/app?conversation=${imported.shared.id}`);await expect(owner.locator('.nook-app[data-live-connected="true"]')).toBeVisible();await owner.getByRole('button',{name:'Details',exact:true}).click();await owner.getByRole('dialog').getByRole('button',{name:'Remove '+name,exact:true}).click();await expect(owner.getByRole('dialog').getByRole('button',{name:'Add '+name,exact:true})).toBeVisible();
  await expect(member.locator('.message[data-immutable="true"]')).toHaveCount(0,{timeout:30_000});
  await member.screenshot({path:join(destination,`pilot-member-cleared-${width}.png`),fullPage:true});
  assert.equal((await memberContext.request.get(`${origin}/api/conversations/${imported.shared.id}/messages`)).status(),403,'removed audience cannot read history');
  assert.equal((await memberContext.request.get(`${origin}/api/messages/${imported.markerId}`)).status(),404,'removed audience cannot directly read an imported message');
  assert.equal((await memberContext.request.get(`${origin}/api/conversations/${imported.shared.id}/replay`)).status(),403,'removed audience cannot replay the channel');
  assert.equal((await memberContext.request.get(`${origin}/api/attachments/${imported.attachment.id}/download`)).status(),404,'removed audience cannot download retained imported files');
  assert.equal((await ownerContext.request.get(`${origin}/api/attachments/${imported.attachment.id}/download`)).status(),200,'retained owner still downloads imported files');
  await search(member,origin,imported.sharedMarker);await expect(member.locator('.search-result')).toHaveCount(0);
  await search(owner,origin,imported.sharedMarker);await expect(owner.locator('.search-result').first()).toBeVisible();
  const retained=await read(ownerContext,origin,`/api/messages/${imported.markerId}`);assert.ok(retained.body.includes(imported.sharedMarker),'retained owner still reads imported history');
  for(const [page,label] of [[owner,'owner-retained'],[member,'member-revoked']]){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:join(destination,`pilot-${label}-${width}.png`),fullPage:true});}
  pilotPhase('revocation-complete',{width,sessions:2});
  return {width,status:'passed',sessions:2,authentication:'Base owner and member local identities',privateFile:true,importedActivityUnchanged:true,selectedAudience:true,audienceRevoked:true,undoBeforeLiveWork:true,undoRefusedAfterLiveWork:true,corpus:imported.corpus,readonlyReactionsMentionsAndEditedMarker:true};
 }catch(error){
  // Playwright request failures may include request-header call logs. Preserve
  // useful assertions while withholding authentication headers from terminal.
  const message=String(error?.message??error).replaceAll(key,'[development key redacted]').split('\n').filter(line=>!/(?:cookie|authorization|x-rer-dev-key|[?&]token=)/i.test(line)).join('\n');
  throw Error(message);
 }finally{await Promise.all([ownerContext.close(),memberContext.close()]);}
}
