import assert from 'node:assert/strict';

// Same-browser local identities are the owner-facing README workflow.
export async function readmeTeamFlow(page,origin,width,{capture=async()=>{}}={}){
 const name=`Local plans ${width}`,ownerText=`Owner started plans at ${width}`,reply=`Dev member replied at ${width}`;
 await page.goto(`${origin}/auth/dev/enter?as=owner&returnTo=/app`);await page.waitForURL(origin+'/app');
 await page.goto(origin+'/app?view=channels');await page.locator('.nook-app[data-live-connected="true"]').waitFor();await page.getByRole('button',{name:'Create channel',exact:true}).last().click();
 const dialog=page.getByRole('dialog');await dialog.getByLabel('Channel name',{exact:true}).fill(name);
 await dialog.getByLabel('Visibility',{exact:true}).selectOption('private');await dialog.getByRole('button',{name:'Create channel',exact:true}).click();
 await page.getByLabel('Message '+name,{exact:true}).fill(ownerText);await page.getByRole('button',{name:'Send',exact:true}).click();await page.locator('.message-body').filter({hasText:ownerText}).waitFor();
 const channelUrl=page.url();
 await page.goto(origin+'/app?view=team');
 await page.getByRole('heading',{name:'Try a local teammate',exact:true}).waitFor();
 await page.locator('.team-people li').first().waitFor();
 await capture('team-entry');
 await page.getByRole('link',{name:'Enter as local teammate',exact:true}).click();await page.waitForURL(origin+'/app');
 const me=await page.evaluate(async()=>(await fetch('/api/me')).json());assert.equal(me.name,'Dev member');assert.equal(me.role,'member');
 await page.goto(`${origin}/auth/dev/enter?as=owner&returnTo=/app`);await page.waitForURL(origin+'/app');await page.goto(channelUrl);
 await page.locator('.nook-app[data-live-connected="true"]').waitFor();
 await page.getByRole('button',{name:'Details',exact:true}).click();
 await page.getByRole('dialog').getByRole('button',{name:'Add Dev member',exact:true}).click();
 await page.getByRole('dialog').getByRole('button',{name:'Remove Dev member',exact:true}).waitFor();
 await page.goto(`${origin}/auth/dev/enter?as=member&returnTo=/app`);await page.waitForURL(origin+'/app');await page.goto(channelUrl);
 await page.locator('.message-body').filter({hasText:ownerText}).waitFor();await page.getByLabel('Message '+name,{exact:true}).fill(reply);
 await page.getByRole('button',{name:'Send',exact:true}).click();await page.locator('.message-body').filter({hasText:reply}).waitFor();await capture('teammate-joined');
 await page.goto(`${origin}/auth/dev/enter?as=owner&returnTo=/app`);await page.waitForURL(origin+'/app');
 await page.goto(channelUrl);await page.locator('.message-body').filter({hasText:reply}).waitFor();await capture('owner-reply');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`local teammate flow fits ${width}`);
}
