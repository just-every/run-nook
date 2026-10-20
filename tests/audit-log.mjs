import assert from 'node:assert/strict'
// NOOK-051 through the public doors of a real Worker: admin actions append body-free
// audit rows in their own batch, owners/admins filter and export them, members and
// erased people are refused, erasure keeps the facts and the log is archive-valid.
export async function auditJourney({post,get,request,owner,member,outsider,check,sql,restart,validateArchive}){
 const patch=(path,body,cookie=owner.cookie,status=200)=>request(path,{method:'PATCH',body,cookie,status})
 const list=async(query='',cookie=owner.cookie,status=200)=>(await get('/api/audit'+(query?'?'+query:''),cookie,status)).data
 const all=async(query='')=>{const items=[];for(let page=await list(query);;page=await list(query+(query?'&':'')+'before='+encodeURIComponent(page.cursor))){items.push(...page.items);if(!page.cursor)return items}}
 const secretBody='Board-only quarterly numbers: revenue 4.2M',dmBody='Private note between two people only'
 const fixture={}
 await check('NOOK-051 membership revocation, export, erasure and an interrupted step appear in an admin-only filterable log, an erased actor is anonymized with the facts kept, and the log survives archive restore',async()=>{
  const started=Date.now()
  const ops=(await post('/api/conversations',{name:'audit-ops',kind:'channel',participants:[member.user.id,outsider.user.id]})).data
  // A posting-permission change and a labelled admin override post (NOOK-066).
  const version=async()=>(await get(`/api/channels/${ops.id}/details`)).data.version
  await patch(`/api/channels/${ops.id}/posting`,{version:await version(),level:'selected',replies:'same',people:[member.user.id]})
  const override=(await post(`/api/conversations/${ops.id}/messages`,{body:secretBody,intent:crypto.randomUUID(),adminOverride:true})).data
  // Membership revocation by an owner.
  await post('/api/team/remove',{user:outsider.user.id,conversation:ops.id})
  // A member exports to completion; a second export is interrupted mid-run by a Worker restart.
  let done=(await post('/api/readable-exports',{scope:'permitted',custodyAccepted:true},member.cookie)).data
  for(let n=0;!done.complete&&n<200;n++)done=(await post(`/api/readable-exports/${done.id}/step`,{},member.cookie)).data
  assert.equal(done.complete,true)
  const interrupted=(await post('/api/readable-exports',{scope:'permitted',custodyAccepted:true},member.cookie)).data
  await post(`/api/readable-exports/${interrupted.id}/step`,{},member.cookie)
  await restart()
  // A DM message the member deletes is erased; the log names only "a direct conversation".
  const dm=(await post('/api/conversations',{kind:'dm',name:'Audit DM',participants:[member.user.id]})).data
  const dmMessage=(await post(`/api/conversations/${dm.id}/messages`,{body:dmBody,intent:crypto.randomUUID()},member.cookie)).data
  await patch(`/api/messages/${dmMessage.id}`,{version:dmMessage.version,delete:true},member.cookie)

  // Members, guests and anyone without owner/admin authority are refused by the API.
  await list('',member.cookie,403);await get('/api/audit/export?format=csv',member.cookie,403);await list('',outsider.cookie,403)
  await request('/api/audit',{method:'POST',body:{},cookie:owner.cookie,status:405})

  const entries=await all()
  const find=(kind,predicate=()=>true)=>entries.filter(e=>e.kind===kind&&predicate(e))
  const posting=find('posting.change',e=>e.scope===ops.id);assert.equal(posting.length,1);assert.equal(posting[0].actor,owner.user.id);assert.deepEqual(posting[0].detail,{level:'selected',replies:'same',people:1})
  const overrides=find('message.override',e=>e.id===override.id);assert.equal(overrides.length,1);assert.equal(overrides[0].scopeLabel,'#audit-ops');assert.equal(overrides[0].outcome,'confirmed')
  const removal=find('membership.remove',e=>e.scope===ops.id);assert.equal(removal.length,1);assert.equal(removal[0].subject,outsider.user.id);assert.equal(removal[0].actor,owner.user.id)
  const exports=find('export.readable',e=>e.actor===member.user.id)
  assert.equal(exports.find(e=>e.id===done.id)?.outcome,'confirmed')
  const pending=exports.find(e=>e.id===interrupted.id);assert.equal(pending.outcome,'uncertain','an interrupted export stays uncertain, never a forged completion');assert.match(pending.reason,/not confirmed/)
  const dmErasure=find('erasure.message',e=>e.id===dmMessage.receipt?.id||e.scopeKind==='dm');assert.ok(dmErasure.length>=1)
  for(const e of dmErasure){assert.equal(e.scopeLabel,'a direct conversation');assert.equal(e.scope,null)}
  assert.ok(find('session.start',e=>e.actor===member.user.id).length>=1,'sign-in sessions are read from Base in place')
  const serialized=JSON.stringify(entries)
  for(const forbidden of [secretBody,dmBody,'Audit DM',dm.id])assert.ok(!serialized.includes(forbidden),'the log never carries '+forbidden)

  // Filters: action kind, person, place, outcome and time range.
  assert.ok((await all('kind=membership')).every(e=>e.kind.startsWith('membership.')))
  assert.ok((await all('kind=membership')).some(e=>e.kind==='membership.remove'))
  assert.ok((await all(`actor=${owner.user.id}`)).every(e=>e.actor===owner.user.id))
  assert.deepEqual([...new Set((await all(`scope=${ops.id}`)).map(e=>e.scope))],[ops.id])
  const uncertain=await all('outcome=uncertain');assert.ok(uncertain.some(e=>e.id===interrupted.id)&&uncertain.every(e=>e.outcome==='uncertain'))
  assert.equal((await all(`from=${Date.now()+60000}`)).length,0);assert.ok((await all(`from=${started}&to=${Date.now()+1}`)).some(e=>e.id===override.id))
  await get('/api/audit?outcome=forged',owner.cookie,400)

  // CSV and JSON exports carry the filtered facts and nothing private.
  const csv=await request('/api/audit/export?format=csv&kind=export',{cookie:owner.cookie})
  assert.match(csv.response.headers.get('content-disposition'),/attachment; filename="nook-audit-.*\.csv"/)
  const text=csv.raw,[header,...lines]=text.trim().split('\r\n')
  assert.equal(header,'time,actor,service,action,scope,version,reason,outcome,subject,detail');assert.ok(lines.length>=2&&lines.every(l=>l.includes(',export.readable,')))
  assert.ok(text.includes(',uncertain,'));for(const forbidden of [secretBody,dmBody])assert.ok(!text.includes(forbidden))
  const json=JSON.parse((await request('/api/audit/export?format=json&outcome=uncertain',{cookie:owner.cookie})).raw)
  assert.equal(json.format,'nook-audit');assert.ok(json.entries.length>=1&&json.entries.every(e=>e.outcome==='uncertain'))

  // The subject cannot edit the log, and nobody can remove a row.
  await assert.rejects(sql(`UPDATE nook_audit SET outcome='confirmed' WHERE id='${interrupted.id}'`),/audit_append_only/)
  await assert.rejects(sql(`DELETE FROM nook_audit WHERE id='${override.id}'`),/audit_append_only/)

  // Erasing the member anonymizes their attribution and keeps every fact.
  const before=(await all(`kind=export`)).filter(e=>[done.id,interrupted.id].includes(e.id))
  let receipt=(await post('/api/erasures',{kind:'member',target:member.user.id,confirmation:'ERASE'})).data
  for(let n=0;receipt.state!=='complete'&&n<60;n++)receipt=(await post(`/api/erasures/${receipt.id}/resume`,{})).data
  assert.equal(receipt.state,'complete')
  await list('',member.cookie,401)
  const after=(await all(`kind=export`)).filter(e=>[done.id,interrupted.id].includes(e.id))
  assert.deepEqual(after.map(e=>[e.id,e.at,e.kind,e.outcome,e.reason]),before.map(e=>[e.id,e.at,e.kind,e.outcome,e.reason]),'count, time, kind and outcome survive erasure')
  for(const e of after){assert.equal(e.actor,null);assert.equal(e.actorName,'An erased person')}
  const erased=(await all('kind=erasure.member')).find(e=>e.id===receipt.id);assert.equal(erased.outcome,'confirmed');assert.equal(erased.actor,owner.user.id);assert.equal(erased.subject,null);assert.equal(erased.scope,null)
  assert.equal((await sql(`SELECT count(*) AS n FROM nook_audit WHERE actor='${member.user.id}' OR subject='${member.user.id}' OR scope='${member.user.id}'`))[0].n,0)
  await validateArchive()
  Object.assign(fixture,{ops,interrupted})
 })
 return fixture
}
