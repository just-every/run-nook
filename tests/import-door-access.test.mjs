import './import-door-support.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {zipFixture} from './slack-import/fixture.mjs';
import {slackServiceFixture} from './slack-import/sqlite-service.mjs';

// Real migrated native storage and production HTTP handlers; only R2 is at the
// provider edge. A grant and a cookie traverse the same source and native job.
test('owner reviews, expiration, Business approval/revocation and owner Undo share one import door',async()=>{
 const {importDoor}=await import('../src/imports/door.ts');
 const f=await slackServiceFixture();
 try{
  const origin=f.c.env.AUTH_ORIGIN,env=f.c.env;
  const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  const publicKey=await crypto.subtle.exportKey('jwk',pair.publicKey),kid='import-key';
  Object.assign(env,{RER_OWNER_CLAIM_ISSUER:'https://business.example.test',RER_OWNER_CLAIM_INSTALLATION_ID:'nook-test-installation',RER_OWNER_CLAIM_PUBLIC_KEYS:JSON.stringify({[kid]:publicKey})});
  async function request(action,body,{cookie=f.ownerCookie,originHeader=origin,grant,status=200}={}){
   const response=await importDoor(new Request(origin+(grant?'/api/rer/import/':'/api/operator/import/')+action,{method:'POST',headers:{Host:new URL(origin).host,Origin:originHeader,'Content-Type':'application/json',...(grant?{}:{'X-Import-Source':'slack'}),...(cookie?{cookie}:{}),...(grant?{Authorization:'Bearer '+grant}:{})},body:JSON.stringify(body)}),env);
   const value=await response.json();assert.equal(response.status,status,value.error);if(grant&&!response.ok)assert.match(value.error,/^Slack:/);return value;
  }
  async function token(action,namespace,approval){
   const now=Math.floor(Date.now()/1000),payload={v:1,iss:env.RER_OWNER_CLAIM_ISSUER,aud:origin,installationId:env.RER_OWNER_CLAIM_INSTALLATION_ID,email:f.owner.operator.email,jti:crypto.randomUUID(),iat:now,exp:now+120,action,namespace,maxBytes:64*1024*1024,maxChunks:1024,maxRecords:100000,...approval};
   const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url'),input=encode({alg:'ES256',typ:'rer-import-grant+jwt',kid})+'.'+encode(payload);
   return input+'.'+Buffer.from(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},pair.privateKey,Buffer.from(input))).toString('base64url');
  }
  await request('uploads',{}, {cookie:'',status:401});
  const memberResponse=await f.accept(await f.invite('import-member@example.test'));
  await request('uploads',{}, {cookie:memberResponse.headers.get('set-cookie').split(';')[0],status:403});
  await request('uploads',{}, {originHeader:'https://elsewhere.example.test',status:403});
  const inspection=await f.upload(),expired=await f.preview(inspection);
  await request('apply',{planId:expired.planId,reviewedFingerprint:'0'.repeat(64)},{status:409});
  f.db.prepare('UPDATE nook_door_imports SET expires_at=? WHERE plan_id=?').run(Date.now()-1,expired.planId);
  const refused=await request('apply',{planId:expired.planId,reviewedFingerprint:expired.fingerprint},{status:409});assert.match(refused.error,/Slack.*expired/);
  await request('withdraw',{planId:expired.planId});
  const plan=await f.preview(inspection),namespace='slack:archive-fixture',approval={fingerprint:plan.fingerprint,approvalRecordId:'reviewed-business-proposal',approvedAt:new Date().toISOString()};
  await request('apply',{planId:plan.planId,reviewedFingerprint:plan.fingerprint},{grant:await token('apply',namespace,approval),status:404});
  await request('settings',{enabled:true});
  let job;
  for(let n=0;n<100;n++){
   const result=await request('apply',{planId:plan.planId,reviewedFingerprint:plan.fingerprint},{grant:await token('apply',namespace,approval)});job=result.job;if(job?.state==='completed')break;
  }
  assert.equal(job.state,'completed');
  assert.ok((await f.door.history()).jobs.some(j=>j.planId===plan.planId&&j.caption.includes('via Business')));
  // A request which stages only a bounded file batch is still single-use.
  const rows=Array.from({length:101},(_,i)=>({type:'message',user:'U1',ts:`1700000000.${String(i+1).padStart(6,'0')}`,text:'Historical file '+i,files:[{id:'F'+i,name:'file-'+i+'.txt',mimetype:'text/plain',size:1}]}));
  const source=await f.door.inspect(zipFixture([['users.json',[{id:'U1',name:'File author'}]],['channels.json',[{id:'C1',name:'general'}]],['general/2024-01-01.json',rows],...rows.map((r,i)=>['files/F'+i+'/file-'+i+'.txt','x'])]));
  const staged=await f.door.plan(source,{namespace:'grant-files',actors:{U1:null},channels:[{sourceId:'C1',name:'Granted historical files',members:[f.owner.operatorId]}],acceptedOmissions:[]});
  const fileApproval={fingerprint:staged.fingerprint,approvalRecordId:'reviewed-file-proposal',approvedAt:new Date().toISOString()},fileBody={planId:staged.planId,reviewedFingerprint:staged.fingerprint},fileGrant=await token('apply','slack:grant-files',fileApproval);
  const partial=await request('apply',fileBody,{grant:fileGrant});assert.equal(partial.job,null);assert.ok(partial.files.staged<partial.files.total);
  await request('apply',fileBody,{grant:fileGrant,status:403});
  assert.equal((await request('undo',{planId:staged.planId},{grant:await token('undo','slack:grant-files')})).state,'cancelled');
  for(let n=0;n<10;n++)await f.door.request('cleanup');
  assert.equal((await f.bucket.list()).objects.length,2,'cancelled private file batches leave only the completed import’s files');
  const statusGrant=await token('status',namespace);
  await request('status',{planId:plan.planId},{grant:statusGrant});
  await request('status',{planId:plan.planId},{grant:statusGrant,status:403});
  await request('revocations',{kid});
  await request('status',{planId:plan.planId},{grant:await token('status',namespace),status:403});
  await request('settings',{enabled:false});
  assert.equal((await f.door.undo(plan)).job.state,'undone');
  await request('settings',{enabled:true});
  await request('status',{planId:plan.planId},{grant:await token('status',namespace),status:403});
 }finally{f.close()}
});

test('an oversized import request is refused before its whole body is read',async()=>{
 const {importDoor}=await import('../src/imports/door.ts');
 const f=await slackServiceFixture();
 try{
  const origin=f.c.env.AUTH_ORIGIN,chunk=new Uint8Array(16*1024).fill(32),total=1024*1024,limit=100_000;
  for(const path of ['/api/operator/import/uploads','/api/rer/import/apply','/api/operator/import/unknown']){
   let pulled=0,cancelled=false;
   const body=new ReadableStream({pull(controller){if(pulled>=total)return controller.close();pulled+=chunk.length;controller.enqueue(chunk)},cancel(){cancelled=true}},{highWaterMark:0});
   const response=await importDoor(new Request(origin+path,{method:'POST',duplex:'half',headers:{Host:new URL(origin).host,Origin:origin,'Content-Type':'application/json','X-Import-Source':'slack'},body}),f.c.env);
   assert.equal(response.status,413,path);
   assert.ok(pulled<=2*limit,`${path} read ${pulled} of ${total} bytes`);
   assert.ok(cancelled,`${path} cancels the rest of the body`);
  }
 }finally{f.close()}
});
