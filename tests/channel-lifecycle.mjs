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
  await patch(`/api/channels/${publicRoom.id}`,{version:before.version,name:'Launch readiness',topic:'Support handoff and rollout windows',description:'Synthetic channel description'},a.cookie)
  await patch(`/api/channels/${publicRoom.id}`,{version:before.version,topic:'Stale overwrite'},a.cookie,409)
  const changed=await details(publicRoom.id)
  assert.equal(changed.name,'Launch readiness');assert.equal(changed.topic,'Support handoff and rollout windows');assert.equal(changed.description,'Synthetic channel description')
  await patch(`/api/channels/${publicRoom.id}`,{version:changed.version,description:'Non-manager overwrite'},b.cookie,403)
  await patch(`/api/channels/${publicRoom.id}`,{version:changed.version,description:'x'.repeat(2001)},a.cookie,400)
  const actions=await h.sql(`SELECT count(*) AS n FROM nook_audit WHERE kind='channel.update' AND scope='${publicRoom.id}'`);assert.equal(actions[0].n,1)
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
  assert.ok(directory.items.some(channel=>channel.id===publicRoom.id&&channel.archived&&channel.description==='Synthetic channel description'))
  await post(`/api/channels/${publicRoom.id}/join`,{},x.cookie)
  assert.ok((await get(`/api/conversations/${publicRoom.id}/messages`,x.cookie)).data.some(m=>m.id===message.id))
  await post(`/api/conversations/${publicRoom.id}/messages`,{body:'Joining history does not restore posting',intent:crypto.randomUUID()},x.cookie,409)
  await post(`/api/channels/${publicRoom.id}/leave`,{version:(await details(publicRoom.id,x)).version},x.cookie)
  await post(`/api/channels/${publicRoom.id}/join`,{})
  const archived=(await get(`/api/channels/${publicRoom.id}/details`)).data;assert.equal(archived.description,'Synthetic channel description')
  await post(`/api/channels/${publicRoom.id}/archive`,{version:archived.version,archived:false})
  await post(`/api/channels/${publicRoom.id}/join`,{},b.cookie)
  await post(`/api/conversations/${publicRoom.id}/messages`,{body:'Posting resumes after restore',intent:crypto.randomUUID()},b.cookie)
 })
 await workspaceChannelPolicyJourney(h,a,publicRoom)
 await publicChannelJourney(h,a,b,x)
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

