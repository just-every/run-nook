import assert from 'node:assert/strict'
import {signIn} from './auth-support.mjs'
export async function reportsJourney(h){
 const {post,get,request,owner,member,registered,sql,check}=h
 let fixture
 await check('Administration and commitments reports keep current authority, anonymous private totals, exact CSV and isolated source failures',async()=>{
  const admin=await registered('synthetic-nook-901'),plain=await registered('synthetic-nook-902'),guest=await registered('synthetic-nook-903'),guest2=await registered('synthetic-nook-904')
  await sql(`UPDATE oa_operators SET role='admin' WHERE id='${admin.user.id}'`)
  Object.assign(admin,await signIn(h.origin(),'synthetic-nook-901@example.test'))
  for(const actor of [guest,guest2])await sql(`UPDATE nook_access SET mode='guest' WHERE user='${actor.user.id}'`)
  await sql(`WITH RECURSIVE n(value) AS (VALUES(1) UNION ALL SELECT value+1 FROM n WHERE value<35) INSERT INTO oa_operators(id,email,display_name,role,status,version,created_at) SELECT 'synthetic-nook-report-'||value,'synthetic-nook-report-'||value||'@example.test','Synthetic Nook '||value,'member','active',1,${Date.now()} FROM n`)
  await sql("INSERT INTO nook_access(user,mode,active,generation) SELECT id,'member',1,1 FROM oa_operators WHERE id LIKE 'synthetic-nook-report-%'")
  const shared=(await post('/api/conversations',{name:'Report team room',kind:'channel',participants:[admin.user.id,member.user.id]})).data
  const privateRoom=(await post('/api/conversations',{name:'PRIVATE-REPORT-MANAGEMENT',kind:'private'})).data
  const source=(await post(`/api/conversations/${shared.id}/messages`,{body:'PRIVATE-MESSAGE-BODY-NEVER-IN-REPORT',intent:crypto.randomUUID()})).data
  let accepted=(await post(`/api/conversations/${shared.id}/outcomes`,{kind:'commitment',body:'=SUM(1,2)',assignee:member.user.id,source:source.id,deadline:'2001-01-01'})).data
  accepted=(await request('/api/outcomes/'+accepted.id,{method:'PATCH',body:{version:accepted.version,action:'accept'},cookie:member.cookie})).data
  await post(`/api/conversations/${privateRoom.id}/outcomes`,{kind:'decision',body:'PRIVATE-REPORT-DECISION'})
  const before=(await sql('SELECT count(*) AS n FROM nook_audit'))[0].n
  for(const actor of [plain,guest])await get('/api/reports/administration',actor.cookie,403)
  assert.equal((await sql('SELECT count(*) AS n FROM nook_audit'))[0].n,before)
  const adminReport=(await get('/api/reports/administration',admin.cookie)).data
  assert.doesNotMatch(JSON.stringify(adminReport),/PRIVATE-REPORT-MANAGEMENT|PRIVATE-MESSAGE-BODY|PRIVATE-REPORT-DECISION/)
  assert.ok(adminReport.sections.find(s=>s.name==='Channels').rows.some(r=>r.label==='Private conversations'))
  const total=(await sql("SELECT count(*) AS n FROM nook_access a JOIN oa_operators o ON o.id=a.user WHERE a.active=1 AND a.mode='member' AND o.status='active'"))[0].n
  assert.equal(adminReport.sections.find(s=>s.name==='Membership').rows.find(r=>r.label==='member').value,total)
  assert.equal(adminReport.sections.find(s=>s.name==='Membership').rows.find(r=>r.label==='guest').value,'fewer than 5')
  for(const section of adminReport.sections){assert.ok(section.denominator);assert.ok(section.computed);assert.ok('newest'in section);assert.ok(Array.isArray(section.missing))}
  assert.ok(adminReport.sections.some(s=>s.state==='unavailable'&&s.missing.some(x=>x.includes('NOOK-038'))))
  for(const actor of [plain,guest])assert.equal((await get('/api/reports/commitments',actor.cookie)).data.rows.length,0)
  const visible=(await get('/api/reports/commitments',admin.cookie)).data
  assert.deepEqual(visible.rows.map(r=>r.id),[accepted.id]);assert.equal(visible.accepted,1);assert.equal(visible.overdue,1)
  const exportQuery=new URLSearchParams({...visible.filters,snapshot:visible.snapshot,format:'csv'});const downloaded=await get('/api/reports/commitments?'+exportQuery,admin.cookie)
  assert.match(downloaded.raw,/'=SUM\(1,2\)/);assert.match(downloaded.raw,new RegExp(accepted.id));assert.doesNotMatch(downloaded.raw,/PRIVATE-REPORT-DECISION|PRIVATE-MESSAGE-BODY/)
  assert.equal((await sql("SELECT count(*) AS n FROM nook_audit WHERE kind='report.export'"))[0].n,1)
  await post(`/api/conversations/${shared.id}/members`,{user:admin.user.id,remove:true})
  assert.equal((await get('/api/reports/commitments',admin.cookie)).data.rows.length,0)
  await get('/api/reports/commitments?'+exportQuery,admin.cookie,409)
  await get('/api/messages/'+source.id,admin.cookie,404)
  await post(`/api/conversations/${shared.id}/members`,{user:admin.user.id})
  // Force a real storage-edge read error, restore the table in finally. No
  // application fault toggle or fabricated report result is used.
  await sql('ALTER TABLE nook_imports RENAME TO synthetic_nook_report_unavailable')
  try{const failed=(await get('/api/reports/administration',admin.cookie)).data;assert.deepEqual(failed.sections.find(s=>s.name==='Connector health').missing,['storage-read-error']);assert.ok(failed.sections.find(s=>s.name==='Stored files').state==='complete')}finally{await sql('ALTER TABLE synthetic_nook_report_unavailable RENAME TO nook_imports')}
  fixture={admin,plain,shared,source,accepted}
 })
 return fixture
}
