/** Disposable verification only. Provision every person through native HTTP. */
export default async function initialize({request,origin,email,claim,displayName,reviewers}){
 const headers={'Origin':origin,'Content-Type':'application/json'};
 const call=(path,body,cookie)=>request(new URL(path,origin).href,{method:body===undefined?'GET':'POST',redirect:'manual',headers:{...headers,...(cookie?{Cookie:cookie}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const owner=await call(claim.path,{token:claim.token,displayName,returnTo:'/app'});
 console.log('NOOK-AGENT native signed claim HTTP='+owner.status);
 if(owner.status!==303)throw new Error('Native signed owner claim failed');
 const cookie=owner.headers.getSetCookie().map(value=>value.split(';',1)[0]).join('; ');
 const channelResponse=await call('/api/conversations',{name:'Verification welcome',kind:'channel'},cookie);
 console.log('NOOK-AGENT native channel creation HTTP='+channelResponse.status);
 if(!channelResponse.ok)throw new Error('Native channel setup failed');
 const channel=await channelResponse.json();
 const teammate=await reviewers.initialize('teammate',{cookie});
 const me=await (await call('/api/me',undefined,cookie)).json();
 const sent=await call(`/api/conversations/${channel.id}/messages`,{body:'Ari asks the owner to inspect the launch note.',intent:'verification-attention',mentions:[me.id]},teammate.cookie);
 if(!sent.ok)throw new Error('Native attention setup failed');
 return owner;
}
