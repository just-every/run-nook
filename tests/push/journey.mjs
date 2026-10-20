import {broadcasts} from './broadcast.mjs';
import assert from 'node:assert/strict';
import {installation,until} from './fixture.mjs';
import {subscriber,packet} from './packet.mjs';
import {routing} from './routing.mjs';
import {presence} from './presence.mjs';
import {failures} from './failures.mjs';
import {erasure} from './erasure.mjs';
import {setupFailure} from './setup-failure.mjs';
import {archive} from './archive.mjs';

export async function contractJourney(t){
 const recipients=new Map(),received=[];let publicKey,edgeError;
 const app=await installation(async request=>{
  try{
   const target=recipients.get(request.url);assert.ok(target,'only registered synthetic vendors receive packets');
   const value=await packet(request,target,publicKey),entry={value,endpoint:request.url,at:Date.now()};received.push(entry);
   // Miniflare turns a thrown edge callback into HTTP 500. Withhold the
   // reply after acceptance instead, so the real fetch timeout is uncertain.
   if(target.behavior==='uncertain')await new Promise(resolve=>setTimeout(resolve,21_000));
   return new Response(null,{status:target.behavior==='rate-limited'&&received.filter(r=>r.endpoint===request.url).length===1?429:target.behavior==='server-failure'&&received.filter(r=>r.endpoint===request.url).length===1?503:target.behavior==='expired'?410:target.behavior==='refused'?400:201});
  }catch(error){edgeError=error;throw error}
 },{workerOptions:{assets:{directory:process.cwd()+'/dist/client',binding:'ASSETS',run_worker_first:true}}});
 try{
  const {call,db,ownerCookie}=app;
  const seed=await call('/api/conversations','POST',{name:'Push contract',kind:'channel'},ownerCookie);
  const member=await app.invite('recipient',seed.id),sender=await app.invite('sender',seed.id),unrelated=await app.invite('unrelated',seed.id);
  publicKey=(await call('/api/devices','GET',undefined,member.cookie)).publicKey;
  const register=async(person,name,behavior,deviceClass='desktop')=>{const sub=subscriber(crypto.randomUUID());sub.behavior=behavior;recipients.set(sub.subscription.endpoint,sub);const device=await call('/api/devices','POST',{transport:'webpush',subscription:sub.subscription,deviceClass,name},person.cookie);return {...device,...sub}};
  const device=await register(member,'contract');
  await call('/api/notify','PATCH',{push:{mentions:true,direct:true,threads:true,urgent:true}},member.cookie);
  const room=(name,kind='private',people=[member.user.id,sender.user.id])=>call('/api/conversations','POST',{name,kind,participants:people},ownerCookie);
  const send=(conversation,extra={},cookie=sender.cookie)=>call(`/api/conversations/${conversation.id}/messages`,'POST',{body:'PRIVATE-BODY-'+crypto.randomUUID(),intent:crypto.randomUUID(),...extra},cookie);
  const rows=message=>db.prepare("SELECT * FROM nook_notify_queue WHERE channel='push' AND message=? ORDER BY device").bind(message.id).all().then(r=>r.results);
  const delivered=async(message,n=1)=>{await until(async()=>{if(edgeError)throw edgeError;const q=await rows(message);return q.length===n&&q.every(r=>['sent','folded'].includes(r.state))},'delivered '+message.id);return received.filter(r=>new URL(r.value.url).searchParams.get('focus')===message.id)};
  const read=async(conversation,person=member)=>{const rooms=await call('/api/conversations','GET',undefined,person.cookie);await call(`/api/conversations/${conversation.id}/read`,'POST',{seq:rooms.find(r=>r.id===conversation.id).seq},person.cookie)};
  const sync=()=>call('/api/devices/sync','GET',undefined,member.cookie);
  const context={...app,t,member,sender,unrelated,device,register,recipients,received,room,send,rows,delivered,read,sync};
  await routing(context);
  await broadcasts(context);
  await presence(context);
  await failures(context);
  await setupFailure(context);
  await erasure(context);
  await archive(context);
  if(edgeError)throw edgeError;
  assert.equal((await db.prepare("SELECT count(*) AS n FROM nook_notify_queue WHERE channel='email'").first()).n,0,'push choices never opt into email');
 }finally{await app.close()}
}
