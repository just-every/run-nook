import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {teamFixture} from './team-sql-support.mjs';
// C14 delivery state machine and deduplication over the real storage commands
// and migrations, with a fake sender at the mail edge and an explicit clock.
const require=createRequire(import.meta.url),{build}=createRequire(require.resolve('wrangler'))('esbuild');
const dir=await mkdtemp(join(tmpdir(),'nook-notify-'));after(()=>rm(dir,{recursive:true,force:true}));
const outfile=join(dir,'notify.mjs');
await build({stdin:{contents:"export {Context} from './src/platform/storage/context';export {send} from './src/platform/storage/messages';export {write} from './src/platform/storage/commands';export {drainNotifications} from './src/notify/run';export {updateNotifySettings,notifySettings} from './src/notify/preferences';export {RETRY_MS,FOLD_MS,GATHER_MS} from './src/notify/queue'",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile,logLevel:'silent'});
const {Context,send,write,drainNotifications,updateNotifySettings,notifySettings,RETRY_MS,FOLD_MS,GATHER_MS}=await import(outfile);

async function fixture(){
 const f=await teamFixture();
 const env={DB:f.adapter,FILES:{},CHAT_HUB:{idFromName:()=>'',get:()=>({fetch:async()=>new Response()})},AUTH_ORIGIN:'http://127.0.0.1:15820'};
 const person=async name=>{const accepted=await f.accept(await f.invite(name+'@example.test'));return f.auth.getSession(f.request('/auth/session',null,accepted.headers.get('set-cookie').split(';')[0]))};
 const sam=new Context(env,f.owner),rowan=new Context(env,await person('rowan'));
 const sent=[];let outcome=()=>({ok:true});
 const fake=async mail=>{sent.push(mail);return outcome(mail)};
 const drain=at=>drainNotifications(env,fake,at);
 const rows=()=>f.db.prepare('SELECT state,attempts,error,due,reason FROM nook_notify_queue ORDER BY created,id').all().map(r=>({...r}));
 const mention=(intent,extra={})=>send(sam,'launch',{body:'CANARY-BODY '+intent,intent,mentions:[rowan.uid],...extra});
 return {f,env,sam,rowan,sent,drain,rows,mention,fail:value=>{outcome=value}};
}

test('nothing is queued until a member turns email on; an identical event is emailed once and a burst folds into one email',async()=>{
 const t=await fixture();try{
  await t.mention('before-opt-in');assert.equal(t.rows().length,0,'email notifications start off');
  await updateNotifySettings(t.rowan,{mentions:true});
  const first=await t.mention('one'),start=Date.parse(first.created);
  assert.equal((await t.mention('one')).id,first.id,'an identical retry returns the same message');
  await t.mention('two');
  assert.deepEqual(t.rows().map(r=>r.state),['pending','pending'],'one row per event, none for the retry');
  assert.equal(await t.drain(start),start+GATHER_MS,'a new item waits briefly to fold a burst');assert.equal(t.sent.length,0);
  await t.drain(start+GATHER_MS);
  assert.equal(t.sent.length,1,'two mentions inside the window give one email');
  assert.match(t.sent[0].subject,/mentioned you in #Launch \(\+1 more\)/);
  assert.equal(t.sent[0].to,'rowan@example.test');
  assert.doesNotMatch(t.sent[0].subject+t.sent[0].text,/CANARY-BODY/,'no message text in email');
  assert.deepEqual(t.rows().map(r=>r.state),['sent','folded']);
  // Later items within ten minutes of that email wait for the window, then fold into one.
  const sentAt=start+GATHER_MS;await t.mention('three');await t.mention('four');
  assert.equal(await t.drain(sentAt+GATHER_MS+1),sentAt+FOLD_MS);assert.equal(t.sent.length,1);
  await t.drain(sentAt+FOLD_MS);
  assert.equal(t.sent.length,2);assert.match(t.sent[1].subject,/\(\+1 more\)/);
  await t.drain(sentAt+FOLD_MS+60_000);assert.equal(t.sent.length,2,'sent items are never sent again');
 }finally{t.f.close()}
});

test('a refused send retries on the schedule, shows as not delivered, then is given up; an unconfirmed send is never repeated',async()=>{
 const t=await fixture();try{
  await updateNotifySettings(t.rowan,{mentions:true});
  t.fail(()=>({ok:false,error:'refused',retryable:true}));
  const start=Date.parse((await t.mention('refused')).created);let at=start+GATHER_MS;
  for(let attempt=1;attempt<=RETRY_MS.length;attempt++){
   const next=await t.drain(at);assert.deepEqual(t.rows().map(({state,attempts,error})=>({state,attempts,error})),[{state:'retrying',attempts:attempt,error:'refused'}]);
   assert.equal(next,at+RETRY_MS[attempt-1]);at=next;
  }
  const visible=await notifySettings(t.sam);assert.equal(visible.notDelivered[0].recipient,'rowan');assert.equal(visible.notDelivered[0].error,'refused');assert.equal(visible.workspace.notDelivered.count,1,'the owner sees it too');
  assert.equal((await notifySettings(t.rowan)).problem.error,'refused','and the recipient');
  assert.equal(await t.drain(at),null);assert.deepEqual(t.rows().map(r=>r.state),['failed'],'given up after the last attempt');
  assert.equal(t.sent.length,RETRY_MS.length+1);
  // A send that stopped after it may have gone out is not confirmed and never retried.
  t.fail(()=>({ok:true}));await t.mention('lost');t.f.db.prepare("UPDATE nook_notify_queue SET state='sending',due=? WHERE state='pending'").run(at);
  const before=t.sent.length;await t.drain(at+1);
  assert.deepEqual(t.rows().map(r=>({state:r.state,error:r.error})),[{state:'failed',error:'refused'},{state:'failed',error:'uncertain'}]);assert.equal(t.sent.length,before);
 }finally{t.f.close()}
});

test('quiet time holds routine items until it ends; urgent goes through only when chosen; turning email off cancels what is queued',async()=>{
 const t=await fixture();try{
  await updateNotifySettings(t.rowan,{mentions:true,urgent:true});
  const quietUntil=Date.now()+3600_000;await write(t.rowan,'settings','',{dndUntil:quietUntil});
  const urgent={urgent:true,urgentReason:'Need the numbers'};
  await t.mention('quiet-mention');await t.mention('quiet-urgent',urgent);
  const at=Date.now()+GATHER_MS+1;await t.drain(at);
  assert.equal(t.sent.length,0,'nothing is emailed during quiet time without the urgent choice');
  assert.deepEqual(t.rows().map(r=>r.due),[quietUntil,quietUntil]);
  await updateNotifySettings(t.rowan,{urgentQuiet:true});await t.drain(at+1);
  assert.equal(t.sent.length,1);assert.match(t.sent[0].subject,/^Urgent request from /);
  assert.doesNotMatch(t.sent[0].text,/Need the numbers/,'the urgent reason is not copied into email');
  await write(t.rowan,'settings','',{dndUntil:null});
  assert.ok(t.rows().find(r=>r.reason==='mention').due<=Date.now(),'ending quiet time releases the held mention');
  await updateNotifySettings(t.rowan,{mentions:false});await t.drain(at+FOLD_MS);
  assert.deepEqual(t.rows().map(r=>[r.reason,r.state,r.error]),[['mention','cancelled','turned-off'],['urgent-request','sent',null]],'opting out stops the next email');
  assert.equal(t.sent.length,1);
 }finally{t.f.close()}
});

test('a recipient removed from a private channel while their email is prepared is not emailed',async()=>{
 const t=await fixture();try{
  await write(t.sam,'members','review',{user:t.rowan.uid});await updateNotifySettings(t.rowan,{mentions:true});
  const start=Date.parse((await send(t.sam,'review',{body:'Private review plan',intent:'private-mention',mentions:[t.rowan.uid]})).created);
  // The channel manager removes the recipient just after the delivery run claims the email.
  const batch=t.f.adapter.batch;
  t.f.adapter.batch=async statements=>{const results=await batch(statements);if(statements.some(s=>s.sql.includes("SET state='sending'"))){t.f.adapter.batch=batch;await write(t.sam,'members','review',{user:t.rowan.uid,remove:true})}return results};
  await t.drain(start+GATHER_MS);
  assert.equal(t.f.db.prepare("SELECT count(*) AS n FROM nook_members WHERE conversation='review' AND user=?").get(t.rowan.uid).n,0);
  assert.deepEqual(t.sent,[],'no email reaches the provider after access ends');
  assert.deepEqual(t.rows().map(r=>[r.state,r.error]),[['cancelled','no-access']]);
 }finally{t.f.close()}
});
