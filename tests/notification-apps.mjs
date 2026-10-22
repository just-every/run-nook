import {test} from 'node:test';
import assert from 'node:assert/strict';
import {installation} from './push/fixture.mjs';
import {signIn} from './auth-support.mjs';
import {createPortability,readArchive} from '@runeditrun/rer/modules/portability';
import {productPolicy} from '../src/platform/portability-policy.mjs';
import {migrationHistory} from './migration-history.mjs';
import {notificationAppsBrowser} from './integration-tokens-browser.mjs';

test('NOOK-080 channel-scoped notification approvals, audience, writes, rate, withdrawal, audit and credential-free restore',{timeout:240000},async t=>{
 const app=await installation(async()=>new Response(null,{status:201}),{workerOptions:{assets:{directory:process.cwd()+'/dist/client',binding:'ASSETS',run_worker_first:true}}});let restore;
 const {call,db,ownerCookie,origin}=app;
 const tokens=[];
 const send=async(token,channel,method='POST',body={body:'Daily report'},key=crypto.randomUUID(),suffix='messages')=>fetch(origin+`/api/notification-destinations/${channel}/${suffix}`,{method,headers:{authorization:'Bearer '+token,'content-type':'application/json','idempotency-key':key},...(method==='GET'?{}:{body:JSON.stringify(body)})});
 const approve=async(name,room,cookie=ownerCookie)=>{const result=await call('/api/notification-apps','POST',{name,channels:[room.id]},cookie);const row=result.approvals[0];tokens.push(row.token);return row};
 const noSecrets=value=>{const serialized=JSON.stringify(value);for(const token of tokens){assert.ok(!serialized.includes(token),'credential omitted');assert.ok(!serialized.includes(token.split('.')[1]),'secret omitted')}return value};
 const count=async()=>await db.prepare('SELECT (SELECT count(*) FROM nook_messages) AS messages,(SELECT sum(version) FROM nook_messages) AS versions,(SELECT count(*) FROM nook_events) AS events').first();
 const refusedWrite=async(fn)=>{const before=await count(),response=await fn();assert.ok(response.status>=400);assert.deepEqual(await count(),before);return response};
 try{
  const room=await call('/api/conversations','POST',{name:'Release coordination',kind:'private'},ownerCookie);
  const member=await app.invite('Ana',room.id);
  const inviteRole=async(name,role,mode)=>{const email=name.toLowerCase()+'@example.test';await call('/api/team/invitations','POST',{email,role,mode,scopes:[room.id]},ownerCookie);await call('/auth/invite','POST',{email,role,displayName:name},ownerCookie,202);return signIn(origin,email,{requestLink:false})};
  const admin=await inviteRole('Admin','admin','member');
  await call('/api/notification-apps','POST',{name:'Unapproved',channels:[room.id]},member.cookie,403);
  await call('/api/notification-apps','POST',{name:'All',channels:[]},ownerCookie,400);
  const primary=await approve('Slate',room),other=await approve('Uptime',room,admin.cookie);
  const denied=await fetch(origin+'/api/notification-apps',{method:'POST',headers:{authorization:'Bearer '+primary.token,'content-type':'application/json'},body:JSON.stringify({name:'Self',channels:[room.id]})});assert.equal(denied.status,404);
  noSecrets(await call('/api/notification-apps','GET',undefined,ownerCookie));
  const hashed=await db.prepare('SELECT hash FROM nook_notification_secrets WHERE app=?').bind(primary.id).first();assert.ok(hashed.hash&&!hashed.hash.includes(primary.token));
  const body='<img src=x onerror=alert(1)> Release notes are ready for review.';
  const first=await send(primary.token,room.id,'POST',{body},'release');assert.equal(first.status,200,await first.clone().text());const message=await first.json();assert.equal(message.author,primary.id);assert.equal(message.authorName,'Slate');assert.equal(message.app,1);assert.equal(message.body,body);
  const repeat=await send(primary.token,room.id,'POST',{body},'release');assert.equal(repeat.status,200);assert.equal((await repeat.json()).id,message.id);
  await refusedWrite(()=>send(primary.token,room.id,'POST',{body:'changed'},'release'));
  await refusedWrite(()=>send(other.token,room.id,'PATCH',{body:'not mine',version:1},'edit','messages/'+message.id));
  for(const person of [ownerCookie,admin.cookie,member.cookie])await call('/api/messages/'+message.id,'PATCH',{body:'not mine',version:1},person,403);
  let edited=await send(primary.token,room.id,'PATCH',{body:'Updated release notes',version:1},'edit','messages/'+message.id);assert.equal(edited.status,200,await edited.clone().text());assert.equal((await edited.json()).version,2);
  const editedReplay=await send(primary.token,room.id,'POST',{body},'release');assert.equal(editedReplay.status,200);assert.deepEqual(await editedReplay.json(),message);
  await refusedWrite(()=>send(primary.token,room.id,'PATCH',{body:'stale',version:1},'stale','messages/'+message.id));
  const deleted=await send(primary.token,room.id,'DELETE',{version:2},'delete','messages/'+message.id);assert.equal(deleted.status,200,await deleted.clone().text());
  await refusedWrite(()=>send(primary.token,room.id,'POST',{body},'release'));
  assert.equal((await db.prepare('SELECT count(*) AS n FROM nook_revisions WHERE message=?').bind(message.id).first()).n,0);
  const live=await (await send(primary.token,room.id,'POST',{body:'Deployment remains under review.'},'live')).json();
  let audience=await (await send(primary.token,room.id,'GET',undefined,'facts','audience')).json();
  assert.equal(audience.private,true);assert.equal(audience.sharing.federationAvailable,false);assert.equal(audience.sharing.state,'local');assert.equal(audience.archived,false);
  assert.ok(audience.members.some(m=>m.id===member.user.id&&m.verifiedEmail==='ana@example.test'&&m.guest===false&&m.bot===false));assert.ok(audience.members.some(m=>m.id===primary.id&&m.bot===true&&m.emailVerified==='unknown'));
  await call('/auth/email','POST',{email:'ana.updated@example.test'},member.cookie);
  audience=await (await send(primary.token,room.id,'GET',undefined,'facts','audience')).json();assert.equal(audience.members.find(m=>m.id===member.user.id).emailVerified,'unknown','changing an address is not proof of that mailbox');
  const verified=await app.signIn('ana.updated@example.test');member.cookie=verified.cookie;
  audience=await (await send(primary.token,room.id,'GET',undefined,'facts','audience')).json();assert.equal(audience.members.find(m=>m.id===member.user.id).verifiedEmail,'ana.updated@example.test');
  const guest=await inviteRole('Guest','member','guest');await call('/api/notification-apps','POST',{name:'Guest app',channels:[room.id]},guest.cookie,403);
  audience=await (await send(primary.token,room.id,'GET',undefined,'facts','audience')).json();assert.ok(audience.members.some(m=>m.id===guest.user.id&&m.guest===true));
  await call(`/api/conversations/${room.id}/members`,'POST',{user:guest.user.id,remove:true},ownerCookie);
  audience=await (await send(primary.token,room.id,'GET',undefined,'facts','audience')).json();assert.ok(!audience.members.some(m=>m.id===guest.user.id));
  for(const kind of ['private','channel']){
   const foreign=await call('/api/conversations','POST',{name:'Other '+kind,kind},ownerCookie);
   for(const channel of [foreign.id,'missing-channel']){const denial=await send(primary.token,channel,'GET',undefined,'facts','audience');assert.equal(denial.status,404);assert.deepEqual(await denial.json(),{error:'Destination unavailable'});await refusedWrite(()=>send(primary.token,channel));await refusedWrite(()=>send(primary.token,channel,'PATCH',{body:'no',version:1},'edit','messages/'+live.id))}
   const details=await call(`/api/channels/${foreign.id}/details`,'GET',undefined,ownerCookie);await call(`/api/channels/${foreign.id}/archive`,'POST',{version:details.version,archived:true},ownerCookie);assert.equal((await send(primary.token,foreign.id,'GET',undefined,'facts','audience')).status,404);
  }
  // A fresh channel makes the burst bound independent of earlier test work.
  const rateRoom=await call('/api/conversations','POST',{name:'Rate-limited reports',kind:'private'},ownerCookie),rateA=await approve('Slate rate',rateRoom),rateB=await approve('Uptime rate',rateRoom);
  const started=performance.now(),rateResults=[];
  for(let n=0;n<21;n++)rateResults.push(await send(n%2?rateA.token:rateB.token,rateRoom.id,'POST',{body:'Report '+n},'report-'+n));
  assert.ok(performance.now()-started<1000,'burst proved within one real second');
  for(const response of rateResults.slice(0,20))assert.equal(response.status,200,await response.clone().text());assert.equal(rateResults[20].status,429,await rateResults[20].clone().text());assert.equal(Number(rateResults[20].headers.get('retry-after')),1);
  assert.equal((await db.prepare('SELECT count(*) AS n FROM nook_messages WHERE conversation=?').bind(rateRoom.id).first()).n,20);
  const replay=await send(rateB.token,rateRoom.id,'POST',{body:'Report 0'},'report-0');assert.equal(replay.status,200,'replay consumes no quota');
  let details=await call(`/api/channels/${room.id}/details`,'GET',undefined,ownerCookie);await call(`/api/channels/${room.id}/archive`,'POST',{version:details.version,archived:true},ownerCookie);
  assert.equal((await (await send(primary.token,room.id,'GET',undefined,'facts','audience')).json()).archived,true);
  for(const [method,payload,suffix] of [['POST',{body:'after archive'},'messages'],['PATCH',{body:'after archive',version:1},'messages/'+live.id],['DELETE',{version:1},'messages/'+live.id]])await refusedWrite(()=>send(primary.token,room.id,method,payload,'withdrawal',suffix));
  details=await call(`/api/channels/${room.id}/details`,'GET',undefined,ownerCookie);await call(`/api/channels/${room.id}/archive`,'POST',{version:details.version,archived:false},ownerCookie);
  await call(`/api/notification-apps/${primary.id}/remove`,'POST',{},admin.cookie);
  for(const method of ['POST','PATCH','DELETE'])await refusedWrite(()=>send(primary.token,room.id,method,method==='POST'?{body:'removed'}:{version:1,body:'removed'},'removed',method==='POST'?'messages':'messages/'+live.id));
  assert.equal((await send(primary.token,room.id,'GET',undefined,'facts','audience')).status,404);
  const moderated=await call('/api/erasures','POST',{kind:'message',target:live.id,confirmation:'ERASE'},ownerCookie);assert.equal(moderated.state,'complete','normal moderation remains after withdrawal');
  const replacement=await approve('Uptime',room);assert.notEqual(replacement.token,other.token);await refusedWrite(()=>send(other.token,room.id));
  details=await call(`/api/channels/${room.id}/details`,'GET',undefined,ownerCookie);await call(`/api/channels/${room.id}/transfer`,'POST',{version:details.version,user:member.user.id},ownerCookie);
  await call(`/api/notification-apps/${replacement.id}/revoke`,'POST',{},member.cookie);await refusedWrite(()=>send(replacement.token,room.id));
  const keeper=await approve('Build status',room,admin.cookie);const kept=await send(keeper.token,room.id,'POST',{body:'Build status: waiting for review.'},'kept');assert.equal(kept.status,200);const keptMessage=await kept.json();
  let job=await call('/api/readable-exports','POST',{scope:'conversation',conversationId:room.id,custodyAccepted:true},member.cookie);for(let n=0;!job.complete&&n<100;n++)job=await call(`/api/readable-exports/${job.id}/step`,'POST',{},member.cookie);assert.ok(job.complete);
  const index=await call(`/api/readable-exports/${job.id}/index`,'GET',undefined,member.cookie),exported=[];for(const page of index.items)exported.push(...(await call(`/api/readable-exports/${job.id}/pages/${page.ordinal}`,'GET',undefined,member.cookie)).records);
  noSecrets(exported);assert.ok(exported.some(r=>r.type==='notification_apps'&&r.data.id===keeper.id));assert.ok(exported.some(r=>r.type==='messages'&&r.data.id===keptMessage.id&&r.data.app===1));assert.ok(!JSON.stringify(exported).includes(hashed.hash));
  const policy=await call('/api/readable-exports/policy','GET',undefined,ownerCookie);await call('/api/readable-exports/policy','POST',{enabled:true,version:policy.version},ownerCookie);
  let whole=await call('/api/readable-exports','POST',{scope:'workspace',custodyAccepted:true},ownerCookie);for(let n=0;!whole.complete&&n<150;n++)whole=await call(`/api/readable-exports/${whole.id}/step`,'POST',{},ownerCookie);assert.ok(whole.complete);
  const wholeIndex=await call(`/api/readable-exports/${whole.id}/index`,'GET',undefined,ownerCookie),wholeRecords=[];for(const page of wholeIndex.items)wholeRecords.push(...(await call(`/api/readable-exports/${whole.id}/pages/${page.ordinal}`,'GET',undefined,ownerCookie)).records);noSecrets(wholeRecords);assert.ok(!JSON.stringify(wholeRecords).includes(hashed.hash));assert.ok(wholeRecords.some(r=>r.type==='administrative_audit'&&r.data.kind==='notification-app.approve'));
  const log=await call('/api/team/audit?format=json','GET',undefined,ownerCookie);noSecrets(log);assert.ok(!JSON.stringify(log).includes(hashed.hash));for(const kind of ['approve','issue','write','refuse','revoke'])assert.ok(log.items.some(row=>row.kind==='notification-app.'+kind));
  let receipt=await call('/api/erasures','POST',{kind:'member',target:admin.user.id,confirmation:'ERASE'},ownerCookie);for(let n=0;receipt.state!=='complete'&&n<50;n++)receipt=await call(`/api/erasures/${receipt.id}/resume`,'POST',{},ownerCookie);assert.equal(receipt.state,'complete');
  assert.equal((await db.prepare('SELECT creator FROM nook_notification_apps WHERE id=?').bind(keeper.id).first()).creator,null);assert.equal((await db.prepare('SELECT body FROM nook_messages WHERE id=?').bind(keptMessage.id).first()).body,'Build status: waiting for review.');assert.equal((await db.prepare('SELECT count(*) AS n FROM nook_audit WHERE actor=?').bind(admin.user.id).first()).n,0);
  const service=await createPortability({db,buckets:{FILES:await app.mf.getR2Bucket('FILES')},policy:await productPolicy(db)}),exportId=await service.exports.create();let records=[];
  try{while((await service.exports.advance(exportId,{maxParts:16})).phase==='building'){}for await(const record of readArchive(await service.exports.download(exportId)))records.push(record)}finally{await service.exports.abort(exportId)}
  noSecrets(records);assert.ok(!JSON.stringify(records).includes(hashed.hash));assert.ok(records[0].tables.some(row=>row.name==='nook_notification_apps'));assert.ok(!records[0].tables.some(row=>row.name==='nook_notification_secrets'));
  restore=await installation(async()=>assert.fail('restore emits nothing'),{bootstrap:false});const importer=await createPortability({db:restore.db,buckets:{FILES:await restore.mf.getR2Bucket('FILES')},policy:await productPolicy(restore.db),migrations:migrationHistory(await productPolicy(restore.db))});const id=await importer.imports.create(records[0]);for(const record of records)if(record.kind==='part')await importer.imports.uploadPart(id,record.index,record);const end=records.at(-1);await importer.imports.finalize(id,{contentHash:end.contentHash,archiveHash:end.archiveHash});
  assert.equal((await restore.db.prepare('SELECT count(*) AS n FROM nook_notification_secrets').first()).n,0);assert.equal((await restore.db.prepare('SELECT state FROM nook_notification_apps WHERE id=?').bind(keeper.id).first()).state,'reissue');assert.equal((await restore.db.prepare('SELECT body FROM nook_messages WHERE id=?').bind(keptMessage.id).first()).body,'Build status: waiting for review.');
  const before=await restore.db.prepare('SELECT count(*) AS n FROM nook_messages').first();const stopped=await fetch(restore.origin+`/api/notification-destinations/${room.id}/messages`,{method:'POST',headers:{authorization:'Bearer '+keeper.token,'content-type':'application/json','idempotency-key':'restored'},body:JSON.stringify({body:'must not post'})});assert.equal(stopped.status,404);assert.deepEqual(await restore.db.prepare('SELECT count(*) AS n FROM nook_messages').first(),before);
  if(!process.env.NOOK_SKIP_BROWSER){await fetch(origin+'/setup',{method:'POST',redirect:'manual',headers:{cookie:ownerCookie,origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'});await notificationAppsBrowser({origin,owner:{cookie:ownerCookie},room,destination:process.env.NOOK_EVIDENCE_DIR??'evidence/notification-apps'})}
  t.diagnostic('R1-R9: public-door approval, isolation, one-time hash custody, app writes/revisions, shared rate bucket, audience, withdrawal, audit, export/restore and approving-person erasure passed; sharing unavailable (NOOK-031).');
 }finally{await restore?.close();await app.close()}
});

test('NOOK-036 cited AI search uses one bounded provider call and survives hostile output, revocation and credential-free restore',{timeout:240000},async t=>{
 const edge={calls:[],mode:'normal',during:null,lastKey:''};let restore;
 const app=await installation(async request=>{assert.equal(request.url,'https://model.example.test/v1/messages');edge.lastKey=request.headers.get('x-api-key');const body=await request.json();edge.calls.push({url:request.url,body});const data=JSON.parse(body.messages[0].content),passages=data.quotedPassages;if(edge.during){const run=edge.during;edge.during=null;await run()}const claims=passages.map(p=>({passageId:p.id,quote:p.text}));if(edge.mode==='unsupported')return Response.json({content:[{type:'text',text:JSON.stringify({claims:[{passageId:'fabricated-citation',quote:'unsupported model assertion'}],conflicts:[],abstain:false})}]});const conflicts=edge.mode==='conflicts'&&passages.length>1?[{left:passages[0].id,right:passages[1].id}]:[];if(edge.mode==='hostile')claims.push({passageId:'fabricated-citation',quote:'injected-tool'});return Response.json({content:[{type:'text',text:JSON.stringify({claims,conflicts,abstain:false})},...(edge.mode==='hostile'?[{type:'tool_use',name:'injected-tool',input:{url:'https://attacker.example.test'}}]:[])]})},{workerOptions:{assets:{directory:process.cwd()+'/dist/client',binding:'ASSETS',run_worker_first:true}}});
 try{
  const proof=await(await import('./search.mjs')).aiSearchJourney(app,edge,t);
  if(!process.env.NOOK_SKIP_BROWSER){await fetch(app.origin+'/setup',{method:'POST',redirect:'manual',headers:{cookie:app.ownerCookie,origin:app.origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'});await(await import('./search-browser.mjs')).aiSearchBrowser({origin:app.origin,...proof,destination:process.env.NOOK_AI_EVIDENCE_DIR??'evidence/ai-search'});}
  const service=await createPortability({db:app.db,buckets:{FILES:await app.mf.getR2Bucket('FILES')},policy:await productPolicy(app.db)}),exportId=await service.exports.create();let records=[];try{while((await service.exports.advance(exportId,{maxParts:16})).phase==='building'){}for await(const record of readArchive(await service.exports.download(exportId)))records.push(record)}finally{await service.exports.abort(exportId)}for(const secret of proof.secrets)assert.ok(!JSON.stringify(records).includes(secret));assert.ok(!records[0].tables.some(t=>t.name==='nook_ai_secrets'));assert.ok(records[0].tables.some(t=>t.name==='nook_ai_feedback'));
  restore=await installation(async()=>assert.fail('restore emits nothing'),{bootstrap:false});const importer=await createPortability({db:restore.db,buckets:{FILES:await restore.mf.getR2Bucket('FILES')},policy:await productPolicy(restore.db),migrations:migrationHistory(await productPolicy(restore.db))});const id=await importer.imports.create(records[0]);for(const record of records)if(record.kind==='part')await importer.imports.uploadPart(id,record.index,record);const end=records.at(-1);await importer.imports.finalize(id,{contentHash:end.contentHash,archiveHash:end.archiveHash});assert.equal((await restore.db.prepare('SELECT enabled FROM nook_ai_settings').first()).enabled,0);assert.equal((await restore.db.prepare('SELECT count(*) AS n FROM nook_ai_secrets').first()).n,0);assert.ok((await restore.db.prepare('SELECT count(*) AS n FROM nook_ai_feedback').first()).n>0);
  let erased=await app.call('/api/erasures','POST',{kind:'member',target:proof.member.user.id,confirmation:'ERASE'},app.ownerCookie);for(let n=0;erased.state!=='complete'&&n<50;n++)erased=await app.call('/api/erasures/'+erased.id+'/resume','POST',{},app.ownerCookie);assert.equal(erased.state,'complete');assert.equal((await app.db.prepare('SELECT count(*) AS n FROM nook_ai_feedback WHERE user=?').bind(proof.member.user.id).first()).n,0);
 }finally{await restore?.close();await app.close()}
});
