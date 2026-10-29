/** Native invitation and confirmation using Base's recipient-scoped mailbox. */
const mailboxes=new Map();
// A native role change invalidates the old person session. Re-enter through
// ordinary email confirmation before testing the person's new approval rights.
export async function signIn({request,origin,email}){
 const mail=mailboxes.get(email);if(!mail)throw new Error('Native teammate mailbox unavailable');
 const since=Date.now(),headers={Origin:origin,'Content-Type':'application/json'};
 const requested=await request(new URL('/auth/magic-link',origin).href,{method:'POST',headers,body:JSON.stringify({email,returnTo:'/app'})});
 if(requested.status!==202)throw new Error('Native teammate sign-in request failed');await requested.body?.cancel();
 const messages=mail.read({after:since,limit:20}).filter(message=>message.text.includes('/auth/confirm'));
 if(!messages.length)throw new Error('Native teammate sign-in mail unavailable');
 const link=new URL(messages.at(-1).text.match(/https:\/\/[^\s]+/)[0]);
 if(link.origin!==origin||link.pathname!=='/auth/confirm')throw new Error('Invalid native sign-in link');
 const accepted=await request(new URL('/auth/confirm',origin).href,{method:'POST',redirect:'manual',headers,body:JSON.stringify({token:link.searchParams.get('token')})});
 if(accepted.status!==303)throw new Error('Native teammate sign-in confirmation failed');
 const cookie=accepted.headers.getSetCookie().map(value=>value.split(';',1)[0]).join('; ');await accepted.body?.cancel();return cookie;
}
export const closeMailboxes=()=>mailboxes.clear();
export default async function initialize({request,origin,email,owner,mail,label}){
 const call=(path,body,cookie)=>request(new URL(path,origin).href,{method:body===undefined?'GET':'POST',redirect:'manual',headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const channels=await (await call('/api/conversations',undefined,owner.cookie)).json();
 const channel=channels.find(room=>room.name==='Verification welcome');
 if(!channel)throw new Error('Native welcome channel unavailable');
 const prepared=await call('/api/team/invitations',{email,role:'member',mode:'member',scopes:[channel.id]},owner.cookie);
 console.log('NOOK-AGENT native invitation preparation HTTP='+prepared.status);
 if(!prepared.ok)throw new Error('Native scoped invitation preparation failed');
 const since=Date.now();
 const invited=await call('/auth/invite',{email,displayName:label==='teammate'?'Ari Teammate':'Rowan Teammate',role:'member',returnTo:'/app'},owner.cookie);
 console.log('NOOK-AGENT native invitation delivery HTTP='+invited.status);
 if(invited.status!==202)throw new Error('Native invitation send failed');
 await invited.body?.cancel();
 const invitations=mail.read({after:since,limit:20}).filter(message=>message.text.includes('/auth/confirm'));
 console.log('NOOK-AGENT captured teammate invitation count='+invitations.length);
 if(!invitations.length)throw new Error('Native teammate invitation unavailable');
 const link=new URL(invitations.at(-1).text.match(/https:\/\/[^\s]+/)[0]);
 if(link.origin!==origin||link.pathname!=='/auth/confirm')throw new Error('Invalid native invitation link');
 const accepted=await call('/auth/confirm',{token:link.searchParams.get('token')});
 console.log('NOOK-AGENT native teammate confirmation HTTP='+accepted.status);
 if(accepted.status!==303)throw new Error('Native invitation confirmation failed');
 mailboxes.set(email,mail);
 return accepted;
}
