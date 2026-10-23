import assert from 'node:assert/strict'
import {signIn} from './auth-support.mjs'
export async function reportsJourney(h){
 const {post,get,request,owner,member,registered,sql,check}=h
 let fixture
 await check('Administration and commitments reports keep current authority, anonymous private totals, exact CSV and isolated source failures',async()=>{
  const admin=await registered('synthetic-nook-901'),plain=await registered('synthetic-nook-902'),guest=await registered('synthetic-nook-903'),guest2=await registered('synthetic-nook-904')
  await sql(`UPDATE oa_operators SET role='admin' WHERE id='${admin.user.id}'`)
  Object.assign(admin,await signIn(h.origin(),'synthetic-nook-901@example.test'))
  for(const actor of [guest,guest2]){await sql(`UPDATE nook_access SET mode='guest' WHERE user='${actor.user.id}'`);await sql(`INSERT INTO nook_guest_grants SELECT user,conversation FROM nook_members WHERE user='${actor.user.id}'`)}
  await sql(`WITH RECURSIVE n(value) AS (VALUES(1) UNION ALL SELECT value+1 FROM n WHERE value<35) INSERT INTO oa_operators(id,email,display_name,role,status,version,created_at) SELECT 'synthetic-nook-report-'||value,'synthetic-nook-report-'||value||'@example.test','Synthetic Nook '||value,'member','active',1,${Date.now()} FROM n`)
  await sql("INSERT INTO nook_access(user,mode,active,generation) SELECT id,'member',1,1 FROM oa_operators WHERE id LIKE 'synthetic-nook-report-%'")
  const shared=(await post('/api/conversations',{name:'Report team room',kind:'channel',participants:[admin.user.id,member.user.id]})).data
  const privateRoom=(await post('/api/conversations',{name:'PRIVATE-REPORT-MANAGEMENT',kind:'private'})).data
  await post('/api/conversations',{name:'Synthetic report DM',kind:'dm',participants:[plain.user.id]},member.cookie)
  await post('/api/conversations',{name:'Synthetic report group DM',kind:'dm',participants:[plain.user.id,owner.user.id]},member.cookie)
  await post('/api/conversations',{name:'Synthetic report managed room',kind:'channel'},member.cookie)
  const readablePrivate=(await post('/api/conversations',{name:'Synthetic readable private report room',kind:'private',participants:[admin.user.id]})).data
  const readableDecision=(await post(`/api/conversations/${readablePrivate.id}/outcomes`,{kind:'decision',body:'Synthetic readable decision'})).data
  const source=(await post(`/api/conversations/${shared.id}/messages`,{body:'PRIVATE-MESSAGE-BODY-NEVER-IN-REPORT',intent:crypto.randomUUID()})).data
  let accepted=(await post(`/api/conversations/${shared.id}/outcomes`,{kind:'commitment',body:'=SUM(1,2)',assignee:member.user.id,source:source.id,deadline:'2001-01-01'})).data
  accepted=(await request('/api/outcomes/'+accepted.id,{method:'PATCH',body:{version:accepted.version,action:'accept'},cookie:member.cookie})).data
  await post(`/api/conversations/${privateRoom.id}/outcomes`,{kind:'decision',body:'PRIVATE-REPORT-DECISION'})
  const before=(await sql('SELECT count(*) AS n FROM nook_audit'))[0].n
  for(const actor of [plain,guest])await get('/api/reports/administration',actor.cookie,403)
  assert.equal((await sql('SELECT count(*) AS n FROM nook_audit'))[0].n,before)
  const adminReport=(await get('/api/reports/administration',admin.cookie)).data
  assert.doesNotMatch(JSON.stringify(adminReport),/PRIVATE-REPORT-MANAGEMENT|PRIVATE-MESSAGE-BODY|PRIVATE-REPORT-DECISION/)
  assert.deepEqual(adminReport.privateSummary,{suppressed:true,notice:'fewer than 5 private conversations'})
  assert.equal(adminReport.sections.find(s=>s.name==='Channels').rows.find(r=>r.label==='Readable private conversations').value,1)
  assert.ok(!adminReport.sections.some(s=>s.missing.includes('storage-read-error')))
  await post(`/api/conversations/${privateRoom.id}/messages`,{body:'Synthetic hidden activity',intent:crypto.randomUUID()})
  const upload=await fetch(h.origin()+`/api/conversations/${privateRoom.id}/attachments`,{method:'POST',headers:{origin:h.origin(),cookie:owner.cookie,'Content-Type':'text/plain','X-Filename':'synthetic-nook-report.txt','X-Upload-Intent':crypto.randomUUID()},body:'synthetic private bytes'});assert.equal(upload.status,200)
  const changed=(await get('/api/reports/administration',admin.cookie)).data
  for(const name of ['Channels','Activity','Stored files','Notification delivery']){const before=adminReport.sections.find(s=>s.name===name),after=changed.sections.find(s=>s.name===name);assert.deepEqual(after.rows,before.rows);assert.equal(after.newest,before.newest)}
  assert.deepEqual(changed.privateSummary,adminReport.privateSummary)
  const total=(await sql("SELECT count(*) AS n FROM nook_access a JOIN oa_operators o ON o.id=a.user WHERE a.active=1 AND a.mode='member' AND o.status='active'"))[0].n
  assert.equal(adminReport.sections.find(s=>s.name==='Membership').rows.find(r=>r.label==='member').value,total)
  assert.equal(adminReport.sections.find(s=>s.name==='Membership').rows.find(r=>r.label==='guest').value,'fewer than 5')
  for(const section of adminReport.sections){assert.ok(section.denominator);assert.ok(section.computed);assert.ok('newest'in section);assert.ok(Array.isArray(section.missing))}
  assert.ok(adminReport.sections.some(s=>s.state==='unavailable'&&s.missing.some(x=>x.includes('NOOK-038'))))
  for(const actor of [plain,guest])assert.equal((await get('/api/reports/commitments',actor.cookie)).data.rows.length,0)
  const visible=(await get('/api/reports/commitments',admin.cookie)).data
  assert.deepEqual(visible.rows.map(r=>r.id).sort(),[accepted.id,readableDecision.id].sort());assert.deepEqual(visible.privateSummary,adminReport.privateSummary);assert.equal(visible.accepted,1);assert.equal(visible.overdue,1)
  const exportQuery=new URLSearchParams({...visible.filters,snapshot:visible.snapshot,format:'csv'});const downloaded=await get('/api/reports/commitments?'+exportQuery,admin.cookie)
  assert.match(downloaded.raw,/'=SUM\(1,2\)/);assert.match(downloaded.raw,new RegExp(accepted.id));assert.doesNotMatch(downloaded.raw,/PRIVATE-REPORT-MANAGEMENT|PRIVATE-REPORT-DECISION|PRIVATE-MESSAGE-BODY/);assert.match(downloaded.raw,/fewer than 5 private conversations/);assert.doesNotMatch(downloaded.raw,/Anonymous conversations/)
  assert.equal((await sql("SELECT count(*) AS n FROM nook_audit WHERE kind='report.export'"))[0].n,1)
  const managerReport=(await get('/api/reports/commitments',member.cookie)).data
  assert.deepEqual(managerReport.rows.map(r=>r.id),[accepted.id]);assert.doesNotMatch(JSON.stringify(managerReport),/PRIVATE-REPORT-MANAGEMENT|PRIVATE-REPORT-DECISION/)
  await post(`/api/conversations/${readablePrivate.id}/members`,{user:admin.user.id,remove:true})
  const five=(await get('/api/reports/commitments',admin.cookie)).data
  assert.deepEqual(five.rows.map(r=>r.id),[accepted.id]);assert.deepEqual(five.privateSummary,{suppressed:false,notice:'Anonymous private conversations',conversations:5,accepted:0,decisions:2})
  const fiveAdmin=(await get('/api/reports/administration',admin.cookie)).data;assert.deepEqual(fiveAdmin.privateSummary,five.privateSummary);assert.ok(!fiveAdmin.sections.find(s=>s.name==='Channels').rows.some(r=>r.label==='Readable private conversations'))
  assert.doesNotMatch(JSON.stringify(five),new RegExp(readablePrivate.id+'|Synthetic readable private report room|PRIVATE-REPORT'))
  const fiveCsv=await get('/api/reports/commitments?'+new URLSearchParams({...five.filters,snapshot:five.snapshot,format:'csv'}),admin.cookie)
  assert.match(fiveCsv.raw,/"Anonymous conversations","5"/);assert.doesNotMatch(fiveCsv.raw,/PRIVATE-REPORT-MANAGEMENT|Synthetic readable private report room|Synthetic readable decision|PRIVATE-REPORT-DECISION/)
  await get('/api/reports/commitments?'+exportQuery,admin.cookie,409)
  await post(`/api/conversations/${shared.id}/members`,{user:admin.user.id,remove:true})
  assert.equal((await get('/api/reports/commitments',admin.cookie)).data.rows.length,0)
  await get('/api/reports/commitments?'+exportQuery,admin.cookie,409)
  await get('/api/messages/'+source.id,admin.cookie,404)
  await post(`/api/conversations/${shared.id}/members`,{user:admin.user.id})
  // Force a real storage-edge read error, restore the table in finally. No
  // application fault toggle or fabricated report result is used.
  await sql('ALTER TABLE nook_imports RENAME TO synthetic_nook_report_unavailable')
  try{const failed=(await get('/api/reports/administration',admin.cookie)).data;assert.deepEqual(failed.sections.find(s=>s.name==='Connector health').missing,['storage-read-error']);assert.ok(failed.sections.find(s=>s.name==='Approved apps').state==='complete');assert.deepEqual(failed.sections.find(s=>s.name==='Stored files').missing,['storage-read-error']);assert.deepEqual(failed.privateSummary,{suppressed:true,notice:'Private totals unavailable: storage-read-error'})}finally{await sql('ALTER TABLE synthetic_nook_report_unavailable RENAME TO nook_imports')}
  fixture={admin,plain,shared,source,accepted}
 })
 return fixture
}
