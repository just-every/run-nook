import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {installation} from './push/fixture.mjs';
import {createPortability,readArchive} from '@runeditrun/rer/modules/portability';
import {productPolicy} from '../src/platform/portability-policy.mjs';
import {migrationHistory} from './migration-history.mjs';

// One installed-chat-app journey through public routes. Only the Worker clock is
// injected; signatures, current authority, D1 transactions and audit are real.
export async function publicAppJourney(){
 const now=Date.UTC(2030,0,2,12),timestamp=String(now/1000),secret='synthetic-nook-190';
 const app=await installation(async()=>assert.fail('public app requests make no outbound call'),{now});let restored;
 const {call,ownerCookie,db,origin}=app;
 const snapshot=()=>db.prepare('SELECT (SELECT count(*) FROM nook_messages) AS messages,(SELECT total(version) FROM nook_messages) AS versions,(SELECT count(*) FROM nook_events) AS events,(SELECT count(*) FROM nook_audit) AS audit,(SELECT count(*) FROM nook_notification_requests) AS receipts').first();
 const signed=(approval,door,payload,{stamp=timestamp,key=secret,unsigned=false,form=door==='interactivity'}={})=>{
  const body=form?new URLSearchParams({payload:JSON.stringify(payload)}).toString():JSON.stringify(payload);
  return ()=>fetch(`${origin}/hooks/slack/${approval.id}/${door}`,{method:'POST',headers:{'content-type':form?'application/x-www-form-urlencoded':'application/json',...(unsigned?{}:{'x-slack-request-timestamp':stamp,'x-slack-signature':'v0='+createHmac('sha256',key).update('v0:'+stamp+':'+body).digest('hex')})},body});
 };
 const refused=async(request,status)=>{const before=await snapshot(),response=await request();assert.equal(response.status,status,await response.clone().text());assert.equal((await response.json()).ok,false);assert.deepEqual(await snapshot(),before,'refused public request changes no message, version, event, audit or replay receipt')};
 const accepted=async request=>{const response=await request();assert.equal(response.status,200,await response.clone().text());const result=await response.json();assert.equal(result.ok,true);return result.message};
 const read=async(approval,channel,options={})=>{
  const response=await fetch(origin+'/api/slack/'+(options.method??'conversations.history')+'?'+new URLSearchParams({channel,...options.args}),{headers:{authorization:'Bearer '+approval.token}});
  assert.equal(response.status,200);return response.json();
 };
 try{
  const room=await call('/api/conversations','POST',{name:'Public app review',kind:'private'},ownerCookie);
  const other=await call('/api/conversations','POST',{name:'Unapproved review',kind:'private'},ownerCookie);
  const email='synthetic-nook-90'+'@dev.localhost';
  await call('/api/team/invitations','POST',{email,role:'admin',mode:'member',scopes:[room.id]},ownerCookie);
  await call('/auth/invite','POST',{email,displayName:'App installer',role:'admin'},ownerCookie,202);
  const installer=await app.signIn(email);
  const approve=async(name,cookie=installer.cookie,extras={})=>(await call('/api/notification-apps','POST',{name,channels:[room.id],messageReads:true,interactivity:true,signingSecret:secret,...extras},cookie)).approvals[0];
  const replaced=await approve('Review helper'),grant=await approve('Review helper');
  assert.deepEqual(await read(replaced,room.id),{ok:false,error:'invalid_auth'});
  const plain=(await call('/api/notification-apps','POST',{name:'Notifications only',channels:[room.id]},ownerCookie)).approvals[0];
  assert.deepEqual(await read(plain,room.id),{ok:false,error:'missing_scope',needed:'channels:history',provided:''});
  const native=await call('/api/conversations/'+room.id+'/messages','POST',{body:'Agenda ready for review.',intent:'synthetic-nook-90'},ownerCookie);
  await call('/api/conversations/'+other.id+'/messages','POST',{body:'Unapproved private financial discussion.',intent:'synthetic-nook-91'},ownerCookie);
  const dm=await call('/api/conversations','POST',{kind:'dm',name:'Private discussion',participants:[installer.user.id]},ownerCookie);
  await call('/api/conversations/'+dm.id+'/messages','POST',{body:'Direct conversation stays private.',intent:'synthetic-nook-92'},ownerCookie);
  await call('/api/notification-apps','POST',{name:'Never a DM',channels:[dm.id],messageReads:true},ownerCookie,400);
  const event={type:'event_callback',event_id:'synthetic-nook-90',event:{type:'message',channel:room.id,text:'Signed event delivered.'}};
  const button={type:'block_actions',channel:{id:room.id},user:{id:app.owner.id},actions:[{action_id:'post_message',value:'Installer approved the review.'}]};
  // Both public doors serve authentic requests and reject every unsafe signature.
  for(const [door,payload] of [['events',event],['interactivity',button]]){
   await refused(signed(grant,door,payload,{unsigned:true}),401);
   await refused(signed(grant,door,payload,{stamp:String(now/1000-301)}),401);
   await refused(signed(grant,door,payload,{stamp:String(now/1000+301)}),401);
   await refused(signed(grant,door,payload,{key:'synthetic-nook-91'}),401);
  }
  const delivered=await accepted(signed(grant,'events',event));
  const visible=await call('/api/messages/'+delivered.id,'GET',undefined,ownerCookie);assert.equal(visible.body,event.event.text);assert.equal(visible.app,1);assert.equal(visible.authorName,'Review helper');assert.equal(visible.author,replaced.id,'replacement preserves the approved app posting identity');
  const deliveryAudit=(await call('/api/team/audit?kind=notification-app.write','GET',undefined,ownerCookie)).items.filter(row=>row.reason.includes(delivered.id));
  assert.equal(deliveryAudit.length,1);assert.equal(deliveryAudit[0].service,'notification-app:'+grant.id,'replacement approval is the audited live grant');
  await refused(signed(grant,'events',event),409);
  await refused(signed(grant,'events',{...event,event:{...event.event,text:'A retry must not duplicate delivery.'}},{stamp:String(now/1000+1)}),409);
  const beforeAction=await snapshot(),action=await accepted(signed(grant,'interactivity',button)),afterAction=await snapshot();
  assert.equal(action.author,installer.user.id,'payload user cannot choose the actor');assert.equal(afterAction.audit,beforeAction.audit+1,'one action writes exactly one audit entry');
  const log=(await call('/api/team/audit?kind=notification-app.interactivity','GET',undefined,ownerCookie)).items;
  assert.equal(log.length,1);assert.equal(log[0].actor,installer.user.id);assert.equal(log[0].service,'notification-app:'+grant.id);assert.ok(log[0].reason.includes(action.id));assert.equal(log[0].outcome,'confirmed');assert.ok(!JSON.stringify(log).includes(button.actions[0].value));
  assert.equal((await call('/api/messages/'+action.id,'GET',undefined,ownerCookie)).body,button.actions[0].value);
  await refused(signed(grant,'interactivity',button),409);
  const shortcut={type:'shortcut',callback_id:'post_message',channel:{id:room.id},text:'Shortcut starts the review.'};
  const beforeShortcut=await snapshot(),short=await accepted(signed(grant,'interactivity',shortcut));assert.equal(short.author,installer.user.id);assert.equal((await snapshot()).audit,beforeShortcut.audit+1);
  const allowed=await read(grant,room.id);assert.equal(allowed.ok,true);for(const message of [native,delivered,action,short])assert.ok(allowed.messages.some(m=>m.ts===message.id&&m.text===message.body));assert.ok(!JSON.stringify(allowed).includes('financial discussion'));
  // Pagination and replies stay within the granted channel and live source rows.
  const firstPage=await read(grant,room.id,{args:{limit:'1'}});assert.equal(firstPage.messages.length,1);assert.equal(firstPage.has_more,true);
  const nextPage=await read(grant,room.id,{args:{limit:'1',cursor:firstPage.response_metadata.next_cursor}});assert.equal(nextPage.messages.length,1);assert.notEqual(firstPage.messages[0].ts,nextPage.messages[0].ts);
  const reply=await call('/api/conversations/'+room.id+'/messages','POST',{body:'Thread review detail.',parent:native.id,intent:'synthetic-nook-93'},ownerCookie);
  const thread=await read(grant,room.id,{method:'conversations.replies',args:{ts:native.id}});assert.equal(thread.ok,true);assert.deepEqual(thread.messages.map(m=>m.ts),[native.id,reply.id]);assert.equal(thread.messages[1].thread_ts,native.id);
  for(const channel of [other.id,dm.id,'synthetic-nook-missing'])assert.deepEqual(await read(grant,channel),{ok:false,error:'channel_not_found'});
  const foreign=await call('/api/conversations/'+other.id+'/messages','POST',{body:'Foreign thread root.',intent:'synthetic-nook-94'},ownerCookie);
  assert.deepEqual(await read(grant,room.id,{method:'conversations.replies',args:{ts:foreign.id}}),{ok:false,error:'message_not_found'});
  // The installing person can still read but loses posting authority immediately.
  let details=await call('/api/channels/'+room.id+'/details','GET',undefined,ownerCookie);
  await call('/api/channels/'+room.id+'/posting','PATCH',{version:details.version,level:'selected',replies:'same',people:[app.owner.id]},ownerCookie);
  assert.equal((await read(grant,room.id)).ok,true);
  await refused(signed(grant,'interactivity',{...shortcut,text:'Forbidden shortcut.'}),403);
  await refused(signed(grant,'interactivity',{...button,actions:[{action_id:'post_message',value:'Forbidden button.'}]}),403);
  // Removal of the installer also closes reads and signed event writes on the next call.
  await call('/api/conversations/'+room.id+'/members','POST',{user:installer.user.id,remove:true},ownerCookie);
  assert.deepEqual(await read(grant,room.id),{ok:false,error:'channel_not_found'});
  await refused(signed(grant,'events',{...event,event_id:'synthetic-nook-91'}),404);
  await refused(signed(grant,'interactivity',{...shortcut,text:'No membership.'}),404);
  await call('/api/conversations/'+room.id+'/members','POST',{user:installer.user.id},ownerCookie);
  details=await call('/api/channels/'+room.id+'/details','GET',undefined,ownerCookie);
  await call('/api/channels/'+room.id+'/posting','PATCH',{version:details.version,level:'everyone',replies:'everyone',people:[]},ownerCookie);
  // Erased source messages cannot be exposed or recreated by a signed replay.
  await call('/api/erasures','POST',{kind:'message',target:delivered.id,confirmation:'ERASE'},ownerCookie);
  assert.ok(!(await read(grant,room.id)).messages.some(m=>m.ts===delivered.id));await refused(signed(grant,'events',event),409);
  // Backup carries no capability secret or replay credential and restores no authority.
  const policy=await productPolicy(db),service=await createPortability({db,buckets:{FILES:await app.mf.getR2Bucket('FILES')},policy}),exportId=await service.exports.create(),archive=[];
  try{while((await service.exports.advance(exportId,{maxParts:16})).phase==='building'){}for await(const record of readArchive(await service.exports.download(exportId)))archive.push(record)}finally{await service.exports.abort(exportId)}
  assert.ok(!archive[0].tables.some(t=>['nook_notification_capabilities','nook_notification_requests'].includes(t.name)));assert.ok(!JSON.stringify(archive).includes(secret));assert.ok(!JSON.stringify(archive).includes(grant.token));
  restored=await installation(async()=>assert.fail('restore sends nothing'),{bootstrap:false,now});
  const restoredPolicy=await productPolicy(restored.db),importer=await createPortability({db:restored.db,buckets:{FILES:await restored.mf.getR2Bucket('FILES')},policy:restoredPolicy,migrations:migrationHistory(restoredPolicy)}),importId=await importer.imports.create(archive[0]);
  for(const record of archive)if(record.kind==='part')await importer.imports.uploadPart(importId,record.index,record);
  await importer.imports.finalize(importId,{contentHash:archive.at(-1).contentHash,archiveHash:archive.at(-1).archiveHash});
  assert.equal((await restored.db.prepare('SELECT count(*) AS n FROM nook_notification_capabilities').first()).n,0);assert.equal((await restored.db.prepare('SELECT count(*) AS n FROM nook_notification_secrets').first()).n,0);
  const restoredRead=await fetch(restored.origin+'/api/slack/conversations.history?'+new URLSearchParams({channel:room.id}),{headers:{authorization:'Bearer '+grant.token}});assert.deepEqual(await restoredRead.json(),{ok:false,error:'invalid_auth'});
  await call('/api/notification-apps/'+grant.id+'/revoke','POST',{},ownerCookie);
  assert.deepEqual(await read(grant,room.id),{ok:false,error:'invalid_auth'});await refused(signed(grant,'events',{...event,event_id:'synthetic-nook-92'}),404);await refused(signed(grant,'interactivity',{...shortcut,text:'Revoked shortcut.'}),404);
  const uninstall=await approve('Uninstall helper');await accepted(signed(uninstall,'events',{...event,event_id:'synthetic-nook-93'}));
  await call('/api/notification-apps/'+uninstall.id+'/remove','POST',{},ownerCookie);
  assert.equal((await db.prepare('SELECT count(*) AS n FROM nook_notification_secrets WHERE app=?').bind(uninstall.id).first()).n,0);
  assert.deepEqual(await read(uninstall,room.id),{ok:false,error:'invalid_auth'});await refused(signed(uninstall,'events',event),404);await refused(signed(uninstall,'interactivity',button),404);
  // Installer erasure removes the new capability and token before old signed work can run.
  const erased=await approve('Erasure helper');await accepted(signed(erased,'interactivity',{...shortcut,text:'Before installer erasure.'}));
  let receipt=await call('/api/erasures','POST',{kind:'member',target:installer.user.id,confirmation:'ERASE'},ownerCookie);for(let n=0;receipt.state!=='complete'&&n<50;n++)receipt=await call('/api/erasures/'+receipt.id+'/resume','POST',{},ownerCookie);assert.equal(receipt.state,'complete');
  assert.deepEqual(await read(erased,room.id),{ok:false,error:'invalid_auth'});await refused(signed(erased,'events',event),404);await refused(signed(erased,'interactivity',shortcut),404);
  assert.equal((await db.prepare('SELECT count(*) AS n FROM nook_audit WHERE actor=?').bind(installer.user.id).first()).n,0);
  const listed=JSON.stringify(await call('/api/notification-apps','GET',undefined,ownerCookie));for(const hidden of [secret,grant.token,erased.token])assert.ok(!listed.includes(hidden));
 }finally{await restored?.close();await app.close()}
}
