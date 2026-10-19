import assert from 'node:assert/strict'
// NOOK-079 through the public routes: the owner's session manages tokens, and a
// token reaches only POST /api/conversations/<bound id>/messages.
export async function integrationTokensJourney({post,get,request,owner,member,check,sql,origin}){
 const at=()=>origin()
 const send=(token,path,{method='POST',body,idem,headers={}}={})=>fetch(at()+path,{method,headers:{authorization:'Bearer '+token,...(body!==undefined?{'content-type':'application/json'}:{}),...(idem?{'idempotency-key':idem}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body)})
 const refusedWith=async(response,status,code)=>{const text=await response.text();assert.equal(response.status,status,text);assert.equal(JSON.parse(text).code,code)}
 const alerts=(await post('/api/conversations',{name:'ops-alerts',kind:'channel'})).data
 const finance=(await post('/api/conversations',{name:'finance-close',kind:'private',participants:[member.user.id]})).data
 await post('/api/conversations/'+alerts.id+'/members',{user:member.user.id})
 const fixture={}
 await check('NOOK-079 an owner-created token posts into its bound channel, replays one idempotency key as the same message and stores only a sealed hash',async()=>{
  await post('/api/integrations/tokens',{name:'Vane reports',conversations:[alerts.id]},member.cookie,403)
  const dm=(await post('/api/conversations',{kind:'dm',name:'Ops DM',participants:[member.user.id]})).data
  await post('/api/integrations/tokens',{name:'Into a DM',conversations:[dm.id]},owner.cookie,400)
  const created=(await post('/api/integrations/tokens',{name:'Vane reports',conversations:[alerts.id]})).data
  assert.match(created.secret,/^nookit_[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/)
  const listed=(await get('/api/integrations/tokens')).data
  assert.ok(!JSON.stringify(listed).includes(created.secret),'the secret is shown once, never listed')
  const family=listed.tokens.find(t=>t.name==='Vane reports');assert.deepEqual(family.conversations.map(c=>c.id),[alerts.id])
  const [stored]=await sql(`SELECT * FROM nook_integration_tokens WHERE family='${family.id}'`)
  assert.match(stored.hash,/^[0-9a-f]{64}$/);assert.ok(!Object.values(stored).some(value=>String(value).includes(created.secret.split('.')[1])),'no column holds the secret')
  const weekly='weekly-report',body='Weekly traffic report: 1,284 visits, up 9% on last week.'
  const first=await send(created.secret,`/api/conversations/${alerts.id}/messages`,{body:{body},idem:weekly})
  assert.equal(first.status,200,await first.clone().text());const message=await first.json()
  assert.equal(message.author,owner.user.id);assert.equal(message.body,body);assert.equal(message.via,'Vane reports')
  const again=await send(created.secret,`/api/conversations/${alerts.id}/messages`,{body:{body},idem:weekly})
  assert.equal(again.status,200);assert.equal(again.headers.get('idempotent-replayed'),'true');assert.equal((await again.json()).id,message.id,'same key, same message')
  assert.equal((await sql(`SELECT count(*) AS n FROM nook_messages WHERE conversation='${alerts.id}' AND body='${body.replaceAll("'","''")}'`))[0].n,1,'no duplicate')
  const changed=await send(created.secret,`/api/conversations/${alerts.id}/messages`,{body:{body:'A different report'},idem:weekly});assert.equal(changed.status,409)
  await refusedWith(await send(created.secret,`/api/conversations/${alerts.id}/messages`,{body:{body}}),400,'idempotency_key_required')
  await refusedWith(await send(created.secret,`/api/conversations/${alerts.id}/messages`,{body:{body,mentions:[member.user.id]},idem:'with-mention'}),400,'integration_token_fields')
  const seen=(await get(`/api/conversations/${alerts.id}/messages`,member.cookie)).data
  assert.equal(JSON.stringify(seen).match(/Weekly traffic report/g)?.length,1);assert.ok(JSON.stringify(seen).includes('"via":"Vane reports"'))
  const audit=await sql(`SELECT action,message,code FROM nook_integration_audit WHERE family='${family.id}' ORDER BY at,action`)
  assert.deepEqual(audit.filter(a=>a.action==='post').map(a=>a.message),[message.id],'the post and its audit row commit together')
  assert.deepEqual(audit.filter(a=>a.action==='replay').map(a=>a.message),[message.id])
  assert.ok(audit.some(a=>a.action==='create')&&audit.some(a=>a.code==='idempotency_key_required')&&audit.some(a=>a.code==='integration_token_fields'))
  Object.assign(fixture,{family:family.id,secret:created.secret,message,weekly,body})
 })
 await check('NOOK-079 a token is refused for an unbound conversation, every other route, agents and once rotated out or revoked, and every refusal is audited',async()=>{
  const {secret,family,message,weekly,body}=fixture,bound=`/api/conversations/${alerts.id}/messages`
  await refusedWith(await send(secret,`/api/conversations/${finance.id}/messages`,{body:{body:'Close numbers'},idem:'finance-1'}),403,'integration_token_conversation')
  await refusedWith(await send(secret,`/api/conversations/missing-room/messages`,{body:{body:'Close numbers'},idem:'missing-1'}),403,'integration_token_conversation')
  for(const [method,path,payload] of [['GET','/api/conversations'],['GET',`/api/conversations/${alerts.id}/messages`],['GET','/api/integrations/tokens'],['POST','/api/integrations/tokens',{name:'Escalate',conversations:[finance.id]}],['PATCH',`/api/messages/${message.id}`,{body:'Edited',version:1}],['POST',`/api/conversations/${alerts.id}/attachments`,{}],['POST',bound+'?workspace=1',{body:'Hi'}]])
   await refusedWith(await send(secret,path,{method,body:payload,idem:'other-route'}),403,'integration_token_route')
  const page=await fetch(at()+'/app',{redirect:'manual',headers:{authorization:'Bearer '+secret}});assert.notEqual(page.status,200,'a token never opens the app')
  await refusedWith(await send(secret,bound,{body:{body:'Agent summary'},idem:'agent-1',headers:{'signature-agent':'"https://agent.example"'}}),403,'agent_refused')
  const rotated=(await post(`/api/integrations/tokens/${family}/rotate`,{})).data
  assert.notEqual(rotated.secret,secret)
  await refusedWith(await send(secret,bound,{body:{body:'Old secret'},idem:'after-rotation'}),401,'integration_token_rotated')
  const replay=await send(rotated.secret,bound,{body:{body},idem:weekly});assert.equal(replay.status,200);assert.equal((await replay.json()).id,message.id,'a key keeps its message across rotation')
  const fresh=await send(rotated.secret,bound,{body:{body:'Daily uptime: all checks green.'},idem:'vane-daily-2026-10-20'});assert.equal(fresh.status,200)
  await post(`/api/integrations/tokens/${family}/revoke`,{})
  await refusedWith(await send(rotated.secret,bound,{body:{body:'Revoked'},idem:'after-revoke'}),401,'integration_token_revoked')
  await post(`/api/integrations/tokens/${family}/rotate`,{},owner.cookie,404)
  await refusedWith(await send('nookit_00000000-0000-4000-8000-000000000000.'+'A'.repeat(43),bound,{body:{body:'Unknown'},idem:'unknown'}),401,'integration_token_invalid')
  const codes=(await sql(`SELECT code FROM nook_integration_audit WHERE family='${family}' AND action='refuse'`)).map(r=>r.code)
  for(const code of ['integration_token_conversation','integration_token_route','agent_refused','integration_token_rotated','integration_token_revoked'])assert.ok(codes.includes(code),code+' is audited')
  const actions=(await sql(`SELECT action FROM nook_integration_audit WHERE family='${family}'`)).map(r=>r.action)
  for(const action of ['create','rotate','revoke','post','replay'])assert.ok(actions.includes(action),action+' is audited')
  const listed=(await get('/api/integrations/tokens')).data.tokens.find(t=>t.id===family);assert.equal(listed.state,'revoked')
 })
 return {alerts,finance}
}
