import assert from 'node:assert/strict';
import {installation} from '../push/fixture.mjs';
import {importDoorClient,importUsers} from '../import-door-support.mjs';
import {zipFixture} from './fixture.mjs';
import {deltaCustody} from './delta-custody.mjs';
import {deltaBrowser} from '../slack-delta-browser.mjs';

export async function deltaJourney(){
 const app=await installation(undefined,{workerOptions:{assets:{directory:process.cwd()+'/dist/client',binding:'ASSETS',run_worker_first:true}}});
 const {db,call,ownerCookie}=app,owner={cookie:ownerCookie,user:app.owner},sql=async(query)=>(await db.prepare(query).all()).results;
 const door=importDoorClient({origin:app.origin,owner,users:()=>importUsers(sql)});
 try{
  const namespace='synthetic-nook-177',now=Math.floor(Date.now()/1000),ts=offset=>`${now+offset}.000001`;
  const range={from:new Date((now-7*86400)*1000).toISOString().slice(0,10),to:new Date(now*1000).toISOString().slice(0,10)};
  const statedPlan=async(source,review)=>{const prepared=await door.prepare(source,review),uploadId=await door.upload(prepared.packet);return {...prepared.summary,...await door.request('plan',{uploadId,...(review.delta?{catchup:true}:{}),attestation:range},{namespace:review.namespace})}};
  const users=[{id:'U1',name:'Alex',deleted:false},{id:'U2',name:'Mara',deleted:false}],channel={id:'C1',name:'release'};
  const root={type:'message',user:'U1',ts:ts(-86400),text:'Friday release plan: deploy after checks.'};
  const retired={type:'message',user:'U2',ts:ts(-86000),text:'Friday fallback plan.'};
  const absent={type:'message',user:'U2',ts:ts(-85000),text:'Friday accessibility review remains recorded.'};
  const friday=zipFixture([['users.json',users],['channels.json',[channel]],['release/2026-10-22.json',[root,retired,absent]]]);
  const fridaySource=await door.inspect(friday),review={namespace,channels:[{sourceId:'C1',name:'Release archive',members:[app.owner.id]}],actors:{U1:null,U2:null},acceptedOmissions:[]};
  const base=await statedPlan(fridaySource,review);await door.finish(base);
  const firstStatement=(await door.history()).jobs.find(j=>j.planId===base.planId).summary.attestation;assert.deepEqual({from:firstStatement.from,to:firstStatement.to},range,'first import shares the attestation door');
  const room=(await call('/api/conversations','GET',undefined,ownerCookie)).find(c=>c.name==='Release archive');assert.ok(room);
  const initial=await call(`/api/conversations/${room.id}/messages`,'GET',undefined,ownerCookie),original=initial.find(m=>m.body===root.text);
  const outsiderRoom=await call('/api/conversations','POST',{name:'Unrelated planning',kind:'private'},ownerCookie),outsider=await app.invite('DeltaOutsider',outsiderRoom.id);
  const adminEmail='synthetic-nook-792@example.test';await call('/api/team/invitations','POST',{email:adminEmail,role:'admin',mode:'member',scopes:[outsiderRoom.id]},ownerCookie);await call('/auth/invite','POST',{email:adminEmail,displayName:'synthetic-nook-792',role:'admin'},ownerCookie,202);const admin=await app.signIn(adminEmail);
  for(const actor of [outsider,admin])await door.request('plan',{uploadId:'synthetic-nook-unowned',attestation:range},{actor,status:403,namespace});
  for(const invalid of [{from:range.to,to:range.from},{from:'2026-02-30',to:range.to},{from:range.from,to:'2999-01-01'},{from:'1900-01-01',to:range.to},{from:range.from},{...range,statedBy:outsider.user.id}]){
   const refusal=await door.request('plan',{uploadId:'synthetic-nook-invalid',attestation:invalid},{status:400,namespace});assert.match(refusal.error,/date range|before|past/i,'visible validation refusal');
  }
  const native=await call(`/api/conversations/${room.id}/messages`,'POST',{body:'Native safety check remains open.',parent:original.id,intent:'synthetic-nook-178'},ownerCookie);
  const beforeNative=await db.prepare('SELECT * FROM nook_messages WHERE id=?').bind(native.id).first();
  const beforeSignals=await signalState(db,room.id);
  const edit={type:'message',subtype:'message_changed',original_ts:root.ts,ts:ts(100),user:'U1',editor_id:'U1',text:'Monday release plan: wait for the safety check.',previous:{text:root.text}};
  const reply={type:'message',user:'U2',ts:ts(200),thread_ts:root.ts,text:'Monday source reply: agreed to wait.'};
  const fresh={type:'message',user:'U1',ts:ts(300),text:'Monday release status.',reactions:[{name:'eyes',count:1,users:['U2']}]};
  const deletion={type:'message',subtype:'message_deleted',original_ts:retired.ts,ts:ts(400),user:'U2',editor_id:'U2',text:'',previous:{text:retired.text}};
  const monday=zipFixture([['users.json',[{...users[0],deleted:true},users[1],{id:'U3',name:'Theo new teammate',deleted:false}]],['channels.json',[channel,{id:'C2',name:'handoff'}]],['dms.json',[{id:'D1',members:['U1','U3']}]],['release/2026-10-23.json',[edit,reply,fresh,deletion]],['handoff/2026-10-23.json',[{type:'message',user:'U3',ts:ts(500),text:'Handoff checklist for review.'}]],['D1/2026-10-23.json',[{type:'message',user:'U1',ts:ts(600),text:'Private DM must stay excluded.'}]]]);
  const mondaySource=await door.inspect(monday),deltaReview={...review,channels:[...review.channels,{sourceId:'C2',name:'Handoff archive',members:[app.owner.id]}],actors:{U1:null,U2:null,U3:null}};
  const baseline=await door.request('delta-state',{namespace,sourceIds:['C1','C2']},{namespace});deltaReview.delta={overlapDays:7,baseline:baseline.baseline};
  const preview=(await door.prepare(mondaySource,deltaReview)).summary;assert.equal(preview.blocked,false,JSON.stringify(preview.blockers));assert.equal(preview.delta.counts.added,3);assert.equal(preview.delta.counts.revised,1);assert.equal(preview.delta.counts.tombstoned,0);assert.ok(preview.omissions.some(o=>o.key==='D1'));assert.equal(preview.delta.memberPreview.find(u=>u.sourceId==='U1').status,'deactivated');assert.equal(preview.delta.memberPreview.find(u=>u.sourceId==='U3').newToHistory,true);
  deltaReview.acceptedOmissions=[preview.omissionDigest];const beforeStatement=Date.now(),pass=await statedPlan(mondaySource,deltaReview);assert.ok(pass.planId,JSON.stringify(pass));await door.finish(pass);
  const attestedSummary=(await door.history()).jobs.find(j=>j.planId===pass.planId).summary,attestation=attestedSummary.attestation;
  assert.equal(attestation.label,'attested, not verified');assert.deepEqual({from:attestation.from,to:attestation.to},range);assert.equal(attestation.statedBy,app.owner.id);assert.equal(attestation.statedByName,app.owner.name);assert.ok(Date.parse(attestation.statedAt)>=beforeStatement&&Date.parse(attestation.statedAt)<=Date.now(),'server records when the owner stated the range');
  assert.deepEqual(attestedSummary.delta.counts,preview.delta.counts,'attestation changes no pass counts');assert.deepEqual(attestedSummary.delta.coverage,preview.delta.coverage,'attestation changes no coverage or last verification');
  const coverage=attestedSummary.delta.coverage.conversations.find(c=>c.channel==='C1');assert.equal(coverage.status,'unverified');assert.equal(coverage.lastVerifiedAt,null);
  const after=await call(`/api/conversations/${room.id}/messages`,'GET',undefined,ownerCookie);assert.equal(after.find(m=>m.id===original.id).body,edit.text);assert.equal(after.filter(m=>m.body===fresh.text).length,1);assert.ok(after.some(m=>m.body===retired.text),'unverified deletion never invents erasure');assert.ok(!JSON.stringify(after).includes('Private DM'));
  assert.ok(after.some(m=>m.body===absent.text),'an absent message inside the attested range remains retained and unverified');
  assert.deepEqual(await db.prepare('SELECT * FROM nook_messages WHERE id=?').bind(native.id).first(),beforeNative);assert.deepEqual(await signalState(db,room.id),beforeSignals);
  const thread=await call(`/api/conversations/${room.id}/messages/window?thread=${original.id}`,'GET',undefined,ownerCookie);assert.deepEqual(thread.items.map(m=>m.body),[native.body,reply.text]);assert.equal(thread.items[0].nativeContinuation,true);
  const revisions=await call(`/api/messages/${original.id}/imported-revisions`,'GET',undefined,ownerCookie);assert.ok(JSON.stringify(revisions).includes(root.text));assert.ok(JSON.stringify(revisions).includes(edit.text));
  await call(`/api/messages/${original.id}/imported-revisions`,'GET',undefined,outsider.cookie,404);
  await deltaCustody({app,room,root:original,oldBody:root.text,pass,attestation,outsider});
  const replay=await call(`/api/conversations/${room.id}/replay?after=${native.sequence}`,'GET',undefined,ownerCookie);assert.ok(replay.events.some(event=>event.kind==='import-history'));
  const history=await door.history();assert.ok(history.jobs.find(j=>j.planId===pass.planId).summary.delta.coverage.conversations.every(c=>c.status==='unverified'||c.status==='unknown'));
  await fetch(app.origin+'/setup',{method:'POST',redirect:'manual',headers:{cookie:ownerCookie,origin:app.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'});
  if(!process.env.NOOK_SKIP_BROWSER)await deltaBrowser({app,owner,monday,friday,namespace,room,original,native,pass,door});
  // Reread the same source: current observations and source identities add no revision.
  const current=await door.request('delta-state',{namespace,sourceIds:['C1','C2']},{namespace}),repeatReview={...deltaReview,delta:{overlapDays:7,baseline:current.baseline}};
  const repeatPreview=(await door.prepare(mondaySource,repeatReview)).summary;repeatReview.acceptedOmissions=[repeatPreview.omissionDigest];const repeat=await door.plan(mondaySource,repeatReview);await door.finish(repeat);
  assert.equal((await call(`/api/conversations/${room.id}/messages`,'GET',undefined,ownerCookie)).filter(m=>m.body===fresh.text).length,1);assert.deepEqual(await signalState(db,room.id),beforeSignals);
  await door.undo(repeat);await door.undo(pass);
  assert.equal((await door.history()).jobs.find(j=>j.planId===pass.planId).summary.attestation,undefined,'undo removes the pass attestation');
  const undone=await call(`/api/conversations/${room.id}/messages`,'GET',undefined,ownerCookie);assert.equal(undone.find(m=>m.id===original.id).body,root.text);assert.ok(undone.some(m=>m.id===native.id));assert.ok(!undone.some(m=>m.body===fresh.text||m.body===reply.text));assert.deepEqual(await db.prepare('SELECT * FROM nook_messages WHERE id=?').bind(native.id).first(),beforeNative);
  assert.ok((await door.history()).jobs.find(j=>j.planId===base.planId).summary.attestation,'unrelated first-import attestation survives delta undo');
  const importedActor=await db.prepare('SELECT job,source_actor FROM nook_import_records WHERE id=?').bind(original.id).first();let erased=await call('/api/erasures','POST',{kind:'imported-author',target:importedActor.job+':'+importedActor.source_actor,confirmation:'ERASE'},ownerCookie);for(let n=0;erased.state!=='complete'&&n<80;n++)erased=await call('/api/erasures/'+erased.id+'/resume','POST',{},ownerCookie);assert.equal(erased.state,'complete');assert.ok((await door.history()).jobs.every(j=>!j.summary.attestation),'erasure retires the attestation with existing pass metadata');
 }finally{await app.close()}
}
async function signalState(db,conversation){const result={};for(const table of ['nook_attention','nook_reads','nook_preferences','nook_thread_follows','nook_notify_queue']){const where=table==='nook_thread_follows'?"message IN (SELECT id FROM nook_messages WHERE conversation=? UNION ALL SELECT id FROM nook_import_records WHERE conversation=?)":(table==='nook_notify_queue'?"conversation=?":"conversation=?");result[table]=(await db.prepare(`SELECT * FROM ${table} WHERE ${where} ORDER BY rowid`).bind(...(table==='nook_thread_follows'?[conversation,conversation]:[conversation])).all()).results}return result}
