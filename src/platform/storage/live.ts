import {drainDigests} from '../../digests/runner'
import {drainReminders} from '../../reminders/runner'
import {drainSchedules} from '../../scheduled/runner'
import {drainSavedReminders} from '../../team/saved-reminders.server'
import {drainPush} from '../../push/run'
import {continueErasures} from '../../team/erasure/continuation'
import {drainBlobs} from '../../team/erasure/blobs'
import {allowedGrant} from '../../team/access'
import {DurableObject} from 'cloudflare:workers'
import {authFence,authority,type StorageBindings,Context} from './context'
import {recoverDeletes} from './files'
import {drainNotifications} from '../../notify/run'
import {mailSend} from '../../notify/sender'
import {attentionSignature} from './workspace-signature'
type Subscriber={id:string;uid:string;version:number;key:string}
const ATTENTION='@attention'
// A peer that already disconnected cannot be closed again; that is not an error.
function closeSocket(socket:WebSocket,code:number,reason:string){try{socket.close(code,reason)}catch{}}
// A close frame can wait on an intermediary's close handshake (about 30 s under
// rer dev). Ask the tab to refresh in-band first: its authoritative reads clear
// whatever access no longer allows, and the close follows.
function revokeSocket(socket:WebSocket,code:number,reason:string){try{socket.send(JSON.stringify({type:'refresh'}))}catch{}closeSocket(socket,code,reason)}
export class ChatHub extends DurableObject<StorageBindings>{
 async fetch(request:Request){
  // A post-commit hint never waits for delivery: it starts or extends the one
  // running broadcast and returns. The alarm and authoritative replay repair any miss.
  if(new URL(request.url).pathname==='/reminders'){await this.soon(0);return new Response(null,{status:204})}
  if(new URL(request.url).pathname==='/hint'){this.ctx.waitUntil(this.broadcast());await this.soon(5000);return new Response(null,{status:204})}
  const info=JSON.parse(request.headers.get('x-nook-subscriber')??'null') as Subscriber;if(!info||request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return new Response('WebSocket required',{status:400});if(!await this.active(info))return new Response('Sign in required',{status:401});info.key=crypto.randomUUID();
  const pair=new WebSocketPair(),client=pair[0],server=pair[1];this.ctx.acceptWebSocket(server);server.serializeAttachment(info);await this.deliver(server,true);await this.soon(5000);return new Response(null,{status:101,webSocket:client})
 }
 async active(info:Subscriber){return !!await this.env.DB.prepare(`SELECT 1 WHERE ${authority} AND ${authFence}`).bind(info.id,info.uid,info.version).first()}
 async deliver(socket:WebSocket,initial=false){
  const info=socket.deserializeAttachment() as Subscriber;
  try{if(!await this.active(info)){revokeSocket(socket,4001,'Access changed');return}const result=await this.env.DB.prepare(`SELECT c.id,c.seq FROM nook_members m JOIN nook_conversations c ON c.id=m.conversation WHERE m.user=? AND ${allowedGrant('m.user','m.conversation')} AND ${authFence} ORDER BY c.id`).bind(info.uid,info.id,info.uid,info.version).all<{id:string;seq:number}>();const current:Record<string,number|string>=Object.fromEntries(result.results.map(c=>[c.id,c.seq])),previous=await this.ctx.storage.get<Record<string,number|string>>(info.key)??{};
   // Triage (snooze, done, quiet time) moves no conversation frontier; a changed
   // signature tells this person's open tabs to refresh their own Attention.
   const triage=await this.env.DB.prepare(attentionSignature).bind(info.uid,info.uid).first<{v:string}>();current[ATTENTION]=triage?.v??'';
   if(Object.keys(previous).some(id=>!Object.hasOwn(current,id))){revokeSocket(socket,4003,'Access changed');return}
   if(initial)socket.send(JSON.stringify({type:'ready',conversations:result.results,signature:current[ATTENTION]}));else{for(const row of result.results)if(previous[row.id]!==row.seq)socket.send(JSON.stringify({conversation:row.id,frontier:row.seq}));if(previous[ATTENTION]!==undefined&&previous[ATTENTION]!==current[ATTENTION])socket.send(JSON.stringify({type:'refresh'}))}await this.ctx.storage.put(info.key,current)
  }catch{closeSocket(socket,1011,'Reconnect required')}
 }
 private running:Promise<void>|null=null;private again=false
 // At most one broadcast runs; hints arriving meanwhile coalesce into one more pass.
 broadcast():Promise<void>{
  if(this.running){this.again=true;return this.running}
  this.running=(async()=>{try{do{this.again=false;await Promise.all(this.ctx.getWebSockets().map(socket=>this.deliver(socket)))}while(this.again)}finally{this.running=null}})()
  return this.running
 }
 // Bring the one alarm forward, never later: steady hints must not keep postponing
 // a due notification send or retry.
 async soon(delay:number){const at=Date.now()+delay,current=await this.ctx.storage.getAlarm();if(current===null||current>at)await this.ctx.storage.setAlarm(at)}
 async alarm(){
  // Durable periodic frontier comparison repairs a lost final hint while clients
  // remain connected. D1 replay, never the hint, decides which events are missing.
  let personalNext:number|null=null;try{personalNext=await drainReminders(this.env)}catch{console.error('Reminder scheduling failed');personalNext=Date.now()+60_000}
  let scheduleNext:number|null=null;try{scheduleNext=await drainSchedules(this.env)}catch{console.error('Scheduled message pass failed');scheduleNext=Date.now()+60_000}
  let reminderNext:number|null=null;try{reminderNext=await drainSavedReminders(this.env)}catch{console.error('Saved reminder scheduling failed');reminderNext=Date.now()+60_000}
  let digestNext:number|null=null;try{digestNext=await drainDigests(this.env)}catch{console.error('Digest scheduling failed');digestNext=Date.now()+60000}
  await this.broadcast();await recoverDeletes(this.env);await drainBlobs(this.env);await continueErasures(this.env);
  // C14 email: an away member has no socket, so pending queue rows keep the alarm
  // armed until they are sent, cancelled or given up. The queue lives in D1, so a
  // restarted Worker resumes it.
  let next:number|null=null;try{next=await drainNotifications(this.env,mailSend(this.env))}catch(error){console.error('Notification delivery pass failed',error instanceof Error?error.message:'');next=Date.now()+60_000}
  let pushNext:number|null=null;try{pushNext=await drainPush(this.env)}catch{console.error('Push delivery pass failed');pushNext=Date.now()+60_000}
  const live=this.ctx.getWebSockets().length||(await this.env.DB.prepare('SELECT object_key FROM nook_object_deletes UNION ALL SELECT operation FROM nook_erasure_work LIMIT 1').first())?Date.now()+5000:null
  const at=[live,next,pushNext,reminderNext,scheduleNext,personalNext,digestNext].filter((value):value is number=>value!==null);if(at.length)await this.soon(Math.max(Math.min(...at)-Date.now(),1000))
 }
 async webSocketMessage(socket:WebSocket){await this.deliver(socket,true)}
 // The configured compatibility date lets the runtime complete the close handshake.
 async webSocketClose(socket:WebSocket){const info=socket.deserializeAttachment() as Subscriber;await this.ctx.storage.delete(info.key)}
 async webSocketError(socket:WebSocket){const info=socket.deserializeAttachment() as Subscriber;await this.ctx.storage.delete(info.key);closeSocket(socket,1011,'Reconnect required')}
}
export async function connect(c:Context,request:Request){const headers=new Headers(request.headers);headers.set('x-nook-subscriber',JSON.stringify({id:c.session.id,uid:c.uid,version:c.session.operator.version}));return c.env.CHAT_HUB.get(c.env.CHAT_HUB.idFromName('workspace')).fetch(new Request('https://hub/connect',{headers}))}
