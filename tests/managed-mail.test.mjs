import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,readdirSync} from 'node:fs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {sqliteBinding} from './sqlite-binding.mjs';
import {createConfiguredAuth} from '../src/platform/operator-auth-runtime.mjs';
import {createAuthHandler} from '../src/base/modules/operator-auth/index.mjs';

test('Managed sign-in and notification mail use the relay; rate limits queue and retired credentials become visible problems',async()=>{
 const db=sqliteBinding(),before=globalThis.fetch,directory=await mkdtemp(join(tmpdir(),'nook-managed-mail-'));
 try{
  const require=createRequire(import.meta.url),{build}=createRequire(require.resolve('wrangler'))('esbuild'),outfile=join(directory,'notify.mjs');
  await build({stdin:{contents:"export {Context} from './src/platform/storage/context';export {write} from './src/platform/storage/commands';export {prepareInvitation} from './src/team/invitations.server';export {drainNotifications} from './src/notify/run';export {mailSend} from './src/notify/sender';export {updateNotifySettings,notifySettings} from './src/notify/preferences';export {GATHER_MS,RETRY_MS,FOLD_MS} from './src/notify/queue'",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile,logLevel:'silent'});
  const {Context,write,prepareInvitation,drainNotifications,mailSend,updateNotifySettings,notifySettings,GATHER_MS,RETRY_MS,FOLD_MS}=await import(outfile);
  for(const file of readdirSync(new URL('../migrations/',import.meta.url)).filter(name=>name.endsWith('.sql')).sort())db.sqlite.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
  const env={DB:db,AUTH_LOCAL:'false',AUTH_ORIGIN:'https://maple-house.example.test',OWNER_EMAIL:'sam@example.test',SESSION_SECRET:crypto.randomUUID()+crypto.randomUUID(),SETUP_TOKEN:crypto.randomUUID()+crypto.randomUUID(),MAIL_PROVIDER:'rer',MAIL_FROM:'nook@example.test',MAIL_RELAY_URL:'https://rer.example.test/api/managed-mail/send',MAIL_API_KEY:'synthetic-managed-mail-credential',CHAT_HUB:{idFromName:()=>'',get:()=>({fetch:async()=>new Response()})}};
  const messages=[];let status=202;
  // Only the paid/network boundary is replaced. Auth, mail serialization, real
  // migrations, queue transitions and the owner's problem projection run intact.
  globalThis.fetch=async(url,init)=>{
   assert.equal(url,env.MAIL_RELAY_URL);assert.equal(init.method,'POST');assert.equal(init.redirect,'error');
   assert.deepEqual(init.headers,{Authorization:'Bearer '+env.MAIL_API_KEY,'Content-Type':'application/json'});
   const body=JSON.parse(init.body);assert.deepEqual(Object.keys(body).sort(),body.html?['html','subject','text','to']:['subject','text','to']);assert.equal(typeof body.to,'string');assert.ok(body.subject&&body.text);
   messages.push(body);return Response.json(status===202?{accepted:true}:{error:'Mail refused'},{status,...(status===429?{headers:{'Retry-After':'15'}}:{})});
  };
  const auth=createConfiguredAuth(env,{name:'Maple House',primaryColor:'#c24e5b'}),handle=createAuthHandler(auth);
  const request=(path,body,cookie)=>new Request(env.AUTH_ORIGIN+path,{method:body?'POST':'GET',headers:{Host:new URL(env.AUTH_ORIGIN).host,Origin:env.AUTH_ORIGIN,'CF-Connecting-IP':'192.0.2.10',...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const call=(path,body,cookie)=>handle(request(path,body,cookie));
  const boot=await call('/auth/bootstrap',{token:env.SETUP_TOKEN,displayName:'Sam'});assert.equal(boot.status,303);
  const ownerCookie=boot.headers.get('set-cookie').split(';')[0],sam=new Context(env,await auth.getSession(request('/auth/session',null,ownerCookie)));
  assert.equal((await call('/auth/magic-link',{email:env.OWNER_EMAIL})).status,202);
  assert.equal(messages.at(-1).to,env.OWNER_EMAIL);assert.match(messages.at(-1).text,/https:\/\/maple-house\.example\.test\/auth\/confirm\?token=/);
  const conversation=await write(sam,'conversations','',{name:'Kitchen plans',kind:'channel'});
  await prepareInvitation(sam,{email:'rowan@example.test',role:'member',mode:'member',scopes:[conversation.id]});
  const invitation=await call('/auth/invite',{email:'rowan@example.test',displayName:'Rowan',role:'member'},ownerCookie);assert.equal(invitation.status,202);
  const token=new URL(messages.at(-1).text.trim().split('\n').at(-1)).searchParams.get('token'),joined=await call('/auth/confirm',{token});assert.equal(joined.status,303);
  const rowan=new Context(env,await auth.getSession(request('/auth/session',null,joined.headers.get('set-cookie').split(';')[0])));
  await updateNotifySettings(rowan,{mentions:true});
  const mention=()=>write(sam,'messages',conversation.id,{body:'Rowan, can you pick up the groceries?',intent:crypto.randomUUID(),mentions:[rowan.uid]});
  const queue=()=>db.sqlite.prepare("SELECT state,attempts,error,due FROM nook_notify_queue WHERE channel='email' ORDER BY created,id").all().map(row=>({...row}));
  status=429;const at=Date.parse((await mention()).created)+GATHER_MS;
  const due=await drainNotifications(env,mailSend(env),at);assert.equal(due,at+RETRY_MS[0]);assert.deepEqual(queue().map(({state,attempts,error})=>({state,attempts,error})),[{state:'retrying',attempts:1,error:'rate-limited'}]);
  assert.equal((await notifySettings(sam)).workspace.notDelivered.error,'rate-limited');
  const count=messages.length;await drainNotifications(env,mailSend(env),due-1);assert.equal(messages.length,count,'the queued send waits for its retry time');
  status=202;await drainNotifications(env,mailSend(env),due);assert.equal(queue()[0].state,'sent');assert.equal(messages.length,count+1);assert.equal(messages.at(-1).to,'rowan@example.test');
  assert.doesNotMatch(messages.at(-1).text,/pick up the groceries/,'notification mail keeps message content private');
  status=401;await mention();await drainNotifications(env,mailSend(env),due+FOLD_MS);
  assert.equal(queue().at(-1).state,'failed');assert.equal(queue().at(-1).error,'refused');
  const problem=(await notifySettings(sam)).workspace.notDelivered;assert.equal(problem.count,1);assert.equal(problem.error,'refused');
  const unavailable=await call('/auth/magic-link',{email:env.OWNER_EMAIL});assert.equal(unavailable.status,503);assert.equal((await unavailable.json()).error,'mail_unavailable');
  assert.equal(db.sqlite.prepare('SELECT count(*) AS n FROM rer_mail_development_outbox').get().n,0);
 }finally{globalThis.fetch=before;db.close();await rm(directory,{recursive:true,force:true})}
});
