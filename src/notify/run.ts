import {syncQuiet} from './quiet'
import {broadcastSuppressed,emailBroadcastChoice} from '../broadcast/policy'
import {conversationLevel} from '../team/conversation-notify.server'
import {recipientCancellation,attentionCancellation} from './policy'
// @ts-ignore Product configuration uses the portable Base JavaScript API.
import {authBindings} from '../platform/operator-auth-runtime.mjs'
import branding from '../branding.json'
import {composeEmail} from './compose'
import {afterFailure,foldedUntil,KEEP_MS,LEASE_MS,type Reason} from './queue'
import type {Send} from './sender'
type Row={id:string;user:string;conversation:string;actor:string|null;message:string|null;reason:Reason;state:string;attempts:number;due:number;created:number;cancel:string|null;snooze:number|null}
const hex=(bytes:ArrayBuffer)=>[...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('')
export const tokenHash=async(token:string)=>hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))
// Everything that decides whether an item may still be emailed is checked here,
// when the email is built, not only when the event was recorded.
const cancelReason=`CASE ${recipientCancellation}
 WHEN ${conversationLevel('q.user','q.conversation')}='nothing' THEN 'conversation-silent'
 ${attentionCancellation('q.dedupe','(SELECT event_seq FROM nook_attention WHERE id=q.dedupe)')}
 WHEN q.reason='broadcast' AND ${broadcastSuppressed('q.user','q.conversation')} THEN 'broadcast-suppressed'
 WHEN q.reason='broadcast' AND ${emailBroadcastChoice('q.user')}<>1 THEN 'turned-off'
 WHEN q.reason<>'broadcast' AND NOT EXISTS(SELECT 1 FROM nook_notify_preferences p WHERE p.user=q.user AND CASE WHEN q.reason='urgent-request' THEN p.urgent ELSE p.mentions END=1) THEN 'turned-off' END`
