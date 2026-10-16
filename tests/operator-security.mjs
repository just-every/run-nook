import assert from 'node:assert/strict';
import {signIn,invite} from './auth-support.mjs';
import {keyHeaders} from './dev-key.mjs'
export async function runOperatorSecurity({origin,owner,member,setupToken,request,post,get,sql,facts,check}){
 await check('operator-auth has no registration, unknown admission, preview-only GET/HEAD and single-use native confirmation',async()=>{
  await request('/api/register',{method:'POST',body:{name:'forbidden',password:'not-a-path'},status:401});await request('/api/login',{method:'POST',body:{name:'forbidden',password:'not-a-path'},status:401});
  const count=async()=>Number((await sql('SELECT COUNT(*) AS n FROM oa_operators'))[0].n),before=await count();
  await request('/auth/magic-link',{method:'POST',body:{email:'unknown@example.test'},status:202});assert.equal(await count(),before);
  await request('/auth/bootstrap',{method:'POST',body:{token:setupToken,displayName:'No second owner'},status:409});
  const result=await invite(origin,owner.cookie,'PendingSessionControl');assert.ok(result.user.id);
  const prior=await facts();await request('/auth/operator/status',{method:'POST',cookie:owner.cookie,body:{operatorId:result.user.id,status:'inactive'}});assert.deepEqual(await facts(),prior,'OA invalidation has no workspace revision');await get('/api/me',result.cookie,401);
  await request('/auth/operator/status',{method:'POST',cookie:owner.cookie,body:{operatorId:result.user.id,status:'active'}});await get('/api/me',result.cookie,401);
  const fresh=await signIn(origin,'pendingsessioncontrol@example.test',{productStatus:401});await get('/api/me',fresh.cookie,401);
  const initial=(await get('/api/conversations',owner.cookie)).data.find(c=>c.kind==='channel');await post('/api/team/access',{user:result.user.id,mode:'member',scopes:[initial.id]});fresh.user=(await get('/api/me',fresh.cookie)).data;
  const sessions=(await request('/auth/sessions?operatorId='+fresh.user.id,{cookie:owner.cookie})).data;const active=sessions.find(s=>s.active);assert.ok(active);await request('/auth/session/revoke',{method:'POST',cookie:owner.cookie,body:{sessionId:active.id},status:204});await get('/api/me',fresh.cookie,401);
 });
 await check('fresh access is refused for a working member and keeps DMs and private channels; an inactive member is regranted only the chosen channels',async()=>{
  const worker=await invite(origin,owner.cookie,'RegrantTarget'),id=worker.user.id;
  const channels=(await get('/api/conversations',owner.cookie)).data,welcome=channels.find(c=>c.kind==='channel');
  const secret=(await post('/api/conversations',{name:'Regrant private',kind:'private',participants:[id]})).data,other=await invite(origin,owner.cookie,'RegrantPeer');
  const dm=(await post('/api/conversations',{name:'Regrant DM',kind:'dm',participants:[other.user.id]},worker.cookie)).data;
  await post(`/api/conversations/${dm.id}/messages`,{body:'kept private bytes',intent:'regrant-dm'},worker.cookie);
  const memberships=async()=>(await sql(`SELECT conversation FROM nook_members WHERE user='${id}' ORDER BY conversation`)).map(r=>r.conversation),before=await memberships();
  assert.deepEqual(before,[welcome.id,secret.id,dm.id].sort());
  const refused=await post('/api/team/access',{user:id,mode:'member',scopes:[welcome.id]},owner.cookie,409);
  assert.match(refused.data.error??refused.raw,/already has access/);
  assert.deepEqual(await memberships(),before,'a refused fresh access changes nothing');
  assert.equal((await sql(`SELECT active FROM nook_access WHERE user='${id}'`))[0].active,1);
  await get(`/api/conversations/${dm.id}/messages`,worker.cookie);await get(`/api/conversations/${secret.id}/messages`,worker.cookie);
  await post('/auth/operator/status',{operatorId:id,status:'inactive'});await post('/auth/operator/status',{operatorId:id,status:'active'});
  assert.equal((await sql(`SELECT active FROM nook_access WHERE user='${id}'`))[0].active,0,'reactivation alone leaves product access off');
  await post('/api/team/access',{user:id,mode:'member',scopes:[welcome.id]});
  assert.deepEqual(await memberships(),[welcome.id],'inactive member is regranted exactly the chosen channels');
 });
 await check('workspace owner cannot read a member-only DM and retired captured-mail routes remain absent',async()=>{
  const second=await invite(origin,owner.cookie,'DmParticipant');const dm=(await post('/api/conversations',{name:'Members only',kind:'dm',participants:[second.user.id]},member.cookie)).data;
  await post(`/api/conversations/${dm.id}/messages`,{body:'Private member bytes',intent:'member-secret'},member.cookie);
  for(const path of [`/api/conversations/${dm.id}/messages`,`/api/conversations/${dm.id}/members`,`/api/conversations/${dm.id}/replay`,`/api/conversations/${dm.id}/outcomes`,`/api/conversations/${dm.id}/preferences`])await get(path,owner.cookie,403);
  await get(`/api/conversations/${dm.id}/messages`,second.cookie);
  await request('/__dev/outbox',{status:404});await request('/__dev/outbox',{status:404,extra:keyHeaders});await request('/__dev/outbox',{status:404,extra:{...keyHeaders,origin:'https://hostile.invalid'}});await request('/__dev/outbox',{status:404,extra:{...keyHeaders,'sec-fetch-site':'cross-site'}});
 });
}
