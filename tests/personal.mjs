import assert from 'node:assert/strict'
export async function personalJourney({owner,registered,post,get,request,check,restart,sql,validateArchive}){
 const member=await registered('PersonalSender'),outsider=await registered('PersonalOutside')
 await check('NOOK-032 first-sign-in defaults, member choices and dated vacation preserve notification ownership',async()=>{
  const defaults=(await get('/api/team/notification-defaults')).data,defaultChannels=(await get('/api/team/default-channels')).data;
  await get('/api/team/notification-defaults',member.cookie,403);
  const publicRoom=(await post('/api/conversations',{name:'synthetic-nook default alerts',kind:'channel',participants:[]})).data;
  await request('/api/team/default-channels',{method:'PATCH',cookie:owner.cookie,body:{version:defaultChannels.version,channels:[...defaultChannels.channels.filter(c=>c.enabled).map(c=>({id:c.id,mandatory:!!c.mandatory})),{id:publicRoom.id,mandatory:false}]}});
  const policy={version:defaults.version,push:{...defaults.push,direct:false},channels:[{id:publicRoom.id,level:'all'}],awayEmail:true};
  await request('/api/team/notification-defaults',{method:'PATCH',cookie:owner.cookie,body:policy});
  const newcomer=await registered('synthetic-nook-notification-defaults');
  let prefs=(await get('/api/notify',newcomer.cookie)).data;assert.equal(prefs.awayEmail,true);assert.equal(prefs.push.direct,false);
  assert.equal((await get('/api/conversations/'+publicRoom.id+'/notify',newcomer.cookie)).data.level,'all');
  await request('/api/notify',{method:'PATCH',cookie:newcomer.cookie,body:{awayEmail:false,push:{direct:true}}});
  await request('/api/conversations/'+publicRoom.id+'/notify',{method:'PATCH',cookie:newcomer.cookie,body:{level:'nothing'}});
  await restart();prefs=(await get('/api/notify',newcomer.cookie)).data;assert.equal(prefs.awayEmail,false);assert.equal(prefs.push.direct,true);assert.equal((await get('/api/conversations/'+publicRoom.id+'/notify',newcomer.cookie)).data.level,'nothing');
  const latest=(await get('/api/team/notification-defaults')).data;await request('/api/team/notification-defaults',{method:'PATCH',cookie:owner.cookie,body:{version:latest.version,push:defaults.push,channels:defaults.channels,awayEmail:defaults.awayEmail}});
  const channelPolicy=(await get('/api/team/default-channels')).data;await request('/api/team/default-channels',{method:'PATCH',cookie:owner.cookie,body:{version:channelPolicy.version,channels:defaultChannels.channels.filter(c=>c.enabled).map(c=>({id:c.id,mandatory:!!c.mandatory}))}});
  const vacationSender=await registered('synthetic-nook-vacation-sender');
  const vacation={starts:Date.now()-60000,ends:Date.now()+3600000};
  await request('/api/notify',{method:'PATCH',cookie:owner.cookie,body:{vacation}});
  assert.deepEqual((await get('/api/notify')).data.vacation,vacation);
  const room=(await post('/api/conversations',{name:'synthetic-nook vacation',kind:'private',participants:[vacationSender.user.id]})).data;
  const message=(await post('/api/conversations/'+room.id+'/messages',{body:'synthetic-nook vacation mention',mentions:[owner.user.id],intent:crypto.randomUUID()},vacationSender.cookie)).data;
  assert.ok((await get('/api/attention')).data.heldItems.some(i=>i.id===message.id+'.'+owner.user.id&&i.explanation.includes('vacation')));
  assert.equal((await get('/api/notify',member.cookie)).data.vacation,null);
  await restart();assert.deepEqual((await get('/api/notify')).data.vacation,vacation);
  if(validateArchive)await validateArchive();
  await request('/api/notify',{method:'PATCH',cookie:owner.cookie,body:{vacation:null}});
  assert.ok((await get('/api/attention')).data.items.some(i=>i.message?.id===message.id));
  // Keyword policy uses the same public scheduled-send, readable export,
  // operational archive and erasure doors as ordinary member work.
  const keywordPerson=await registered('synthetic-nook-keyword-custody');
  const keywordRoom=(await post('/api/conversations',{name:'synthetic-nook keyword custody',kind:'private',participants:[keywordPerson.user.id]})).data;
  const memberRequest=(path,method,body)=>request(path,{method,cookie:keywordPerson.cookie,body});
  await memberRequest('/api/notify','PATCH',{keywords:['Invoice'],vacation:{starts:Date.now()+86400000,ends:Date.now()+172800000}});
  await memberRequest('/api/conversations/'+keywordRoom.id+'/notify','PATCH',{level:'nothing'});
  const silent=(await post('/api/conversations/'+keywordRoom.id+'/messages',{body:'synthetic-nook invoice is silent',intent:crypto.randomUUID()})).data;
  assert.ok(!(await get('/api/attention',keywordPerson.cookie)).data.items.some(i=>i.message?.id===silent.id),'nothing suppresses keyword Attention');
  assert.equal((await sql(`SELECT count(*) AS n FROM nook_notify_queue WHERE message='${silent.id}' AND user='${keywordPerson.user.id}'`))[0].n,0,'nothing queues no keyword alert');
  await memberRequest('/api/conversations/'+keywordRoom.id+'/notify','PATCH',{level:'mentions'});
  const at=new Date(Date.now()+65000).toISOString().slice(0,16);
  const schedule=(await post('/api/conversations/'+keywordRoom.id+'/scheduled',{body:'synthetic-nook scheduled invoice',localAt:at,zone:'UTC',recurrence:'none',endDate:null,attachments:[],intent:crypto.randomUUID()})).data;
  const deadline=Date.now()+80000;let sent;
  while(Date.now()<deadline){sent=(await get('/api/scheduled')).data.items.find(s=>s.id===schedule.id);if(sent?.state==='complete')break;await new Promise(resolve=>setTimeout(resolve,300))}
  assert.equal(sent?.state,'complete','scheduled keyword message commits through its real alarm');
  const keywordItems=(await get('/api/attention',keywordPerson.cookie)).data.items.filter(i=>i.reason==='keyword');assert.equal(keywordItems.length,1);assert.equal(keywordItems[0].message.body,'synthetic-nook scheduled invoice');
  let readable=(await memberRequest('/api/readable-exports','POST',{scope:'conversation',conversationId:keywordRoom.id,custodyAccepted:true})).data;
  for(let n=0;!readable.complete&&n<200;n++)readable=(await memberRequest('/api/readable-exports/'+readable.id+'/step','POST',{})).data;
  assert.ok(readable.complete);const records=[];
  for(const page of (await get('/api/readable-exports/'+readable.id+'/index',keywordPerson.cookie)).data.items)records.push(...(await get('/api/readable-exports/'+readable.id+'/pages/'+page.ordinal,keywordPerson.cookie)).data.records);
  assert.deepEqual(records.find(r=>r.type==='personal_keywords').data.keywords,['Invoice']);
  const archive=async()=>{const id=(await request('/api/portability/exports',{method:'POST',cookie:owner.cookie,body:{},status:201})).data.id;let status;for(let n=0;n<200;n++){status=(await request('/api/portability/exports/'+id+'/advance',{method:'POST',cookie:owner.cookie,body:{maxParts:16}})).data;if(status.phase!=='building')break}assert.equal(status.phase,'complete');const raw=(await request('/api/portability/exports/'+id+'/download',{cookie:owner.cookie})).raw;const {readArchive}=await import('@runeditrun/rer/modules/portability');const rows=[];for await(const part of readArchive(new Blob([raw]).stream()))rows.push(...(part.items??[]));await request('/api/portability/exports/'+id+'/abort',{method:'POST',cookie:owner.cookie,body:{}});return rows};
  const before=await archive();assert.ok(before.some(r=>r.table==='nook_keywords'&&r.row.user===keywordPerson.user.id&&r.row.keyword==='Invoice'));assert.ok(before.some(r=>r.table==='nook_vacations'&&r.row.user===keywordPerson.user.id));
  await request('/api/erasures/preview',{method:'POST',cookie:owner.cookie,body:{kind:'member',target:keywordPerson.user.id}});
  let receipt=(await request('/api/erasures',{method:'POST',cookie:owner.cookie,body:{kind:'member',target:keywordPerson.user.id,confirmation:'ERASE'}})).data;
  for(let n=0;receipt.state!=='complete'&&n<30;n++)receipt=(await request('/api/erasures/'+receipt.id+'/resume',{method:'POST',cookie:owner.cookie,body:{}})).data;
  assert.equal(receipt.state,'complete');const after=await archive();for(const table of ['nook_keywords','nook_vacations','nook_notify_preferences'])assert.ok(!after.some(r=>r.table===table&&r.row.user===keywordPerson.user.id),'fresh archive excludes erased '+table);
 });
 await check('NOOK-017 sent history pages own recent messages under current access',async()=>{
  const room=(await post('/api/conversations',{name:'Regional customer launch',kind:'private',participants:[member.user.id]})).data
  const expected=new Set()
  for(let n=0;n<52;n++)expected.add((await post(`/api/conversations/${room.id}/messages`,{body:`Customer briefing update ${n}`,intent:crypto.randomUUID()},member.cookie)).data.id)
  const yesterday=[...expected][0];await sql(`UPDATE nook_messages SET created='${new Date(Date.now()-86400000).toISOString()}' WHERE id='${yesterday}'`)
  const old=(await post(`/api/conversations/${room.id}/messages`,{body:'Last quarter archived briefing',intent:crypto.randomUUID()},member.cookie)).data
  await sql(`UPDATE nook_messages SET created='2026-01-01T09:00:00.000Z' WHERE id='${old.id}'`)
  const root=(await post(`/api/conversations/${room.id}/messages`,{body:'New launch context',intent:crypto.randomUUID()})).data
  const reply=(await post(`/api/conversations/${room.id}/messages`,{body:'I sent the regional notes.',parent:root.id,intent:crypto.randomUUID()},member.cookie)).data;expected.add(reply.id)
  await get('/api/sent','',401)
  await get('/api/sent?after=malformed',member.cookie,400)
  const seen=new Set();let after=''
  do{const page=(await get('/api/sent?after='+encodeURIComponent(after),member.cookie)).data
   for(const item of page.items){assert.ok(expected.has(item.id));assert.ok(!seen.has(item.id));seen.add(item.id);if(item.id===reply.id)assert.equal(item.parent,root.id)}
   if(!page.hasMore)break;assert.notEqual(after,page.cursor);after=page.cursor
  }while(true)
  assert.deepEqual(seen,expected)
  assert.equal((await get('/api/sent',outsider.cookie)).data.items.length,0)
  assert.ok(!(await get('/api/sent',owner.cookie)).data.items.some(item=>expected.has(item.id)))
  await restart()
  assert.ok((await get('/api/sent',member.cookie)).data.items.some(item=>item.id===reply.id))
  await request('/api/messages/'+reply.id,{method:'PATCH',cookie:member.cookie,body:{body:'The regional notes are confirmed.',version:reply.version}})
  assert.equal((await get('/api/sent',member.cookie)).data.items.find(item=>item.id===reply.id).body,'The regional notes are confirmed.')
  await request('/api/messages/'+reply.id,{method:'PATCH',cookie:member.cookie,body:{delete:true,version:reply.version+1}})
  assert.ok(!(await get('/api/sent',member.cookie)).data.items.some(item=>item.id===reply.id))
  await post(`/api/conversations/${room.id}/members`,{user:member.user.id,remove:true})
  assert.ok(!(await get('/api/sent',member.cookie)).data.items.some(item=>item.conversation===room.id))
 })
}