/** One pass of the delivery run loop. Returns when it next needs to run, or null. */
export async function drainNotifications(env:any,send:Send,now=Date.now(),limit=20):Promise<number|null>{
 const db:D1Database=env.DB,sql=(text:string,...values:unknown[])=>db.prepare(text).bind(...values)
 // A send that never recorded its outcome (the Worker stopped mid-send) may have
 // gone out. It is shown as not confirmed and never sent again.
 await db.batch([sql("UPDATE nook_notify_queue SET state='failed',error='uncertain',updated=? WHERE channel='email' AND state='sending' AND due<=?",now,now),sql("DELETE FROM nook_notify_queue WHERE channel='email' AND state IN ('sent','folded','cancelled','failed') AND updated<?",now-KEEP_MS)])
 await syncQuiet(db,now)
 const groups=(await sql("SELECT DISTINCT user,conversation FROM nook_notify_queue WHERE channel='email' AND state IN ('pending','retrying') AND due<=? ORDER BY due LIMIT ?",now,limit).all<{user:string;conversation:string}>()).results
 for(const group of groups){
  const rows=(await sql(`SELECT q.*,(SELECT snooze_until FROM nook_attention WHERE id=q.dedupe AND state='snoozed') AS snooze,${cancelReason} AS cancel FROM nook_notify_queue q WHERE q.channel='email' AND q.user=? AND q.conversation=? AND q.state IN ('pending','retrying') ORDER BY q.created,q.id`,group.user,group.conversation).all<Row>()).results
  const cancelled=rows.filter(r=>r.cancel)
  if(cancelled.length)await db.batch(cancelled.map(r=>sql("UPDATE nook_notify_queue SET state='cancelled',error=?,updated=? WHERE id=? AND state IN ('pending','retrying')",r.cancel,now,r.id)))
  const live=rows.filter(r=>!r.cancel);if(!live.length)continue
  const person=await sql('SELECT o.email,s.dnd_until,p.urgent_quiet FROM oa_operators o LEFT JOIN nook_settings s ON s.user=o.id LEFT JOIN nook_notify_preferences p ON p.user=o.id WHERE o.id=?',group.user).first<{email:string;dnd_until:number|null;urgent_quiet:number|null}>()
  // Quiet time defers routine items; an urgent request goes through only when
  // its recipient also chose to let urgent requests through quiet time.
  const recurring=await sql('SELECT quiet_until FROM nook_quiet_schedules WHERE user=?',group.user).first<{quiet_until:number}>()
  const until=Math.max(person?.dnd_until??0,recurring?.quiet_until??0),quiet=until>now?until:null
  const heldUntil=(row:Row)=>Math.max(row.snooze??0,row.reason==='urgent-request'&&person?.urgent_quiet===1?0:quiet??0)
  const ready=live.filter(row=>heldUntil(row)<=now),waiting=live.filter(row=>heldUntil(row)>now)
  if(waiting.length)await db.batch(waiting.map(row=>sql('UPDATE nook_notify_queue SET due=?,updated=? WHERE id=?',heldUntil(row),now,row.id)))
  if(!ready.length||!ready.some(r=>r.due<=now))continue
  const last=await sql("SELECT max(updated) AS at FROM nook_notify_queue WHERE channel='email' AND user=? AND conversation=? AND state='sent'",group.user,group.conversation).first<{at:number|null}>()
  const held=foldedUntil(last?.at??null,now)
  if(held!==null){await db.batch(ready.map(r=>sql('UPDATE nook_notify_queue SET due=?,updated=? WHERE id=?',held,now,r.id)));continue}
  const lead=ready[0],token=hex(crypto.getRandomValues(new Uint8Array(32)).buffer),hash=await tokenHash(token)
  await db.batch(ready.map(r=>sql("UPDATE nook_notify_queue SET state='sending',attempts=attempts+1,due=?,email=?,token_hash=?,updated=? WHERE id=? AND state IN ('pending','retrying')",now+LEASE_MS,lead.id,hash,now,r.id)))
  const context=await sql('SELECT c.name,c.kind,(SELECT display_name FROM oa_operators WHERE id=?) AS actor FROM nook_conversations c WHERE c.id=?',lead.actor,group.conversation).first<{name:string;kind:string;actor:string|null}>()
  const email=composeEmail({workspace:branding.name,origin:authBindings(env).AUTH_ORIGIN,actor:context?.actor??'Someone',conversation:{id:group.conversation,name:context?.name??'',kind:context?.kind??'channel'},reason:lead.reason,message:lead.message,count:ready.length,token})
  // Immediately before the provider, re-read the claim, its cancellation and the
  // address: access, choices or the address may have changed while it was prepared.
  // No request was made, so an invalid claim is cancelled or returned to the queue.
  const valid=await sql(`SELECT count(*) AS n FROM nook_notify_queue q WHERE q.channel='email' AND q.email=? AND q.token_hash=? AND q.state='sending' AND (${cancelReason}) IS NULL AND EXISTS(SELECT 1 FROM oa_operators o WHERE o.id=q.user AND o.email=?)`,lead.id,hash,person!.email).first<{n:number}>()
  if(valid?.n!==ready.length){await sql(`UPDATE nook_notify_queue AS q SET state=CASE WHEN (${cancelReason}) IS NOT NULL THEN 'cancelled' WHEN attempts>1 THEN 'retrying' ELSE 'pending' END,error=COALESCE(${cancelReason},error),attempts=attempts-1,due=?,email=NULL,token_hash=NULL,updated=? WHERE channel='email' AND email=? AND token_hash=? AND state='sending'`,now,now,lead.id,hash).run();continue}
  const result=await send({deliveryId:lead.id,to:person!.email,...email})
  if(result.ok){await db.batch([sql("UPDATE nook_notify_queue SET state='sent',error=NULL,updated=? WHERE id=?",now,lead.id),...ready.slice(1).map(r=>sql("UPDATE nook_notify_queue SET state='folded',error=NULL,updated=? WHERE id=?",now,r.id))]);continue}
  await db.batch(ready.map(r=>{const next=afterFailure(r.attempts+1,result.retryable,now);return sql('UPDATE nook_notify_queue SET state=?,due=?,error=?,email=NULL,updated=? WHERE id=?',next.state,next.due,result.error,now,r.id)}))
 }
 const next=await sql("SELECT min(due) AS due FROM nook_notify_queue WHERE channel='email' AND state IN ('pending','retrying','sending')").first<{due:number|null}>()
 return next?.due??null
}
