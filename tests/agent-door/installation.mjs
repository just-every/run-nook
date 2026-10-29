// Conformance fixture: the emitted production Worker and native signed claim,
// invitation, captured-mail confirmation and Business pairing. No database writes.
import {randomUUID,webcrypto} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {serveHosted,HOSTED_ORIGIN} from '../../node_modules/@runeditrun/rer/cli/hosted-output.mjs';
import {createAgentConformanceNetwork} from '../../node_modules/@runeditrun/rer/cli/agent-network.mjs';
import {verificationReviewers} from '../../node_modules/@runeditrun/rer/cli/agent-reviewers.mjs';
import {signJws,seconds} from '../../src/base/modules/agent-door/conformance/crypto.mjs';
import {createProtocol} from '../../src/base/modules/agent-door/conformance/protocol.mjs';
import initialize from './owner.mjs';
export async function installation(){
 const root=process.cwd(),surface=JSON.parse(await readFile('agent-surface.json','utf8'));
 const email='synthetic-nook-owner@example.com',sub=randomUUID(),kid=randomUUID(),installationId=randomUUID(),issuer='https://synthetic-nook-business.invalid',business='synthetic-nook-conformance';
 const pair=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
 const {kty,crv,x,y}=await webcrypto.subtle.exportKey('jwk',pair.publicKey),publicKeys={[kid]:{kty,crv,x,y,kid,alg:'ES256',use:'sig'}};
 const signer={issuer,installationId,kid,privateKey:pair.privateKey};
 const network=await createAgentConformanceNetwork(root,surface.verification.network,{email}),reviewers=await verificationReviewers(root,surface.verification.reviewers,email),sessions=new Map();
 const outbound=[];
 let hosted;
 try{
  hosted=await serveHosted(root,{declaration:'owner-deployment.json',bindings:{RER_OWNER_CLAIM_ISSUER:issuer,RER_OWNER_CLAIM_INSTALLATION_ID:installationId,RER_OWNER_CLAIM_APP_ORIGIN:HOSTED_ORIGIN,RER_OWNER_CLAIM_PUBLIC_KEYS:JSON.stringify(publicKeys),RER_BUSINESS_TRUST:JSON.stringify({v:1,issuer,audience:HOSTED_ORIGIN,subject:installationId,email,keys:publicKeys}),OWNER_EMAIL:email,SETUP_TOKEN:randomUUID()+randomUUID()},outboundService:async request=>{const copy=reviewers.observes(request)?request.clone():null,response=await network.fetch(request);outbound.push({origin:new URL(request.url).origin,status:response.status});if(copy)await reviewers.capture(copy,response.clone());return response}});
  const origin=hosted.origin,request=(absolute,init={})=>{const url=new URL(absolute,origin);if(url.origin!==origin)throw Error('Fixture request must stay at the disposable installation');return hosted.fetch(url.href.slice(origin.length+1),{...init,headers:Object.fromEntries(new Headers(init.headers))})};
  const claim=await signJws(pair.privateKey,kid,'rer-owner-claim+jwt',{v:1,iss:issuer,aud:origin,installationId,email,jti:randomUUID(),iat:seconds(),exp:seconds()+300});
  const response=await initialize({request,origin,email,claim:{path:'/auth/owner-claim',token:claim},displayName:'Casey Owner',reviewers:{initialize:async(label,owner)=>{const result=await reviewers.initialize(label,owner,{request,origin,returnTo:'/app'});sessions.set(label,result);return result}}});
  const cookie=response.headers.getSetCookie().map(value=>value.split(';',1)[0]).join('; ');await response.body?.cancel();
  let revision=0;
  const roster=[...sessions].map(([label,person])=>({id:randomUUID(),email:person.email,name:label==='teammate'?'Ari Teammate':'Rowan Teammate',role:'member',invite:1,label,cookie:person.cookie}));
  const pairBusiness=async(team=roster)=>{const settings=await signJws(pair.privateKey,kid,'rer-business-settings+jwt',{v:1,iss:issuer,aud:origin,sub:installationId,business,email,owner_id:sub,jti:randomUUID(),iat:seconds(),exp:seconds()+300,rev:++revision,values:{},logo:null,team:team.map(({id,email,name,role,invite})=>({id,email,name,role,invite}))});const paired=await request('/api/rer/business-settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({settings})});if(!paired.ok)throw Error('Native Business pairing HTTP '+paired.status);return paired.json()};
  await pairBusiness();
  const protocol=(person={email,cookie,sub})=>createProtocol({fetch:request,origin,surface,signer,person,business,consent:randomUUID(),agentId:randomUUID(),points:[],seq:0,revision:0,listed:new Map()});
  return {hosted,request,origin,surface,network,outbound,protocol,pairBusiness,roster,owner:{email,cookie,sub},database:await hosted.database('DB'),close:async()=>{await hosted.close();await network.close?.()}};
 }catch(error){await hosted?.close();await network.close?.();throw error}
}
