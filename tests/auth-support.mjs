import assert from 'node:assert/strict';
import {confirmationLink} from './mail-edge.mjs';
const unescape=text=>text.replaceAll('&amp;','&').replaceAll('&#39;',"'").replaceAll('&quot;','"');
const mailboxes=new Map();
export async function signIn(origin,email,options={}){
 const key=origin+email.toLowerCase(),before=mailboxes.get(key)??Promise.resolve();
 const next=before.catch(()=>{}).then(()=>consumeLink(origin,email,options));mailboxes.set(key,next);
 try{return await next}catch(error){if(error?.name==='AssertionError')throw error;throw Error('Native email confirmation failed; credential-bearing diagnostics withheld')}finally{if(mailboxes.get(key)===next)mailboxes.delete(key)}
}
async function consumeLink(origin,email,{requestLink=true,productStatus=200}={}){
 if(requestLink){const r=await fetch(origin+'/auth/magic-link',{method:'POST',headers:{Connection:'close',Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email,returnTo:'/app'})});assert.equal(r.status,202,'ordinary sign-in request')}
 const url=confirmationLink(origin,email);const preview=await fetch(url);assert.equal(preview.status,200);assert.equal(preview.headers.has('set-cookie'),false);
 const head=await fetch(url,{method:'HEAD'});assert.equal(head.status,200);assert.equal(head.headers.has('set-cookie'),false);
 const form=await preview.text(),token=form.match(/name="token" value="([^\"]+)"/)?.[1];assert.ok(token,'native confirmation form token');
 const completed=await fetch(origin+'/auth/confirm',{method:'POST',redirect:'manual',headers:{Connection:'close',Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token:unescape(token)})});assert.equal(completed.status,303,'native POST confirmation');
 const replay=await fetch(origin+'/auth/confirm',{method:'POST',redirect:'manual',headers:{Connection:'close',Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token:unescape(token)})});assert.equal(replay.status,400,'confirmation is single use');
 const cookie=completed.headers.get('set-cookie').split(';')[0];const me=await fetch(origin+'/api/me',{headers:{Connection:'close',cookie}});assert.equal(me.status,productStatus);return {cookie,user:productStatus===200?await me.json():null};
}
export async function invite(origin,ownerCookie,name,email=name.toLowerCase()+'@example.test'){
 const headers={Connection:'close',Origin:origin,'Content-Type':'application/json',cookie:ownerCookie};
 const channels=await(await fetch(origin+'/api/conversations',{headers})).json();
 let channel=channels.find(c=>c.kind==='channel'&&!c.archived);
 if(!channel){const created=await fetch(origin+'/api/conversations',{method:'POST',headers,body:JSON.stringify({name:'Welcome',kind:'channel'})});assert.equal(created.status,200);channel=await created.json()}
 const prepared=await fetch(origin+'/api/team/invitations',{method:'POST',headers,body:JSON.stringify({email,role:'member',mode:'member',scopes:[channel.id]})});assert.equal(prepared.status,200,'explicit product invitation scope');
 const response=await fetch(origin+'/auth/invite',{method:'POST',headers:{Connection:'close',Origin:origin,'Content-Type':'application/json',cookie:ownerCookie},body:JSON.stringify({email,displayName:name,role:'member',returnTo:'/app'})});assert.equal(response.status,202,'owner invitation');return signIn(origin,email,{requestLink:false});
}
// Browser follows the native form, then the synthetic mail transport's link.
// The person-facing flow never opens a captured-mail inbox.
export async function browserEmailSignIn(page,origin,email){
 await page.goto(origin+'/signin');await page.getByLabel('Email',{exact:true}).fill(email);
 await page.getByRole('button',{name:'Email a sign-in link',exact:true}).click();await page.waitForURL(url=>url.pathname==='/signin'&&url.searchParams.get('notice')==='sent');
 try{await page.goto(confirmationLink(origin,email).href)}catch{throw Error('Native email confirmation preview failed; credential-bearing browser diagnostics withheld')}
 await page.getByRole('button',{name:'Confirm',exact:true}).click();await page.waitForURL(origin+'/app');await page.locator('.workspace#primary').waitFor();
}
export async function browserSignIn(page,origin,name){
 const owner=await signIn(origin,'nativeowner@example.test');await invite(origin,owner.cookie,name);
 await browserEmailSignIn(page,origin,name.toLowerCase()+'@example.test');
}
