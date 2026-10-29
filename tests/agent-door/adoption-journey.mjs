// Additional native security legs of the agent-door conformance journey.
// Run against a fresh emitted production Worker; no test registration or bypass.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {installation} from './installation.mjs';
import {subscriber} from '../push/packet.mjs';
import {autonomousPolicy,accessToken} from '../../src/base/modules/agent-door/conformance/crypto.mjs';
import {errorCode} from '../../src/base/modules/agent-door/conformance/protocol.mjs';
const f=await installation();
try{
 const c=f.protocol(),personCall=async(path,body,cookie=f.owner.cookie,method=body===undefined?'GET':'POST')=>{const response=await f.request(path,{method,headers:{Origin:f.origin,Cookie:cookie,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});assert.ok(response.ok,'Native '+path+' HTTP '+response.status);return response.headers.get('content-type')?.includes('application/json')?response.json():response.text()};
 const call=async(tool,args={})=>{const answer=await c.tool('nook.'+tool,{...args,...(f.surface.tools.find(t=>t.name==='nook.'+tool)?.readOnly?{}:{idempotency_key:randomUUID()})});assert.ok(answer.result?.structuredContent&&!answer.result.isError,tool+': '+errorCode(answer));return answer.result.structuredContent};
 await c.adopt(autonomousPolicy());
 const me=await personCall('/api/me'),team=await personCall('/api/team'),ari=team.find(p=>p.email===f.roster[0].email);
 const b=f.protocol({email:f.roster[0].email,cookie:f.roster[0].cookie,sub:f.roster[0].id});
 const scoped=await b.tool('nook.identity.read',{});assert.equal(scoped.result?.structuredContent?.id,ari.id);
 const unmapped=await c.mcp('tools/list',{}, {token:await accessToken(c,{sub:randomUUID(),email:f.owner.email})});assert.equal(unmapped.status,401);
 const missingConsent=await c.mcp('tools/list',{}, {token:await accessToken(c,{consent:undefined})});assert.equal(missingConsent.status,401);
 console.log('NOOK_PEOPLE '+JSON.stringify({scoped_call:scoped.status,distinct_native_id:ari.id!==me.id,unknown_subject_same_owner_email:unmapped.status,missing_consent:missingConsent.status}));
 // A retained native response must disappear after the sponsor leaves its room.
 const room=await call('conversations.create',{name:'Replay custody',kind:'private',participants:[ari.id]});
 const args={conversation:room.id,body:'Private replay evidence',idempotency_key:randomUUID()};
 const before=(await f.database.prepare('SELECT count(*) AS n FROM nook_messages WHERE conversation=?').bind(room.id).first()).n;
 const first=await c.tool('nook.messages.post',args),repeat=await c.tool('nook.messages.post',args);assert.deepEqual(repeat.result.structuredContent,first.result.structuredContent);
 const changed=await c.tool('nook.messages.post',{...args,body:'Changed evidence'});assert.equal(errorCode(changed),'idempotency_conflict');
 const detail=await call('conversations.read',{id:room.id});
 await call('conversations.transfer',{id:room.id,user:ari.id,version:detail.version});
 await personCall('/api/conversations/'+room.id+'/members',{user:me.id,remove:true},f.roster[0].cookie);
 const replay=await c.tool('nook.messages.post',args);assert.equal(errorCode(replay),'not_found');assert.equal(replay.result.structuredContent,undefined);
 const after=(await f.database.prepare('SELECT count(*) AS n FROM nook_messages WHERE conversation=?').bind(room.id).first()).n;assert.equal(after,before+1);
 const events=await c.tool('nook.events.list',{});assert.ok(!JSON.stringify(events.result.structuredContent).includes(room.id));
 console.log('NOOK_REPLAY '+JSON.stringify({before,after_first:before+1,after_replay:after,replay_code:errorCode(replay),prior_body:false,retained_events:0,changed_arguments:errorCode(changed)}));
 // Native notifications inherit the originating agent consent in both queues.
 const device=await personCall('/api/devices'),recipient=subscriber('synthetic-nook-consent-'+randomUUID()),publicKey=recipient.key.getPublicKey();
 f.network.fixtures.set('https://web.push.apple.com',{publicKey:device.publicKey,email:f.owner.email,label:'Agent door conformance for Casey Owner',recipient:{auth:Buffer.from(recipient.auth).toString('base64url'),publicKey:publicKey.toString('base64url'),privateKey:{kty:'EC',crv:'P-256',x:publicKey.subarray(1,33).toString('base64url'),y:publicKey.subarray(33).toString('base64url'),d:recipient.key.getPrivateKey().toString('base64url')}}});
 await personCall('/api/devices',{transport:'webpush',subscription:recipient.subscription},f.roster[0].cookie);
 await personCall('/api/notify',{mentions:true,urgent:false,urgentQuiet:false,push:{mentions:true}},f.roster[0].cookie,'PATCH');
 const deliveredRoom=await call('conversations.create',{name:'Accepted provider receipt',kind:'private',participants:[ari.id]});
 const delivered=await call('messages.post',{conversation:deliveredRoom.id,body:'Ari, review the delivered source.',mentions:[ari.id]});
 const live=await f.database.prepare('SELECT due FROM nook_notify_queue WHERE message=?').bind(delivered.id).all();
 await new Promise(resolve=>setTimeout(resolve,Math.max(...live.results.map(row=>row.due))-Date.now()+2000));
 const receipt=await f.database.prepare("SELECT state FROM nook_notify_queue WHERE message=? AND channel='push'").bind(delivered.id).first();assert.equal(receipt.state,'sent');assert.ok(f.outbound.some(r=>r.origin==='https://web.push.apple.com'&&r.status===201));
 console.log('NOOK_PROVIDER_EDGE '+JSON.stringify({origin:'https://web.push.apple.com',native_vapid_and_encrypted_payload:true,receipt:201,attribution:true,state:receipt.state}));
 const queuedRoom=await call('conversations.create',{name:'Consent boundary',kind:'private',participants:[ari.id]});
 const message=await call('messages.post',{conversation:queuedRoom.id,body:'Ari, inspect the source.',mentions:[ari.id]});
 const proposed=await call('outcomes.propose',{conversation:queuedRoom.id,kind:'commitment',body:'Inspect the source proposal',assignee:ari.id});
 await call('outcomes.revise',{id:proposed.id,version:proposed.version,body:'Inspect the revised source proposal'});
 const note=await call('notes.create',{conversation:queuedRoom.id,title:'Source checklist',body:'Evidence to review',items:[{id:'review',text:'Inspect the checklist proposal',checked:false}],links:[],pinned:false});
 await call('notes.propose',{conversation:queuedRoom.id,id:note.id,version:note.version,item:'review',assignee:ari.id});
 await personCall('/api/conversations/'+queuedRoom.id+'/notify',{level:'all'},f.roster[0].cookie,'PATCH');
 await call('polls.create',{conversation:queuedRoom.id,question:'Which review time?',options:['Morning','Afternoon'],multiple:false,anonymous:true});
 const queue=await f.database.prepare('SELECT id,channel,agent_context,due FROM nook_notify_queue WHERE conversation=?').bind(queuedRoom.id).all();assert.ok(queue.results.length>=9);
 const operations=new Set(queue.results.map(row=>JSON.parse(row.agent_context).operationId));assert.equal(operations.size,5);
 for(const item of queue.results){const origin=JSON.parse(item.agent_context);assert.equal(origin.consent,c.consent);assert.equal(origin.person,me.id);assert.ok(origin.operationId&&origin.scopes.length)}
 const effectsBefore=f.outbound.length;
 await c.adopt(autonomousPolicy(),{revoked:{agents:[],consents:[c.consent]}});
 await new Promise(resolve=>setTimeout(resolve,Math.max(...queue.results.map(row=>row.due))-Date.now()+2000));
 const cancelled=await f.database.prepare('SELECT state,error FROM nook_notify_queue WHERE conversation=?').bind(queuedRoom.id).all();
 assert.equal(f.outbound.length,effectsBefore);
 assert.ok(cancelled.results.every(row=>row.state==='cancelled'&&row.error==='consent_revoked'));
 console.log('NOOK_QUEUED_CONSENT '+JSON.stringify({queued:queue.results.length,tools:['messages.post','outcomes.propose','outcomes.revise','notes.propose','polls.create'],persisted_consent:true,refusal:'consent_revoked',effects_after_revocation:0,states:cancelled.results}));
 // Business role derives from the signed roster, not a local admin promotion.
 await personCall('/auth/operator/role',{operatorId:ari.id,role:'admin'});
 const member=await b.tool('nook.identity.read',{});assert.equal(member.status,200);
 const bound=await f.database.prepare('SELECT operator_id,business_role FROM bs_team WHERE business_id=?').bind(f.roster[0].id).first();assert.equal(bound.operator_id,ari.id);assert.equal(bound.business_role,'member');
 const renamed=f.roster.map((p,i)=>i===0?{...p,email:'synthetic-nook-ari-renamed@example.com'}:p);await f.pairBusiness(renamed);
 const same=await f.database.prepare('SELECT operator_id FROM bs_team WHERE business_id=?').bind(f.roster[0].id).first();assert.equal(same.operator_id,ari.id);
 await personCall('/auth/operator/status',{operatorId:ari.id,status:'inactive'});
 const inactive=await b.tool('nook.identity.read',{});assert.equal(inactive.status,401);
 console.log('NOOK_TEAM_RECONCILIATION '+JSON.stringify({native_role_promotion_does_not_change_business_role:bound.business_role,email_change_preserves_native_id:same.operator_id===ari.id,inactive_person:inactive.status}));
}finally{await f.close()}
