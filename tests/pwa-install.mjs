import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {chromium} from '@playwright/test';
import {freePort} from './worker-ports.mjs';

// Install into the fresh browser default context; ordinary pages use newContext.
// CDP's URL install defaults to a browser shortcut, independently of the web
// manifest. Select the user's app-window preference before launching it.
export async function runPwaInstall({origin,ownerCookie,destination,channel='chromium'}){
 let browser,observer,context,session,manifestId,installed=false;
 try{
  const port=await freePort();
  browser=await chromium.launch({channel,headless:true,args:['--use-mock-keychain','--password-store=basic','--remote-debugging-port='+port]});
  context=await browser.newContext();
  observer=await chromium.connectOverCDP('http://127.0.0.1:'+port);
  const [name,...value]=ownerCookie.split('=');
  await context.addCookies([{name,value:value.join('='),url:origin}]);
  await observer.contexts()[0].addCookies([{name,value:value.join('='),url:origin}]);
  const page=await context.newPage();await page.goto(origin+'/app?view=you');
  await page.getByRole('region',{name:'Push notifications',exact:true}).waitFor();
  const href=await page.locator('link[rel="manifest"]').getAttribute('href');
  const response=await context.request.get(new URL(href,origin).href);assert.ok(response.ok());
  const manifest=await response.json();manifestId=new URL(manifest.id,origin).href;
  const start=new URL(manifest.start_url,origin),scope=new URL(manifest.scope,origin);
  assert.equal(start.origin,origin);assert.ok(start.pathname.startsWith(scope.pathname));
  assert.ok(manifest.name&&manifest.short_name,'the installed app has a name');
  assert.ok(Array.isArray(manifest.icons)&&manifest.icons.length,'the installed app supplies its own icon');
  for(const icon of manifest.icons){
   const response=await context.request.get(new URL(icon.src,origin).href);assert.ok(response.ok());
   const bytes=await response.body();assert.equal(bytes.readUInt32BE(0),0x89504e47,'app icon is a real PNG');
  }
  session=await browser.newBrowserCDPSession();
  await session.send('PWA.install',{manifestId,installUrlOrBundleUrl:origin+'/app'});installed=true;
  await session.send('PWA.changeAppUserSettings',{manifestId,displayMode:'standalone'});
  const {targetId}=await session.send('PWA.launch',{manifestId,url:origin+'/app?view=you'});
  const {windowId}=await session.send('Browser.getWindowForTarget',{targetId});
  const app=await waitForApp(observer.contexts()[0],page);
  const captures=[];await mkdir(destination,{recursive:true});
  for(const width of [1440,390]){
   // Resize the native app surface too; viewport-only emulation can tile a
   // smaller macOS app surface when Chrome captures the larger viewport.
   await session.send('Browser.setWindowBounds',{windowId,bounds:{width:width+100,height:width===390?944:1100}});
   await app.setViewportSize({width,height:width===390?844:1000});
   await app.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   await app.getByRole('region',{name:'Push notifications',exact:true}).waitFor();
   await app.getByRole('region',{name:'Push notifications',exact:true}).getByLabel('Mentions and commitments',{exact:true}).waitFor();
   assert.equal(await app.evaluate(()=>matchMedia('(display-mode: standalone)').matches),true,'launch is an app window');
   assert.equal(await app.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   const path=join(destination,`installed-nook-${width}.png`);await app.screenshot({path});captures.push(path);
  }
  await writeFile(join(destination,'pwa-install.json'),JSON.stringify({origin,manifest,standalone:true,mechanism:'PWA.install; standalone user preference; PWA.launch',captures},null,2)+'\n');
  return {manifest,standalone:true,captures};
 }finally{
  try{if(installed)await session.send('PWA.uninstall',{manifestId})}
  finally{try{await context?.close();await observer?.close()}finally{await browser?.close()}}
 }
}

async function waitForApp(context,original){
 const deadline=Date.now()+15000;
 while(Date.now()<deadline){
  for(const page of context.pages())if(page!==original&&await page.evaluate(()=>matchMedia('(display-mode: standalone)').matches).catch(()=>false))return page;
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 throw Error('Installed Nook did not open a standalone window');
}
