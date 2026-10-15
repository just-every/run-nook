import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {sqliteBinding} from './sqlite-binding.mjs';
import {createConfiguredAuth,developmentMail,acceptsRequest} from '../src/platform/operator-auth-runtime.mjs';
import {createAuthHandler} from '../src/base/modules/operator-auth/index.mjs';
import {ownerSigninDigest} from '../src/base/modules/operator-auth/owner-signin-grant.mjs';

test('configured production auth delivers through the selected mail transport, fences trusted IPs and consumes native links once',async()=>{
 const db=sqliteBinding(),fetchBefore=globalThis.fetch,messages=[];
 try{
  // The real schema: operator auth reads oa_dev_credentials when it previews a link, so a store without the dev-sessions migration fails closed.
  for(const file of readdirSync(new URL('../migrations/',import.meta.url)).filter(name=>name.endsWith('.sql')).sort())db.sqlite.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
  const env={DB:db,AUTH_LOCAL:'false',AUTH_ORIGIN:'https://workspace.example.test',OWNER_EMAIL:'owner@example.test',SESSION_SECRET:crypto.randomUUID()+crypto.randomUUID(),SETUP_TOKEN:crypto.randomUUID()+crypto.randomUUID(),MAIL_PROVIDER:'sendgrid',MAIL_FROM:'signin@example.test',MAIL_API_KEY:'synthetic-provider-credential'},brand={name:'Nook',primaryColor:'#5678dc'};
  globalThis.fetch=async(url,init)=>{assert.equal(url,'https://api.sendgrid.com/v3/mail/send');messages.push(JSON.parse(init.body));return new Response(null,{status:202,headers:{'x-message-id':crypto.randomUUID()}})};
  const auth=createConfiguredAuth(env,brand),handler=createAuthHandler(auth);
  const call=(path,{method='POST',body={},ip='192.0.2.10',headers={}}={})=>handler(new Request(env.AUTH_ORIGIN+path,{method,headers:{Host:new URL(env.AUTH_ORIGIN).host,Origin:env.AUTH_ORIGIN,...(ip?{'CF-Connecting-IP':ip}:{}),...(method==='POST'?{'Content-Type':'application/json'}:{}),...headers},...(method==='POST'?{body:JSON.stringify(body)}:{})}));
  assert.equal(acceptsRequest(env,new Request(env.AUTH_ORIGIN+'/signin')),true);assert.equal(acceptsRequest(env,new Request('https://other.example.test/signin')),false);assert.equal(acceptsRequest(env,new Request('http://workspace.example.test/signin')),false);assert.equal(developmentMail(env),false);assert.equal(acceptsRequest({...env,RER_DEV_ORIGIN:'http://127.0.0.1:15820'},new Request('http://127.0.0.1:15820/signin')),false);assert.throws(()=>createConfiguredAuth({...env,AUTH_ORIGIN:undefined},brand),error=>error.code==='invalid_configuration'&&error.status===503);
  for(const invalid of [{MAIL_PROVIDER:'development'},{MAIL_API_KEY:undefined},{MAIL_FROM:''}])assert.throws(()=>createConfiguredAuth({...env,...invalid},brand),error=>error.status===503&&error.code==='mail_configuration_required');
  const missingIp=await call('/auth/bootstrap',{ip:null,headers:{'X-Forwarded-For':'192.0.2.10'},body:{token:env.SETUP_TOKEN,displayName:'Owner'}});assert.equal(missingIp.status,503);assert.equal((await missingIp.json()).error,'client_ip_unavailable');assert.equal(db.sqlite.prepare('SELECT count(*) AS n FROM oa_operators').get().n,0);
  const bootstrap=await call('/auth/bootstrap',{body:{token:env.SETUP_TOKEN,displayName:'Owner'}});assert.equal(bootstrap.status,303);assert.match(bootstrap.headers.get('set-cookie'),/^__Host-operator_session=/);assert.match(bootstrap.headers.get('set-cookie'),/; Secure/);
  // rer signin's Cloudflare edge writes only the grant's digest. The real HTTP
  // adapter must preview without consuming it and admit the recorded owner once.
  const owner=db.sqlite.prepare("SELECT id,version FROM oa_operators WHERE role='owner'").get(),ownerToken=randomBytes(32).toString('base64url');
  const grant=(token,version=owner.version)=>db.sqlite.prepare('INSERT INTO oa_owner_signins(id,token_hash,operator_id,operator_version,created_at,expires_at) VALUES(?,?,?,?,?,?)').run(crypto.randomUUID(),token,owner.id,version,Date.now(),Date.now()+600000);
  grant(await ownerSigninDigest(ownerToken));
  for(const method of ['GET','HEAD']){const preview=await call('/auth/owner-signin?token='+ownerToken,{method});assert.equal(preview.status,200);assert.equal(preview.headers.has('set-cookie'),false)}
  assert.equal(db.sqlite.prepare('SELECT consumed_at FROM oa_owner_signins').get().consumed_at,null);
  assert.equal((await call('/auth/owner-signin',{body:{token:ownerToken},headers:{Origin:'https://elsewhere.example.test'}})).status,403);
  const ownerSignin=await call('/auth/owner-signin',{body:{token:ownerToken}});assert.equal(ownerSignin.status,303);
  const ownerSession=await call('/auth/session',{method:'GET',headers:{Cookie:ownerSignin.headers.get('set-cookie').split(';')[0]}});assert.equal(ownerSession.status,200);assert.equal((await ownerSession.json()).operator.id,owner.id);
  assert.equal((await call('/auth/owner-signin',{body:{token:ownerToken}})).status,400,'owner grant is single use');
  const stale=randomBytes(32).toString('base64url');grant(await ownerSigninDigest(stale),owner.version+1);assert.equal((await call('/auth/owner-signin',{body:{token:stale}})).status,400,'grant cannot admit a different owner version');
  assert.equal(db.sqlite.prepare("SELECT count(*) AS n FROM oa_auth_audit WHERE action='owner:signin-link'").get().n,1);assert.equal(messages.length,0,'owner sign-in needs no mail delivery');
  const count=()=>db.sqlite.prepare('SELECT count(*) AS n FROM oa_operators').get().n;
  const before=count();assert.equal((await call('/auth/magic-link',{body:{email:'unknown@example.test'}})).status,202);assert.equal(count(),before);assert.equal(messages.length,0);
  db.sqlite.prepare('UPDATE oa_limits SET count=?').run(Number.MAX_SAFE_INTEGER-1);
  assert.equal((await call('/auth/magic-link',{body:{email:'owner@example.test'},headers:{'X-Forwarded-For':'192.0.2.20'}})).status,429,'a forwarded header cannot evade the trusted client bucket');
  assert.equal((await call('/auth/magic-link',{ip:'192.0.2.20',body:{email:'owner@example.test'}})).status,202,'a different trusted client has an independent bucket');assert.equal(messages.length,1);
  const text=messages[0].content.find(content=>content.type==='text/plain').value,url=new URL(text.match(/https:\/\/\S+/)[0]);
  const preview=await handler(new Request(url,{headers:{Host:url.host}}));assert.equal(preview.status,200);assert.equal(preview.headers.has('set-cookie'),false);assert.equal((await handler(new Request(url,{method:'HEAD',headers:{Host:url.host}}))).headers.has('set-cookie'),false);
  const native=()=>handler(new Request(env.AUTH_ORIGIN+'/auth/confirm',{method:'POST',headers:{Host:new URL(env.AUTH_ORIGIN).host,Origin:env.AUTH_ORIGIN,'CF-Connecting-IP':'192.0.2.20','Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token:url.searchParams.get('token')})}));
  const confirmed=await native();assert.equal(confirmed.status,303);assert.equal((await native()).status,400);const cookie=confirmed.headers.get('set-cookie').split(';')[0];assert.equal((await call('/auth/session',{method:'GET',headers:{Cookie:cookie}})).status,200);
  assert.equal(db.sqlite.prepare('SELECT count(*) AS n FROM rer_mail_development_outbox').get().n,0,'production never writes the development inbox');
  const local={...env,AUTH_LOCAL:'true',AUTH_ORIGIN:'http://127.0.0.1:15820',MAIL_PROVIDER:'development'};assert.equal(developmentMail(local),true);assert.doesNotThrow(()=>createConfiguredAuth(local,brand));assert.throws(()=>createConfiguredAuth({...local,AUTH_ORIGIN:env.AUTH_ORIGIN},brand));
 }finally{globalThis.fetch=fetchBefore;db.close()}
});
