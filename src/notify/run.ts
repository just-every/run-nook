import {activeDesktopUntil} from '../push/activity';
import {syncQuiet} from './quiet'
import {broadcastSuppressed,emailBroadcastChoice} from '../broadcast/policy'
import {conversationLevel} from '../team/conversation-notify.server'
import {recipientCancellation,attentionCancellation} from './policy'
// @ts-ignore Product configuration uses the portable Base JavaScript API.
import {authBindings} from '../platform/operator-auth-runtime.mjs'
import branding from '../branding.json'
import {composeEmail} from './compose'
import {afterFailure,foldedUntil,GATHER_MS,KEEP_MS,LEASE_MS,type Reason} from './queue'
import type {Send} from './sender'
import {queuedAgentLabel} from '../agent-door/queued-consent'
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
 WHEN q.reason='keyword' AND EXISTS(SELECT 1 FROM nook_preferences p WHERE p.user=q.user AND p.conversation=q.conversation AND p.muted=1) AND COALESCE((SELECT keywords_in_muted FROM nook_notify_preferences WHERE user=q.user),0)=0 THEN 'muted'
 WHEN q.reason<>'broadcast' AND NOT EXISTS(SELECT 1 FROM nook_notify_preferences p WHERE p.user=q.user AND CASE WHEN q.reason IN ('direct-message') THEN p.away_email WHEN q.reason='urgent-request' THEN p.urgent WHEN q.reason='keyword' THEN p.keywords ELSE p.mentions END=1) THEN 'turned-off' END`
/** One pass of the delivery run loop. Returns when it next needs to run, or null. */
export async function drainNotifications(env:any,send:Send,now=Date.now(),limit=20):Promise<number|null>{
 const db:D1Database=env.DB,sql=(text:string,...values:unknown[])=>db.prepare(text).bind(...values)
 // A send that never recorded its outcome (the Worker stopped mid-send) may have
 // gone out. It is shown as not confirmed and never sent again.
 await db.batch([sql("UPDATE nook_notify_queue SET state='failed',error='uncertain',updated=? WHERE channel='email' AND state='sending' AND due<=?",now,now),sql("DELETE FROM nook_notify_queue WHERE channel='email' AND state IN ('sent','folded','cancelled','failed') AND updated<?",now-KEEP_MS)])
 await syncQuiet(db,now)
 const groups=(await sql("SELECT DISTINCT user,CASE WHEN reason='direct-message' THEN '' ELSE conversation END AS conversation FROM nook_notify_queue WHERE channel='email' AND state IN ('pending','retrying') AND due<=? ORDER BY due LIMIT ?",now,limit).all<{user:string;conversation:string}>()).results
 for(const group of groups){
  const rows=(await sql(`SELECT q.*,(SELECT snooze_until FROM nook_attention WHERE id=q.dedupe AND state='snoozed') AS snooze,${cancelReason} AS cancel FROM nook_notify_queue q WHERE q.channel='email' AND q.user=? AND ${group.conversation?"q.conversation=? AND q.reason<>'direct-message'":"q.reason='direct-message'"} AND q.state IN ('pending','retrying') ORDER BY q.created,q.id`,group.user,...(group.conversation?[group.conversation]:[])).all<Row>()).results
  const cancelled=rows.filter(r=>r.cancel)
  if(cancelled.length)await db.batch(cancelled.map(r=>sql("UPDATE nook_notify_queue SET state='cancelled',error=?,updated=? WHERE id=? AND state IN ('pending','retrying')",r.cancel,now,r.id)))
  const live=rows.filter(r=>!r.cancel);if(!live.length)continue
  const person=await sql('SELECT o.email,s.dnd_until,p.urgent_quiet,p.away_interval FROM oa_operators o LEFT JOIN nook_settings s ON s.user=o.id LEFT JOIN nook_notify_preferences p ON p.user=o.id WHERE o.id=?',group.user).first<{email:string;dnd_until:number|null;urgent_quiet:number|null;away_interval:number|null}>()
  // Quiet time defers routine items; an urgent request goes through only when
  // its recipient also chose to let urgent requests through quiet time.
  const recurring=await sql('SELECT quiet_until FROM nook_quiet_schedules WHERE user=?',group.user).first<{quiet_until:number}>()
  const until=Math.max(person?.dnd_until??0,recurring?.quiet_until??0),quiet=until>now?until:null
  const activity=await sql(`SELECT ${activeDesktopUntil('?').replace("COALESCE(d.device_class,p.device_class)='desktop'",'1')} AS until`,group.user).first<{until:number}>();
  const deliveries=(await sql("SELECT conversation,max(updated) AS at FROM nook_notify_queue WHERE channel='email' AND user=? AND state IN ('sent','folded') GROUP BY conversation",group.user).all<{conversation:string;at:number}>()).results
  const lastByConversation=new Map(deliveries.map(row=>[row.conversation,row.at]))
  const lastAway=group.conversation?null:await sql("SELECT max(updated) AS at FROM nook_notify_queue WHERE channel='email' AND user=? AND reason='direct-message' AND state IN ('sent','folded')",group.user).first<{at:number|null}>()
  const awayUntil=lastAway?.at==null?0:lastAway.at+(person?.away_interval??15)*60000
  const heldUntil=(row:Row)=>Math.max(['direct-message'].includes(row.reason)?Math.max(row.due,row.created+GATHER_MS+(person?.away_interval??15)*60000,(activity?.until??0)>now?(activity?.until??0)+60000:0):0,row.snooze??0,row.reason==='urgent-request'&&person?.urgent_quiet===1?0:quiet??0,foldedUntil(lastByConversation.get(row.conversation)??null,now)??0,awayUntil)
  const ready=live.filter(row=>heldUntil(row)<=now),waiting=live.filter(row=>heldUntil(row)>now)
  if(waiting.length)await db.batch(waiting.map(row=>sql('UPDATE nook_notify_queue SET due=?,updated=? WHERE id=?',heldUntil(row),now,row.id)))
  if(!ready.length||!ready.some(r=>r.due<=now))continue
  const lead=ready[0],token=hex(crypto.getRandomValues(new Uint8Array(32)).buffer),hash=await tokenHash(token)
  await db.batch(ready.map(r=>sql("UPDATE nook_notify_queue SET state='sending',attempts=attempts+1,due=?,email=?,token_hash=?,updated=? WHERE id=?",now+LEASE_MS,lead.id,hash,now,r.id)))
  const context=await sql(`SELECT c.name,c.kind,COALESCE((SELECT ${queuedAgentLabel} FROM nook_notify_queue q WHERE q.id=?),(SELECT display_name FROM oa_operators WHERE id=?)) AS actor FROM nook_conversations c WHERE c.id=?`,lead.id,lead.actor,lead.conversation).first<{name:string;kind:string;actor:string|null}>()
  const email=composeEmail({workspace:branding.name,origin:authBindings(env).AUTH_ORIGIN,actor:context?.actor??'Someone',conversation:{id:lead.conversation,name:context?.name??'',kind:context?.kind??'channel'},reason:lead.reason,message:lead.message,count:ready.length,conversationCount:new Set(ready.map(row=>row.conversation)).size,token})
  // Final admission follows composition and precedes the only outbound call.
  const final=(await sql(`SELECT q.id,${cancelReason} AS cancel FROM nook_notify_queue q WHERE q.id IN (SELECT value FROM json_each(?)) AND q.state='sending'`,JSON.stringify(ready.map(row=>row.id))).all<{id:string;cancel:string|null}>()).results
  if(final.length!==ready.length||final.some(row=>row.cancel)){
   await db.batch(ready.map(row=>{const refused=final.find(item=>item.id===row.id)?.cancel;return sql("UPDATE nook_notify_queue SET state=?,error=?,attempts=attempts-1,email=NULL,updated=? WHERE id=? AND state='sending'",refused?'cancelled':'pending',refused??null,now,row.id)}));continue
  }
  const result=await send({deliveryId:lead.id,to:person!.email,...email})
  if(result.ok){await db.batch([sql("UPDATE nook_notify_queue SET state='sent',error=NULL,updated=? WHERE id=?",now,lead.id),...ready.slice(1).map(r=>sql("UPDATE nook_notify_queue SET state='folded',error=NULL,updated=? WHERE id=?",now,r.id))]);continue}
  await db.batch(ready.map(r=>{const next=afterFailure(r.attempts+1,result.retryable,now);return sql('UPDATE nook_notify_queue SET state=?,due=?,error=?,email=NULL,updated=? WHERE id=?',next.state,next.due,result.error,now,r.id)}))
 }
 const next=await sql("SELECT min(due) AS due FROM nook_notify_queue WHERE channel='email' AND state IN ('pending','retrying','sending')").first<{due:number|null}>()
 return next?.due??null
}
