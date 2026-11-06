import assert from 'node:assert/strict'
import {signIn} from './auth-support.mjs'
export async function auditJourney({post,get,request,owner,member,registered,check,sql,origin,validateArchive,roundTrip,withoutBrowser}){
 await check('NOOK-051 membership revocation, export, erasure and an interrupted step appear in an admin-only filterable log, an erased actor is anonymized with the facts kept, and the log survives archive restore',async()=>{
  const room=(await post('/api/conversations',{name:'Operations · customer launch',kind:'private',participants:[member.user.id]})).data
  const target=await registered('AuditDeparting'),adminName='AuditCustodian',email=adminName.toLowerCase()+'@example.test'
  await post('/api/team/invitations',{email,role:'admin',mode:'member',scopes:[room.id]})
  await post('/auth/invite',{email,displayName:adminName,role:'admin'},owner.cookie,202)
  const admin=await signIn(origin(),email,{requestLink:false})
  const guestName='AuditGuest',guestEmail=guestName.toLowerCase()+'@example.test'
  await post('/api/team/invitations',{email:guestEmail,role:'member',mode:'guest',scopes:[room.id]});await post('/auth/invite',{email:guestEmail,displayName:guestName,role:'member'},owner.cookie,202)
  const guest=await signIn(origin(),guestEmail,{requestLink:false})
  const own=(await post('/api/conversations',{name:'Departing team handoff',kind:'channel'},target.cookie)).data
  const before=(await get('/api/team/audit?actor='+target.user.id,admin.cookie)).data.items;assert.ok(before.some(row=>row.kind==='channel.created'))
  await post('/api/team/remove',{user:member.user.id,conversation:room.id})
  // A membership fact names the person who acted and the member it affected.
  for(const [kind,who] of [['membership.join','granted'],['membership.leave','removed']])for(const format of ['page','json','csv']){
   const value=await get('/api/team/audit?kind='+kind+'&scope='+encodeURIComponent(room.id)+'&format='+format,admin.cookie)
   if(format==='csv')assert.ok(value.raw.split('\n').some(row=>row.includes(owner.user.id)&&row.includes(member.user.id)&&row.includes(member.user.name)&&row.includes(who)),'private-channel '+kind+' CSV names actor and affected member')
   else assert.ok(value.data.items.some(row=>row.actor===owner.user.id&&row.subject===member.user.id&&row.subjectName===member.user.name&&row.reason.includes(who)),'private-channel '+kind+' '+format+' names actor and affected member')
  }
  const details=(await get('/api/channels/'+room.id+'/details')).data
  await request('/api/channels/'+room.id+'/posting',{method:'PATCH',cookie:owner.cookie,body:{version:details.version,level:'managers',replies:'same',people:[]}})
  await post('/api/conversations/'+room.id+'/messages',{body:'Customer launch approved; keep the audit free of this message body.',intent:crypto.randomUUID(),adminOverride:true},admin.cookie)
  const token=(await post('/api/integrations/tokens',{name:'Release handoff',conversations:[room.id]})).data
  const family=token.tokens.find(row=>row.name==='Release handoff').id
  const rotated=(await post('/api/integrations/tokens/'+family+'/rotate',{})).data;await post('/api/integrations/tokens/'+family+'/revoke',{})
  const started=(await post('/api/readable-exports',{scope:'conversation',conversationId:room.id,custodyAccepted:true})).data
  await post('/api/readable-exports/'+started.id+'/step',{})
  // The accepted bounded job is interrupted before completion, and survives a
  // cancellation as uncertain; the server has not produced a complete artifact.
  await post('/api/readable-exports/'+started.id+'/cancel',{})
  const interrupted=(await get('/api/team/audit?kind=export.cancelled&outcome=uncertain',admin.cookie)).data.items
  assert.equal(interrupted.length,1);assert.equal(interrupted[0].actor,owner.user.id)
  const complete=(await post('/api/readable-exports',{scope:'conversation',conversationId:room.id,custodyAccepted:true})).data
  let report=complete;for(let n=0;n<100&&report.state!=='complete';n++)report=(await post('/api/readable-exports/'+complete.id+'/step',{})).data;assert.equal(report.state,'complete')
  const erased=await post('/api/erasures',{kind:'member',target:target.user.id,confirmation:'ERASE'})
  let receipt=erased.data;for(let n=0;n<100&&receipt.state!=='complete';n++)receipt=(await post('/api/erasures/'+receipt.id+'/resume',{})).data;assert.equal(receipt.state,'complete')
  await get('/api/team/audit',target.cookie,401);await get('/api/team/audit',member.cookie,403);await get('/api/team/audit',guest.cookie,403)
  const anonymous=(await get('/api/team/audit?actor=anonymous',admin.cookie)).data.items
  for(const previous of before){const kept=anonymous.find(row=>row.id===previous.id);assert.ok(kept,previous.kind);assert.equal(kept.actor,null);for(const key of ['at','scope','version','reason','outcome','count'])assert.equal(kept[key],previous[key])}
  const filtered=(await get('/api/team/audit?kind=policy.posting&scope='+encodeURIComponent(room.id)+'&outcome=confirmed&actor='+owner.user.id+'&from=2000-01-01&until=2100-01-01',admin.cookie)).data
  assert.equal(filtered.items.length,1)
  const deniedBefore=(await sql('SELECT count(*) AS n FROM nook_audit'))[0].n
  await request('/api/channels/'+room.id+'/posting',{method:'PATCH',cookie:member.cookie,body:{version:details.version,level:'everyone',replies:'everyone',people:[]},status:403})
  assert.equal((await sql('SELECT count(*) AS n FROM nook_audit'))[0].n,deniedBefore)
  const dm=(await post('/api/conversations',{name:'Confidential compensation discussion',kind:'dm',participants:[owner.user.id]},member.cookie)).data
  await post('/api/conversations/'+dm.id+'/messages',{body:'Private compensation marker should never enter audit',intent:crypto.randomUUID()},member.cookie)
  const adminDm=(await post('/api/conversations',{name:'Confidential admin discussion',kind:'dm',participants:[admin.user.id]},member.cookie)).data
  // An unrelated owner or admin may audit the action, but cannot discover its other DM participant through any format.
  for(const [conversation,reader,participant] of [[dm,admin,owner],[adminDm,owner,admin]]){
   await get('/api/conversations/'+conversation.id+'/messages',reader.cookie,403)
   const query='kind=membership.join&scope='+encodeURIComponent(conversation.id)
   for(const format of ['page','json','csv']){
    const value=await get('/api/team/audit?'+query+'&format='+format,reader.cookie)
    assert.ok(!value.raw.includes(participant.user.id)&&!value.raw.includes(participant.user.name),'nonparticipant '+format+' hides the affected DM member')
    if(format==='csv'){assert.equal(value.raw.trim().split('\n').length,3);assert.match(value.raw,/a direct conversation/)}
    else {assert.equal(value.data.items.length,2);for(const row of value.data.items){assert.equal(row.actor,member.user.id);assert.equal(row.actorName,member.user.name);assert.equal(row.scope,'a direct conversation');assert.equal(row.count,1);assert.equal(row.subject,null);assert.equal(row.subjectName,null)}}
   }
   const ownEvents=(await get('/api/team/audit?'+query,participant.cookie)).data.items
   assert.ok(ownEvents.some(row=>row.subject===participant.user.id&&row.subjectName===participant.user.name),'current participant retains their DM audit detail')
  }
  const download=await get('/api/team/audit?format=json',admin.cookie);assert.ok(download.data.items.some(row=>row.kind==='channel.created'&&row.scope==='a direct conversation'));assert.ok(download.data.items.some(row=>row.kind==='integration.rotate'&&row.reason==='Token label: Release handoff'));assert.ok(!download.raw.includes(token.secret)&&!download.raw.includes(rotated.secret));assert.doesNotMatch(download.raw,/Confidential compensation|Private compensation marker|Customer launch approved|token_hash|SESSION_SECRET/)
  const empty=await get('/api/team/audit?format=csv&kind=not-a-real-action',admin.cookie);assert.equal(empty.raw.trim().split('\n').length,1)
  const csv=await get('/api/team/audit?format=csv&kind=policy.posting',admin.cookie);assert.match(csv.raw,/policy.posting/)
  await request('/api/team/audit',{method:'PATCH',body:{},cookie:admin.cookie,status:405})
  await validateArchive()
  if(!withoutBrowser)await(await import('./audit-browser.mjs')).auditBrowser({origin:origin(),admin,member,direct:{id:dm.id,actorName:member.user.name,participantName:owner.user.name}})
  await roundTrip({owner,admin,rows:download.data.items})
 })
}
