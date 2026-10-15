import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAuthHandler,DEV_KEY_HEADER} from '../src/base/modules/operator-auth/index.mjs';
import {withDevIdentity} from '../src/base/modules/operator-auth/dev/index.mjs';
import {authConfig} from '../src/platform/operator-auth-runtime.mjs';
import {invitationKeyNotice} from '../src/dev/invitation-confirmation.mjs';
import {teamFixture} from './team-sql-support.mjs';

test('a fresh browser gets actionable local invitation admission guidance, without consuming or admitting the link',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.now()});
 const f=await teamFixture();
 try{
  const env={DB:f.adapter,AUTH_LOCAL:'true',AUTH_ORIGIN:'http://127.0.0.1:15820',OWNER_EMAIL:'owner@example.test',SESSION_SECRET:'synthetic-test-secret-at-least-thirty-two-characters',RER_DEV_KEY:'synthetic_local_dev_key_for_invitation_tests_12345'};
  const branding={name:'Nook',primaryColor:'#5678dc'},handle=createAuthHandler(f.auth);
  const worker=withDevIdentity({async fetch(request){
   const response=await handle(request);
   return response.status===400?await invitationKeyNotice(request,env,f.auth)??response:response;
  }},{config:bindings=>authConfig(bindings,branding)});
  const request=(path,body,cookie,key=false)=>{
   const value=f.request(path,body,cookie),headers=new Headers(value.headers);
   if(key)headers.set(DEV_KEY_HEADER,env.RER_DEV_KEY);
   return new Request(value,{headers});
  };
  const call=(path,body,cookie,key=false)=>worker.fetch(request(path,body,cookie,key),env,{});
  const entered=await call('/auth/dev/enter?as=owner',null,null,true);
  assert.equal(entered.status,303);
  const cookie=entered.headers.getSetCookie().find(value=>value.startsWith('operator_session_local_')).split(';')[0];
  const owner=await f.auth.getSession(request('/auth/session',null,cookie,true));
  f.plan('dev-invite@example.test',{issuer:owner});
  assert.equal((await call('/auth/invite',{email:'dev-invite@example.test',displayName:'Invitee'},cookie,true)).status,202);
  const token=f.token(),path='/auth/confirm?token='+encodeURIComponent(token);
  const denied=await call(path);
  assert.equal(denied.status,403);
  const guidance=await denied.text();
  assert.equal(guidance.includes(env.RER_DEV_KEY),false);assert.equal(guidance.includes(token),false);
  assert.equal(denied.headers.has('set-cookie'),false);
  const head=await worker.fetch(new Request(request(path),{method:'HEAD'}),env,{});
  assert.equal(head.status,403);assert.equal(await head.text(),'');
  assert.equal((await call('/auth/confirm',{token})).status,400,'guidance cannot admit a fresh browser');
  assert.equal((await call(path,null,null,true)).status,200,'the unconsumed link opens once the browser has the key');
  assert.equal((await call('/auth/confirm',{token},null,true)).status,303);
  assert.equal((await call(path)).status,400,'used links retain the ordinary invalid-link response');
  assert.equal((await call(path,null,null,true)).status,400);

  f.plan('cancel-dev-invite@example.test',{issuer:owner});
  assert.equal((await call('/auth/invite',{email:'cancel-dev-invite@example.test',displayName:'Cancelled'},cookie,true)).status,202);
  const cancelled=f.token(),target=f.db.prepare("SELECT id FROM oa_operators WHERE email='cancel-dev-invite@example.test'").get().id;
  assert.equal((await call('/auth/invite/cancel',{operatorId:target},cookie,true)).status,200);
  assert.equal((await call('/auth/confirm?token='+encodeURIComponent(cancelled))).status,400,'revoked links do not claim admission would fix them');

  f.plan('expired-dev-invite@example.test',{issuer:owner});
  assert.equal((await call('/auth/invite',{email:'expired-dev-invite@example.test',displayName:'Expired'},cookie,true)).status,202);
  const expired=f.token(),expiredPath='/auth/confirm?token='+encodeURIComponent(expired);
  t.mock.timers.tick(24*60*60*1000);
  assert.equal((await call(expiredPath)).status,400,'expired invitation does not suggest a dev key will repair it');
  assert.equal((await call(expiredPath,null,null,true)).status,400);
  assert.equal((await call('/auth/confirm',{token:expired},null,true)).status,400);
 }finally{t.mock.timers.reset();f.close()}
});