async function workspaceChannelPolicyJourney(h,manager,describedRoom){
 const {post,patch,get,registered,check,sql,owner}=h
 await check('NOOK-060 owner channel policy fences create and archive with no refused effects',async()=>{
  const admin=await registered('synthetic-nook-960'),guest=await registered('synthetic-nook-961')
  await sql(`UPDATE oa_operators SET role='admin' WHERE id='${admin.user.id}'`);Object.assign(admin,await signIn(h.origin(),'synthetic-nook-960@example.test'))
  await sql(`UPDATE nook_access SET mode='guest' WHERE user='${guest.user.id}'`);await sql(`INSERT INTO nook_guest_grants SELECT user,conversation FROM nook_members WHERE user='${guest.user.id}'`)
  const room=(await post('/api/conversations',{name:'Synthetic channel policy',kind:'private',participants:[owner.user.id,admin.user.id]},manager.cookie)).data
  await post(`/api/conversations/${describedRoom.id}/members`,{user:admin.user.id});const described=(await get(`/api/channels/${describedRoom.id}/details`)).data;await patch(`/api/channels/${describedRoom.id}`,{version:described.version,description:'Synthetic non-manager admin overwrite'},admin.cookie,403)
  const path='/api/team/workspace-policy',initial=(await get(path)).data
  assert.equal(initial.canManage,true);assert.equal((await get(path,admin.cookie)).data.canManage,false)
  for(const actor of [manager,guest])await get(path,actor.cookie,403)
  const restrictive={version:initial.version,create_public:'owners',create_private:'owners',archive:'owners'}
  for(const actor of [manager,guest,admin])await patch(path,restrictive,actor.cookie,403)
  const beforePolicy=(await sql("SELECT count(*) AS n FROM nook_audit WHERE kind='policy.channels'"))[0].n
  let policy=(await patch(path,restrictive)).data
  assert.equal((await sql("SELECT count(*) AS n FROM nook_audit WHERE kind='policy.channels'"))[0].n,beforePolicy+1)
  await patch(path,restrictive,owner.cookie,409)
  const facts=async()=> (await sql('SELECT (SELECT count(*) FROM nook_conversations) AS conversations,(SELECT count(*) FROM nook_members) AS members,(SELECT count(*) FROM nook_events) AS events,(SELECT count(*) FROM nook_audit) AS audits'))[0]
  const before=await facts(),version=(await get(`/api/channels/${room.id}/details`)).data.version
  for(const actor of [manager,admin]){
   for(const kind of ['channel','private']){const refused=await post('/api/conversations',{name:'Synthetic refused policy create',kind},actor.cookie,403);assert.match(refused.data.error,/Workspace channel policy/)}
   const refused=await post(`/api/channels/${room.id}/archive`,{version,archived:true},actor.cookie,403);assert.match(refused.data.error,/Workspace channel policy/)
  }
  assert.deepEqual(await facts(),before)
  assert.equal((await get(`/api/channels/${room.id}/details`)).data.archived,false)
  await post('/api/conversations',{name:'Synthetic owner policy create',kind:'private'})
  policy=(await patch(path,{version:policy.version,create_public:'admins',create_private:'owners',archive:'admins'})).data
  await post('/api/conversations',{name:'Synthetic admin policy create',kind:'channel'},admin.cookie)
  await post(`/api/channels/${room.id}/archive`,{version,archived:true},admin.cookie)
  await post(`/api/channels/${room.id}/archive`,{version:(await get(`/api/channels/${room.id}/details`)).data.version,archived:false})
  const exportPolicy=(await get('/api/readable-exports/policy')).data
  await post('/api/readable-exports/policy',{version:exportPolicy.version,enabled:true})
  let job=(await post('/api/readable-exports',{scope:'workspace',custodyAccepted:true})).data
  for(let n=0;!job.complete&&n<150;n++)job=(await post(`/api/readable-exports/${job.id}/step`,{})).data
  assert.equal(job.complete,true)
  let exported,description
  for(let index=0;index<job.pages;index++){const page=(await get(`/api/readable-exports/${job.id}/pages/${index}`)).data;for(const row of page.records??[]){if(row.type==='workspace_channel_policy')exported=row;if(row.type==='conversations'&&row.data.id===describedRoom.id)description=row.data.description}}
  assert.ok(exported,'readable workspace exit carries channel policy');assert.equal(exported.data.create_public,'admins');assert.equal(exported.data.create_private,'owners');assert.equal(exported.data.archive,'admins');assert.equal(description,'Synthetic channel description')
  policy=(await patch(path,{version:policy.version,create_public:'members',create_private:'members',archive:'members'})).data
  for(const kind of ['channel','private'])await post('/api/conversations',{name:'Synthetic full member policy create',kind},manager.cookie)
  await post(`/api/channels/${room.id}/archive`,{version:(await get(`/api/channels/${room.id}/details`)).data.version,archived:true},manager.cookie)
  await post(`/api/channels/${room.id}/archive`,{version:(await get(`/api/channels/${room.id}/details`)).data.version,archived:false})
  await h.validateArchive()
 })
}

