/** Native invitation and confirmation using Base's recipient-scoped mailbox. */
export default async function initialize({request,origin,email,owner,mail}){
 const call=(path,body,cookie)=>request(new URL(path,origin).href,{method:body===undefined?'GET':'POST',redirect:'manual',headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const channels=await (await call('/api/conversations',undefined,owner.cookie)).json();
 const channel=channels.find(room=>room.name==='Verification welcome');
 if(!channel)throw new Error('Native welcome channel unavailable');
 const prepared=await call('/api/team/invitations',{email,role:'member',mode:'member',scopes:[channel.id]},owner.cookie);
 console.log('NOOK-AGENT native invitation preparation HTTP='+prepared.status);
 if(!prepared.ok)throw new Error('Native scoped invitation preparation failed');
 const since=Date.now();
 const invited=await call('/auth/invite',{email,displayName:'Ari Teammate',role:'member',returnTo:'/app'},owner.cookie);
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
 return accepted;
}
