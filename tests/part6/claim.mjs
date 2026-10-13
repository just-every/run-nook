import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {nativeRuntime} from './native.mjs';

export async function issuerKeys() {
 const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
 return {publicKeys:{local:await crypto.subtle.exportKey('jwk',pair.publicKey)},
  async token(origin,changes={},kid='local') {
   const now=Math.floor(Date.now()/1000);
   const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
   const input=encode({alg:'ES256',typ:'rer-owner-claim+jwt',kid})+'.'+encode({v:1,iss:'http://127.0.0.1:16999',aud:origin,installationId:'nook-local',email:'nativeowner@example.test',jti:randomUUID(),iat:now,exp:now+300,...changes});
   const signature=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},pair.privateKey,new TextEncoder().encode(input));
   return input+'.'+Buffer.from(signature).toString('base64url');
  },
 };
}
export const claimSettings=keys=>({RER_OWNER_CLAIM_ISSUER:'http://127.0.0.1:16999',RER_OWNER_CLAIM_INSTALLATION_ID:'nook-local',RER_OWNER_CLAIM_APP_ORIGIN:'native',RER_OWNER_CLAIM_PUBLIC_KEYS:JSON.stringify(keys.publicKeys)});

export async function claimProof(root) {
 const keys=await issuerKeys(),runtime=await nativeRuntime(root,claimSettings(keys));
 try {
  const before=runtime.snapshot();
  for(const method of ['GET','HEAD']){const response=await runtime.request('/auth/owner-claim',{method});assert.equal(response.status,200);assert.equal(response.headers.has('set-cookie'),false);await response.body?.cancel()}
  assert.equal(runtime.snapshot(),before,'confirmation GET/HEAD write nothing');
  const now=Math.floor(Date.now()/1000);
  for(const changes of [{iss:'https://wrong.test'},{aud:'https://wrong.test'},{installationId:'wrong'},{email:'other@example.test'},{iat:now-400,exp:now-100},{iat:now+120,exp:now+300},{iat:now,exp:now+301}]) {
   const response=await runtime.request('/auth/owner-claim',{method:'POST',body:{token:await keys.token(runtime.origin,changes)}});
   assert.equal(response.status,403);assert.equal(response.headers.has('set-cookie'),false);assert.equal(runtime.snapshot(),before,'invalid claim has no durable effect');
  }
  for(const token of [await keys.token(runtime.origin,{},'unknown'),(await keys.token(runtime.origin)).replace(/.$/,'!')]) {
   assert.equal((await runtime.request('/auth/owner-claim',{method:'POST',body:{token}})).status,403);assert.equal(runtime.snapshot(),before);
  }
  assert.equal((await runtime.request('/auth/owner-claim',{method:'POST',body:{token:await keys.token(runtime.origin)},headers:{Origin:'https://wrong.test'}})).status,403);assert.equal(runtime.snapshot(),before);
  const token=await keys.token(runtime.origin),second=await keys.token(runtime.origin);
  const responses=await Promise.all([token,second].map(token=>runtime.request('/auth/owner-claim',{method:'POST',body:{token,displayName:'Native Owner',returnTo:'/app'}})));
  assert.deepEqual(responses.map(r=>r.status).sort(),[303,409],'one atomic winner');
  const winner=responses.find(r=>r.status===303),cookie=winner.headers.get('set-cookie').split(';')[0];
  assert.equal((await runtime.request('/api/me',{cookie})).status,200,'real product session');
  const admitted=runtime.db.prepare('SELECT a.user,a.mode,a.active FROM nook_access a JOIN oa_bootstrap b ON b.claim_id=a.user').get();
  assert.equal(admitted.mode,'member');assert.equal(admitted.active,1,'Base bootstrap triggers actual Team admission');
  assert.equal(runtime.db.prepare('SELECT count(*) AS n FROM nook_members').get().n,0,'fresh claim invents no conversation grants');
  const claimed=runtime.snapshot();
  for(const replay of [await keys.token(runtime.origin),token,second]) {
   assert.equal((await runtime.request('/auth/owner-claim',{method:'POST',body:{token:replay}})).status,409);assert.equal(runtime.snapshot(),claimed,'second claim/replay retains every table including limits');
  }
  assert.equal((await runtime.request('/auth/bootstrap',{method:'POST',body:{token:runtime.setupToken,displayName:'Replacement'}})).status,409);assert.equal(runtime.snapshot(),claimed,'legacy bootstrap cannot alter claimed installation');
  await runtime.stop();await runtime.start();
  assert.equal((await runtime.request('/auth/owner-claim',{method:'POST',body:{token}})).status,409);assert.equal(runtime.snapshot(),claimed,'replay survives restart');
  assert.equal(runtime.db.prepare('SELECT count(*) AS n FROM oa_operators').get().n,1);
  assert.equal(runtime.db.prepare('SELECT completed FROM oc_owner_claims').get().completed,1);
  console.log('PASS native signed claim: read-only confirmation; issuer/origin/install/mail/key/time fences; concurrent single winner; real session; restart/replay/legacy denial with no partial writes');
 }finally{await runtime.close()}
 const incumbent=await nativeRuntime(root,claimSettings(keys));
 try {
  assert.equal((await incumbent.request('/auth/bootstrap',{method:'POST',body:{token:incumbent.setupToken,displayName:'Incumbent'}})).status,303);
  const before=incumbent.snapshot();assert.equal((await incumbent.request('/auth/owner-claim',{method:'POST',body:{token:await keys.token(incumbent.origin)}})).status,409);assert.equal(incumbent.snapshot(),before);
  console.log('PASS incumbent bootstrap owner is retained when signed claim is attempted');
 }finally{await incumbent.close()}
 // A restored normalized graph has no auth credentials and need not retain a
 // workspace document. Both native admission doors must preserve it unchanged.
 const restored=await nativeRuntime(root,claimSettings(keys));
 try {
  restored.db.exec(`INSERT INTO nook_actors VALUES('retained','Retained','retained@example.test','owner',0);
   INSERT INTO nook_access VALUES('retained','member',0,4);`);
  assert.equal(restored.db.prepare('SELECT count(*) AS n FROM workspace').get().n,0);
  const before=restored.snapshot();
  for(const path of ['/auth/owner-claim','/auth/bootstrap']) {
   const response=await restored.request(path,{method:'POST',body:{token:path.endsWith('owner-claim')?await keys.token(restored.origin):restored.setupToken}});
   assert.equal(response.status,409);assert.equal((await response.json()).error,'identity_recovery_required');
   assert.equal(restored.snapshot(),before,'native admission cannot replace restored actors or resurrect access');
  }
  // Edit the stored authority only while the Worker is stopped, as an operator would.
  await restored.stop();restored.db.exec("UPDATE nook_storage SET authority='legacy' WHERE id=1");const legacy=restored.snapshot();await restored.start();
  const denied=await restored.request('/auth/owner-claim',{method:'POST',body:{token:await keys.token(restored.origin)}});
  assert.equal(denied.status,503);assert.equal((await denied.json()).error,'offline_storage_conversion_required');assert.equal(restored.snapshot(),legacy);
  console.log('PASS restored normalized actors without workspace document require identity recovery; inactive access retained; legacy storage requires conversion');
 }finally{await restored.close()}
}
