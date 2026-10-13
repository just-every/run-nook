import assert from 'node:assert/strict';
import {signIn} from './auth-support.mjs';
export const tinyPng=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=','base64');
// Called by the parent-owned finite local Worker harness; opens no processes.
export async function runTeamSurfaces({origin,ownerCookie}){
 const stamp=crypto.randomUUID().slice(0,8);
 async function call(path,{cookie=ownerCookie,method='GET',body,raw,headers={},status=200}={}){
  const response=await fetch(origin+path,{method,headers:{Origin:origin,...(cookie?{cookie}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{}),...headers},...(raw?{body:raw}:body!==undefined?{body:JSON.stringify(body)}:{})});
  assert.equal(response.status,status,`${method} ${path.split('?')[0]} status`);return response
 }
 const json=async(path,options)=>{const r=await call(path,options);return r.json()};
 const create=async(name,kind='channel',participants=[],cookie=ownerCookie)=>json('/api/conversations',{method:'POST',cookie,body:{name:name+' '+stamp,kind,participants}});
 const launch=await create('Launch'),review=await create('Client review','private'),publicOther=await create('Public directory');
 async function invite(name,mode,scopes){const email=`team-${name}-${stamp}@example.test`;await json('/api/team/invitations',{method:'POST',body:{email,role:'member',mode,scopes}});await call('/auth/invite',{method:'POST',body:{email,displayName:name,role:'member'},status:202});return {...await signIn(origin,email,{requestLink:false}),email}}
 const member=await invite('member','member',[launch.id]),guest=await invite('guest','guest',[review.id]),outsider=await invite('outsider','member',[publicOther.id]);
 const browse=await json('/api/channels',{cookie:member.cookie});assert.ok(browse.items.some(c=>c.id===publicOther.id));assert.ok(!browse.items.some(c=>c.id===review.id));
 await json(`/api/channels/${publicOther.id}/join`,{method:'POST',cookie:member.cookie,body:{}});await json(`/api/channels/${publicOther.id}/join`,{method:'POST',cookie:member.cookie,body:{}});
 await call('/api/channels',{cookie:guest.cookie,status:403});await call(`/api/channels/${launch.id}/join`,{method:'POST',cookie:guest.cookie,body:{},status:403});
 await call('/api/conversations',{method:'POST',cookie:guest.cookie,body:{name:'Guest escape',kind:'channel'},status:403});
 const privateDM=await create('Private DM','dm',[member.user.id],outsider.cookie);
 await call(`/api/conversations/${privateDM.id}/messages`,{cookie:ownerCookie,status:403});
 const message=await json(`/api/conversations/${launch.id}/messages`,{method:'POST',body:{body:'Team reaction and private preview',intent:crypto.randomUUID()}});
 const reactionPath=`/api/messages/${message.id}/reactions`;
 await json(reactionPath,{method:'POST',cookie:member.cookie,body:{emoji:'👍',add:true}});await json(reactionPath,{method:'POST',cookie:member.cookie,body:{emoji:'👍',add:true}});await json(reactionPath,{method:'POST',body:{emoji:'👍',add:true}});
 let reactions=await json(reactionPath,{cookie:member.cookie});assert.equal(reactions[0].actors.length,2);
 await json(reactionPath,{method:'POST',cookie:member.cookie,body:{emoji:'👍',add:false}});await json(reactionPath,{method:'POST',cookie:member.cookie,body:{emoji:'👍',add:false}});
 reactions=await json(reactionPath);assert.equal(reactions[0].actors.length,1);
 await call(reactionPath,{cookie:guest.cookie,status:403});await call(reactionPath,{method:'POST',cookie:outsider.cookie,body:{emoji:'👍',add:true},status:403});
 const image=await json(`/api/conversations/${launch.id}/attachments`,{method:'POST',raw:tinyPng,headers:{'Content-Type':'image/png','X-Filename':encodeURIComponent('Team preview.png'),'X-Upload-Intent':crypto.randomUUID()}});
 await json(`/api/conversations/${launch.id}/messages`,{method:'POST',body:{body:'Inline private image',intent:crypto.randomUUID(),attachments:[image.id]}});
 const inline=await call(`/api/attachments/${image.id}/preview`,{cookie:member.cookie});assert.equal(inline.headers.get('content-type'),'image/png');assert.equal(inline.headers.get('x-content-type-options'),'nosniff');assert.match(inline.headers.get('cache-control'),/no-store/);assert.deepEqual(Buffer.from(await inline.arrayBuffer()),tinyPng);
 await call(`/api/attachments/${image.id}/preview`,{cookie:guest.cookie,status:404});
 const another=await signIn(origin,member.email);
 await json('/auth/operator/status',{method:'POST',body:{operatorId:member.user.id,status:'inactive'}});
 for(const cookie of [member.cookie,another.cookie])for(const path of ['/auth/session','/api/me',reactionPath,`/api/attachments/${image.id}/preview`])await call(path,{cookie,status:401});
 await json('/auth/operator/status',{method:'POST',body:{operatorId:member.user.id,status:'active'}});
 for(const cookie of [member.cookie,another.cookie])await call('/auth/session',{cookie,status:401});
 return {checks:['actual prepared Base invitation and one-use confirmation','public unjoined browse and idempotent join','guest and unrelated owner DM denials','exact reaction add/remove retries and participant counts','private R2 PNG preview and current ACL','two-session deactivation and nonreviving reactivation'],member,guest,outsider,launch,review,image};
}
