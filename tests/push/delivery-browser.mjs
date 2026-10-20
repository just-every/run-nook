import {chromium,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
export async function deliveryBrowser({origin,member,call,ownerCookie}){
 await fetch(origin+'/setup',{method:'POST',redirect:'manual',headers:{cookie:ownerCookie,origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'});
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
 try{await mkdir('evidence/device-routing',{recursive:true});for(const width of [1440,390]){
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width,height:width===390?844:1000}});
  try{await context.addInitScript(({key})=>localStorage.setItem(key,'mobile'),{key:'nook.push.class.'+member.user.id});const [name,...v]=member.cookie.split('=');await context.addCookies([{name,value:v.join('='),url:origin}]);const page=await context.newPage();await page.goto(origin+'/app?view=you');const heading=page.getByRole('heading',{name:'Your device delivery'});await expect(heading).toBeVisible();
   const always=page.getByRole('checkbox',{name:"Always send to mobile, even when I'm active"});await expect(always).not.toBeChecked();await page.getByLabel('Mobile delay after becoming inactive',{exact:true}).selectOption('5');
   await expect(page.getByText('Canceled: held-active-elsewhere',{exact:true})).toBeVisible();await heading.scrollIntoViewIfNeeded();await page.screenshot({animations:'disabled',path:`evidence/device-routing/delivery-${width}.png`});
   await page.getByRole('heading',{name:'Activity-held alerts'}).scrollIntoViewIfNeeded();await page.screenshot({animations:'disabled',path:`evidence/device-routing/alerts-${width}.png`});
   if(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth))throw Error('Delivery view overflows viewport');
  }finally{await context.close()}
 }}finally{await browser.close()}
}
