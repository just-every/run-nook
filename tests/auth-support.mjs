import assert from 'node:assert/strict';
import {keyHeaders} from './dev-key.mjs';
const unescape=text=>text.replaceAll('&amp;','&').replaceAll('&#39;',"'").replaceAll('&quot;','"');
const mailboxes=new Map();
export async function signIn(origin,email,options={}){
 const key=origin+email.toLowerCase(),before=mailboxes.get(key)??Promise.resolve();
 const next=before.catch(()=>{}).then(()=>consumeLink(origin,email,options));mailboxes.set(key,next);
 try{return await next}finally{if(mailboxes.get(key)===next)mailboxes.delete(key)}
}
async function consumeLink(origin,email,{requestLink=true,productStatus=200}={}){
 if(requestLink){const r=await fetch(origin+'/auth/magic-link',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email,returnTo:'/app'})});assert.equal(r.status,202,'ordinary sign-in request')}
 const listing=await(await fetch(origin+'/__dev/outbox',{headers:keyHeaders})).text();const article=listing.split('<article>').slice(1).find(row=>row.toLowerCase().includes(`to: ${email.toLowerCase()}</p>`));assert.ok(article,'outbox contains requested synthetic recipient');const message=article.match(/href="([^\"]*\?message=[^\"]+)"/);assert.ok(message,'outbox detail');
 const detail=await(await fetch(new URL(unescape(message[1]),origin),{headers:keyHeaders})).text();const link=detail.match(/href="([^\"]*\/auth\/confirm\?[^\"]+)"/);assert.ok(link,'ordinary confirmation link');
 const url=new URL(unescape(link[1]),origin);const preview=await fetch(url);assert.equal(preview.status,200);assert.equal(preview.headers.has('set-cookie'),false);
 const head=await fetch(url,{method:'HEAD'});assert.equal(head.status,200);assert.equal(head.headers.has('set-cookie'),false);
 const form=await preview.text(),token=form.match(/name="token" value="([^\"]+)"/)?.[1];assert.ok(token,'native confirmation form token');
 const completed=await fetch(origin+'/auth/confirm',{method:'POST',redirect:'manual',headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token:unescape(token)})});assert.equal(completed.status,303,'native POST confirmation');
 const replay=await fetch(origin+'/auth/confirm',{method:'POST',redirect:'manual',headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token:unescape(token)})});assert.equal(replay.status,400,'confirmation is single use');
 const cookie=completed.headers.get('set-cookie').split(';')[0];const me=await fetch(origin+'/api/me',{headers:{cookie}});assert.equal(me.status,productStatus);return {cookie,user:productStatus===200?await me.json():null};
}
export async function invite(origin,ownerCookie,name,email=name.toLowerCase()+'@example.test'){
 const headers={Origin:origin,'Content-Type':'application/json',cookie:ownerCookie};
 const channels=await(await fetch(origin+'/api/conversations',{headers})).json();
 let channel=channels.find(c=>c.kind==='channel');
 if(!channel){const created=await fetch(origin+'/api/conversations',{method:'POST',headers,body:JSON.stringify({name:'Welcome',kind:'channel'})});assert.equal(created.status,200);channel=await created.json()}
 const prepared=await fetch(origin+'/api/team/invitations',{method:'POST',headers,body:JSON.stringify({email,role:'member',mode:'member',scopes:[channel.id]})});assert.equal(prepared.status,200,'explicit product invitation scope');
 const response=await fetch(origin+'/auth/invite',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',cookie:ownerCookie},body:JSON.stringify({email,displayName:name,role:'member',returnTo:'/app'})});assert.equal(response.status,202,'owner invitation');return signIn(origin,email,{requestLink:false});
}
// Browser follows the native form, then the synthetic mail transport's link.
// The person-facing flow never opens a captured-mail inbox.
export async function browserEmailSignIn(page,origin,email){
 await page.goto(origin+'/signin');await page.getByLabel('Email',{exact:true}).fill(email);
 await page.getByRole('button',{name:'Email a sign-in link',exact:true}).click();await page.waitForURL(url=>url.pathname==='/signin'&&url.searchParams.get('notice')==='sent');
 const listing=await(await fetch(origin+'/__dev/outbox',{headers:keyHeaders})).text(),article=listing.split('<article>').slice(1).find(row=>row.toLowerCase().includes(`to: ${email.toLowerCase()}</p>`));
 assert.ok(article,'synthetic mail addressed to the person');
 const message=article.match(/href="([^\"]*\?message=[^\"]+)"/),detail=await(await fetch(new URL(unescape(message[1]),origin),{headers:keyHeaders})).text(),link=detail.match(/href="([^\"]*\/auth\/confirm\?[^\"]+)"/);
 assert.ok(link,'synthetic mail confirmation');await page.goto(new URL(unescape(link[1]),origin).href);
 await page.getByRole('button',{name:'Confirm',exact:true}).click();await page.waitForURL(origin+'/app');await page.locator('.workspace#primary').waitFor();
}
export async function browserSignIn(page,origin,name){
 const owner=await signIn(origin,'nativeowner@example.test');await invite(origin,owner.cookie,name);
 await browserEmailSignIn(page,origin,name.toLowerCase()+'@example.test');
}