async function publicChannelJourney(h,manager,member,outsider){
 const {post,patch,get,sql,check}=h
 await check('NOOK-060 private channel conversion confirms current history and preserves custody',async()=>{
  const room=(await post('/api/conversations',{name:'Synthetic public conversion',kind:'private',participants:[member.user.id]},manager.cookie)).data,path=`/api/channels/${room.id}`
  const send=async(body,parent,attachments=[])=>(await post(`/api/conversations/${room.id}/messages`,{body,parent,attachments,intent:crypto.randomUUID()},manager.cookie)).data
  const file=(await post(`/api/conversations/${room.id}/attachments`,{name:'synthetic-nook-history.txt',mime:'text/plain',data:Buffer.from('Synthetic history').toString('base64'),intent:crypto.randomUUID()},manager.cookie)).data
  const root=await send('Synthetic root',null,[file.id]);await send('Synthetic reply',root.id)
  const erased=await send('Synthetic erased history',null);await patch(`/api/messages/${erased.id}`,{version:1,delete:true},manager.cookie)
  const preview=async()=>(await get(path+'/public-preview',manager.cookie)).data
  let p=await preview();assert.equal(p.messages,2);assert.equal(p.files,1);assert.equal(p.earliest,root.created);assert.ok(p.audience>=3);assert.ok(p.gainingAccess>=1)
  await get(path+'/public-preview',member.cookie,403);await get(path+'/public-preview',outsider.cookie,403)
  const dm=(await post('/api/conversations',{name:'Synthetic conversion DM',kind:'dm',participants:[member.user.id]},manager.cookie)).data;await get(`/api/channels/${dm.id}/public-preview`,manager.cookie,403)
  const facts=async()=>(await sql(`SELECT kind,version,seq,(SELECT count(*) FROM nook_audit WHERE kind='channel.public' AND scope='${room.id}') AS audits FROM nook_conversations WHERE id='${room.id}'`))[0]
  const before=await facts();await post(path+'/make-public',{preview:p.version},manager.cookie,400);await post(path+'/make-public',{preview:p.version,confirmed:false},manager.cookie,400);await post(path+'/make-public',{preview:p.version,confirmed:true},member.cookie,403);assert.deepEqual(await facts(),before)
  await send('Synthetic new history',null);await post(path+'/make-public',{preview:p.version,confirmed:true},manager.cookie,409)
  p=await preview();await post(`/api/conversations/${room.id}/members`,{user:outsider.user.id},manager.cookie);await post(path+'/make-public',{preview:p.version,confirmed:true},manager.cookie,409)
  await sql(`INSERT INTO nook_retained_message_bodies VALUES('${erased.id}','Synthetic retained custody','synthetic retained custody')`);await get(path+'/public-preview',manager.cookie,409);assert.equal((await sql(`SELECT body FROM nook_retained_message_bodies WHERE id='${erased.id}'`))[0].body,'Synthetic retained custody');await sql(`DELETE FROM nook_retained_message_bodies WHERE id='${erased.id}'`)
  const erasureBefore=await sql(`SELECT * FROM nook_erased_messages WHERE id='${erased.id}'`),members=await sql(`SELECT user FROM nook_members WHERE conversation='${room.id}' ORDER BY user`)
  p=await preview();assert.equal(p.messages,3);const converted=(await post(path+'/make-public',{preview:p.version,confirmed:true},manager.cookie)).data;assert.equal(converted.kind,'channel')
  assert.deepEqual(await sql(`SELECT user FROM nook_members WHERE conversation='${room.id}' ORDER BY user`),members);assert.deepEqual(await sql(`SELECT * FROM nook_erased_messages WHERE id='${erased.id}'`),erasureBefore)
  const history=(await get(`/api/conversations/${room.id}/messages`,manager.cookie)).data;assert.equal(history.filter(m=>!m.deleted).length,p.messages+1);assert.equal(history.filter(m=>m.body.startsWith('System notice: This channel is now public.')).length,1);assert.equal(history.filter(m=>!m.deleted).flatMap(m=>m.attachments).length,p.files);assert.equal((await facts()).audits,1)
  await post(path+'/make-public',{preview:p.version,confirmed:true},manager.cookie,403)
  await h.validateArchive()
 })
}
