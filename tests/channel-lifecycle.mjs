import assert from 'node:assert/strict'
import {signIn} from './auth-support.mjs'

export async function channelLifecycleJourney(h){
 const {post,patch,get,registered,check}=h
 const a=await registered('ChannelManager'),b=await registered('ChannelColleague'),x=await registered('ChannelOutside')
 const details=async(id,actor=a)=>(await get(`/api/channels/${id}/details`,actor.cookie)).data
 const publicRoom=(await post('/api/conversations',{name:'Launch operations',kind:'channel',participants:[b.user.id]},a.cookie)).data
 const privateRoom=(await post('/api/conversations',{name:'Leadership handoff',kind:'private',participants:[b.user.id]},a.cookie)).data
 await check('NOOK-016 public/private leave, current access and manager transfer preserve history',async()=>{
  const message=(await post(`/api/conversations/${publicRoom.id}/messages`,{body:'The rollout checklist stays with the team',intent:crypto.randomUUID()},a.cookie)).data
  await post(`/api/channels/${privateRoom.id}/leave`,{version:(await details(privateRoom.id)).version},a.cookie,409)
  const transfer=await details(privateRoom.id)
  await post(`/api/channels/${privateRoom.id}/transfer`,{version:transfer.version,user:b.user.id},a.cookie)
  await post(`/api/channels/${privateRoom.id}/leave`,{version:(await details(privateRoom.id)).version},a.cookie)
  assert.ok(!(await get('/api/conversations',a.cookie)).data.some(c=>c.id===privateRoom.id))
  await get(`/api/conversations/${privateRoom.id}/messages`,a.cookie,403)
  await post(`/api/channels/${privateRoom.id}/join`,{},a.cookie,404)
  await post(`/api/conversations/${privateRoom.id}/members`,{user:a.user.id},b.cookie)
  assert.equal((await details(privateRoom.id,b)).manager,b.user.id)
  await post(`/api/channels/${publicRoom.id}/leave`,{version:(await details(publicRoom.id,b)).version},b.cookie)
  await get(`/api/conversations/${publicRoom.id}/messages`,b.cookie,403)
  assert.ok(!(await get('/api/attention',b.cookie)).data.items.some(i=>i.conversation===publicRoom.id))
  await post(`/api/channels/${publicRoom.id}/join`,{},b.cookie)
  assert.ok((await get(`/api/conversations/${publicRoom.id}/messages`,b.cookie)).data.some(m=>m.id===message.id&&m.body===message.body))
  await get(`/api/channels/${privateRoom.id}/details`,x.cookie,403)
  await post(`/api/conversations/${privateRoom.id}/members`,{user:h.owner.user.id},b.cookie)
  await post(`/api/conversations/${privateRoom.id}/members`,{user:b.user.id,remove:true})
  const vacated=(await get(`/api/channels/${privateRoom.id}/details`)).data
  assert.equal(vacated.manager,null);assert.equal(vacated.canManage,true);assert.equal(vacated.canLeave,false)
  await post(`/api/channels/${privateRoom.id}/leave`,{version:vacated.version},h.owner.cookie,409)
  await post(`/api/channels/${privateRoom.id}/transfer`,{version:vacated.version,user:a.user.id})
  await post(`/api/channels/${privateRoom.id}/leave`,{version:(await get(`/api/channels/${privateRoom.id}/details`)).data.version})
  const dm=(await post('/api/conversations',{name:'Fixed participants',kind:'dm',participants:[b.user.id]},a.cookie)).data
  await post(`/api/channels/${dm.id}/leave`,{version:1},a.cookie,403)
 })
 await check('NOOK-060 versioned channel details, archive/restore and archived write refusal',async()=>{
  const before=await details(publicRoom.id)
  await patch(`/api/channels/${publicRoom.id}`,{version:before.version,name:'Launch readiness',topic:'Support handoff and rollout windows'},a.cookie)
  await patch(`/api/channels/${publicRoom.id}`,{version:before.version,topic:'Stale overwrite'},a.cookie,409)
  const changed=await details(publicRoom.id)
  assert.equal(changed.name,'Launch readiness');assert.equal(changed.topic,'Support handoff and rollout windows')
  const payload={body:'A durable message before archive',intent:crypto.randomUUID()},message=(await post(`/api/conversations/${publicRoom.id}/messages`,payload,a.cookie)).data
  await post(`/api/channels/${publicRoom.id}/archive`,{version:changed.version,archived:true},a.cookie)
  const frontier=(await get(`/api/conversations/${publicRoom.id}/replay`,a.cookie)).data.frontier
  await post(`/api/conversations/${publicRoom.id}/messages`,{body:'Refused after archive',intent:crypto.randomUUID()},b.cookie,409)
  await post(`/api/conversations/${publicRoom.id}/messages`,{body:'Refused thread reply',parent:message.id,intent:crypto.randomUUID()},b.cookie,409)
  await patch(`/api/messages/${message.id}`,{version:1,body:'Refused edit'},a.cookie,409)
  await post(`/api/messages/${message.id}/reactions`,{emoji:'👍',add:true},b.cookie,409)
  assert.equal((await get(`/api/conversations/${publicRoom.id}/replay`,a.cookie)).data.frontier,frontier,'refused archive writes produce no event')
  assert.equal((await post(`/api/conversations/${publicRoom.id}/messages`,payload,a.cookie)).data.id,message.id,'committed intents still reconcile')
  assert.ok((await get(`/api/conversations/${publicRoom.id}/messages`,b.cookie)).data.some(m=>m.id===message.id))
  // An archived public channel can have an empty audience without trapping
  // its last manager. Public discovery remains the way back to read history.
  for(const actor of [b,a])await post(`/api/channels/${publicRoom.id}/leave`,{version:(await details(publicRoom.id,actor)).version},actor.cookie)
  await get(`/api/conversations/${publicRoom.id}/messages`,a.cookie,403)
  const directory=(await get('/api/channels',x.cookie)).data
  assert.ok(directory.items.some(channel=>channel.id===publicRoom.id&&channel.archived))
  await post(`/api/channels/${publicRoom.id}/join`,{},x.cookie)
  assert.ok((await get(`/api/conversations/${publicRoom.id}/messages`,x.cookie)).data.some(m=>m.id===message.id))
  await post(`/api/conversations/${publicRoom.id}/messages`,{body:'Joining history does not restore posting',intent:crypto.randomUUID()},x.cookie,409)
  await post(`/api/channels/${publicRoom.id}/leave`,{version:(await details(publicRoom.id,x)).version},x.cookie)
  await post(`/api/channels/${publicRoom.id}/join`,{})
  const archived=(await get(`/api/channels/${publicRoom.id}/details`)).data
  await post(`/api/channels/${publicRoom.id}/archive`,{version:archived.version,archived:false})
  await post(`/api/channels/${publicRoom.id}/join`,{},b.cookie)
  await post(`/api/conversations/${publicRoom.id}/messages`,{body:'Posting resumes after restore',intent:crypto.randomUUID()},b.cookie)
 })
 await defaultChannelsJourney(h)
}
export async function defaultChannelsJourney({post,patch,get,registered,check,owner,origin}){
 await check('NOOK-016/060 new-member defaults, mandatory leave, scoped authority and explicit readmission',async()=>{
  const existing=await registered('DefaultExisting'),policyPath='/api/team/default-channels';
  const one=(await post('/api/conversations',{name:'Announcements default',kind:'channel'})).data;
  const two=(await post('/api/conversations',{name:'Welcome default',kind:'channel'})).data;
  const privateRoom=(await post('/api/conversations',{name:'Selected invitation access',kind:'private'})).data;
  const initial=(await get(policyPath)).data;
  await patch(policyPath,{version:initial.version,channels:[{id:privateRoom.id,mandatory:false}]},owner.cookie,400);
  const choices=[{id:one.id,mandatory:true},{id:two.id,mandatory:false}];
  let policy=(await patch(policyPath,{version:initial.version,channels:choices})).data;
  await patch(policyPath,{version:initial.version,channels:[]},owner.cookie,409);
  assert.ok(!policy.channels.some(channel=>channel.id===privateRoom.id));
  assert.ok(!(await get('/api/conversations',existing.cookie)).data.some(channel=>channel.id===one.id||channel.id===two.id));
  const newcomer=await registered('DefaultNewcomer');
  const joined=(await get('/api/conversations',newcomer.cookie)).data;
  assert.ok(joined.some(channel=>channel.id===one.id)&&joined.some(channel=>channel.id===two.id));
  await get(policyPath,newcomer.cookie,403);
  await patch(policyPath,{version:policy.version,channels:[]},newcomer.cookie,403);
  const mandatory=(await get(`/api/channels/${one.id}/details`,newcomer.cookie)).data;
  assert.equal(mandatory.canLeave,false);
  await post(`/api/channels/${one.id}/leave`,{version:mandatory.version},newcomer.cookie,409);
  await post(`/api/channels/${one.id}/archive`,{version:(await get(`/api/channels/${one.id}/details`)).data.version,archived:true},owner.cookie,409);
  const loose=(await get(`/api/channels/${two.id}/details`,newcomer.cookie)).data;
  await post(`/api/channels/${two.id}/leave`,{version:loose.version},newcomer.cookie);
  const again=await signIn(origin(),'defaultnewcomer@example.test');
  assert.ok(!(await get('/api/conversations',again.cookie)).data.some(channel=>channel.id===two.id));
  async function inviteRole(email,role,mode){
   await post('/api/team/invitations',{email,role,mode,scopes:[privateRoom.id]});
   await post('/auth/invite',{email,role,displayName:email.split('@')[0]},owner.cookie,202);
   return signIn(origin(),email,{requestLink:false});
  }
  const guest=await inviteRole('defaultguest@example.test','member','guest');
  assert.deepEqual((await get('/api/conversations',guest.cookie)).data.map(channel=>channel.id),[privateRoom.id]);
  await get(policyPath,guest.cookie,403);
  const admin=await inviteRole('defaultadmin@example.test','admin','member');
  policy=(await get(policyPath,admin.cookie)).data;
  await patch(policyPath,{version:policy.version,channels:[{id:one.id,mandatory:false}]},admin.cookie,403);
  policy=(await patch(policyPath,{version:policy.version,channels:[choices[0]]},admin.cookie)).data;
  assert.ok(policy.history.some(action=>action.actor===admin.user.id&&action.conversation===two.id&&!action.enabled));
  assert.ok(policy.history.every(action=>!('body'in action)));
  await post('/auth/operator/status',{operatorId:newcomer.user.id,status:'inactive'});
  await post('/auth/operator/status',{operatorId:newcomer.user.id,status:'active'});
  const denied=await signIn(origin(),'defaultnewcomer@example.test',{productStatus:401});
  await get('/api/conversations',denied.cookie,401);
  await post('/api/team/access',{user:newcomer.user.id,mode:'member',scopes:[privateRoom.id]});
  const restored=await signIn(origin(),'defaultnewcomer@example.test');
  assert.deepEqual((await get('/api/conversations',restored.cookie)).data.map(channel=>channel.id),[privateRoom.id]);
  await patch(policyPath,{version:policy.version,channels:[]});
  const archivable=(await get(`/api/channels/${one.id}/details`)).data;
  await post(`/api/channels/${one.id}/archive`,{version:archivable.version,archived:true});
 });
}
