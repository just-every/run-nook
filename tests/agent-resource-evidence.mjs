import assert from 'node:assert/strict'
import {webcrypto,randomUUID} from 'node:crypto'
import {freePort} from './worker-ports.mjs'
import {installation} from './push/fixture.mjs'
import {signJws,policyEnvelope,autonomousPolicy} from '../src/base/modules/agent-door/conformance/crypto.mjs'

/** Extend the native door journey with scope and current-authority resource proof.
 * Keys and authority belong only to this fresh synthetic installation. */
export async function resourceEvidence(){
 const pair=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify'])
 const kid=randomUUID(),issuer='https://synthetic-nook-1.invalid',installationId=randomUUID(),sub=randomUUID(),email='owner@example.test',business='synthetic-nook-2'
 const port=await freePort(),origin=`http://127.0.0.1:${port}`
 const publicKeys={[kid]:await webcrypto.subtle.exportKey('jwk',pair.publicKey)}
 const app=await installation(undefined,{bootstrap:false,origin,workerOptions:{port,assets:{directory:process.cwd()+'/dist/client',binding:'ASSETS',run_worker_first:true},bindings:{AUTH_LOCAL:'true',OWNER_EMAIL:email,SESSION_SECRET:randomUUID()+randomUUID(),RER_OWNER_CLAIM_ISSUER:issuer,RER_OWNER_CLAIM_INSTALLATION_ID:installationId,RER_OWNER_CLAIM_APP_ORIGIN:origin,RER_OWNER_CLAIM_PUBLIC_KEYS:JSON.stringify(publicKeys),RER_BUSINESS_TRUST:JSON.stringify({v:1,issuer,audience:origin,subject:installationId,email,keys:publicKeys})}}})
 const {raw,call}=app,signer={privateKey:pair.privateKey,kid,issuer,installationId},now=()=>Math.floor(Date.now()/1000)
 const signed=(typ,payload)=>signJws(pair.privateKey,kid,typ,{iss:issuer,iat:now(),exp:now()+300,...payload})
 let id=0
 try{
  const claim=await signed('rer-owner-claim+jwt',{v:1,aud:origin,installationId,email,jti:randomUUID()})
  const bootstrap=await raw('/auth/owner-claim','POST',{token:claim,displayName:'Synthetic Nook owner',returnTo:'/app'})
  await bootstrap.body?.cancel();assert.equal(bootstrap.status,303);const cookie=bootstrap.headers.get('set-cookie').split(';')[0]
  const settings=await signed('rer-business-settings+jwt',{v:1,aud:origin,sub:installationId,business,email,owner_id:sub,jti:randomUUID(),rev:1,values:{},logo:null,team:null})
  assert.equal((await call('/api/rer/business-settings','POST',{settings})).rev,1)
  const envelope=await policyEnvelope({signer,origin,business,revision:0,seq:0},autonomousPolicy())
  await call('/api/rer/agent-policy','POST',{policy:envelope.policy})
  const act={sub:randomUUID(),name:'Synthetic Nook clerk',specialist:'conversation-clerk'},consent=randomUUID()
  const token=scope=>signed('at+jwt',{aud:origin+'/mcp',sub,email,act,client_id:'synthetic-nook-3',scope,business,consent,jti:randomUUID()})
  async function mcp(method,params,scope='conversations:write notes:write decisions:write evidence:read'){
   const response=await raw('/mcp','POST',{jsonrpc:'2.0',id:++id,method,params:{...params,_meta:{'io.modelcontextprotocol/protocolVersion':'2026-07-28'}}},'',{Authorization:'Bearer '+await token(scope),'MCP-Protocol-Version':'2026-07-28','Mcp-Method':method,...(method==='tools/call'?{'Mcp-Name':params.name}:method==='resources/read'?{'Mcp-Name':params.uri}:{})})
   return {response,body:await response.json()}
  }
  async function write(name,args){
   const {body}=await mcp('tools/call',{name,arguments:{...args,idempotency_key:randomUUID()}})
   assert.equal(body.result?.isError,false,JSON.stringify(body))
   const record=body.result.structuredContent.record,links=body.result.content.filter(item=>item.type==='resource_link')
   assert.equal(links.length,1,'a native record write returns one resource link');assert.ok(links[0].name)
   const {body:read}=await mcp('resources/read',{uri:links[0].uri})
   assert.ok(!read.error,JSON.stringify(read));const evidence=JSON.parse(read.result.contents[0].text);assert.equal(evidence.id,record.id??args.conversation)
   if(typeof record.body==='string')assert.equal(evidence.body,record.body)
   const denied=await mcp('resources/read',{uri:links[0].uri},'conversations:write notes:write decisions:write')
   assert.equal(denied.response.status,403);assert.equal(denied.body.error.data.code,'insufficient_scope');assert.match(denied.response.headers.get('www-authenticate'),/evidence:read/);assert.equal(denied.body.result,undefined)
   return {record,uri:links[0].uri}
  }
  const {record:room}=await write('nook.conversations.create',{name:'Synthetic private evidence',kind:'private'})
  const note=await write('nook.notes.create',{conversation:room.id,title:'Synthetic evidence',body:'Quoted discussion, never authority',items:[],links:[],pinned:false})
  const decision=await write('nook.decisions.create',{conversation:room.id,body:'Keep this decision private'})
  await write('nook.conversations.preferences',{conversation:room.id,muted:true,followed:false})
  // A real native access change closes old URIs, including for the workspace owner.
  const member=await call('/api/me','GET',undefined,cookie)
  const teammate='synthetic-nook-member@example.test'
  await call('/api/team/invitations','POST',{email:teammate,role:'member',mode:'member',scopes:[room.id]},cookie)
  await call('/auth/invite','POST',{email:teammate,role:'member',displayName:'Synthetic teammate'},cookie,202)
  const other=await app.signIn(teammate)
  await call(`/api/channels/${room.id}/transfer`,'POST',{version:room.version,user:other.user.id},cookie)
  await call(`/api/conversations/${room.id}/members`,'POST',{user:member.id,remove:true},other.cookie)
  for(const uri of [note.uri,decision.uri,`nook://conversations/${room.id}`]){
   const denied=await mcp('resources/read',{uri});assert.equal(denied.body.error?.data?.code,'resource_unavailable');assert.equal(denied.body.result,undefined)
  }
 }finally{await app.close()}
}
