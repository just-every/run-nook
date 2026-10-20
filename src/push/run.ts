import {activeDesktopUntil,mobileRouting,mobileDelay} from './activity'
import {KEEP_MS,LEASE_MS,MAX_ATTEMPTS,RETRY_MS} from '../notify/queue'
import {sendPush} from './sender'
import {PUSH_FOLD_MS,PUSH_GATHER_MS} from './queue'
import {pushCancellation,pushHeldUntil} from './policy'
import {authBindings} from '../platform/operator-auth.server'
import {pushSnapshot} from './snapshot'
export {pushSnapshot} from './snapshot'
type Row={id:string;actor:string;message:string|null;reason:string}
export async function drainPush(bindings:any,now=Date.now(),network:typeof fetch=fetch):Promise<number|null>{
 // Keep the explicit-clock API while advancing it across asynchronous work.
 const started=Date.now(),clock=()=>now+Math.max(0,Date.now()-started)
 const env=authBindings(bindings),db:D1Database=env.DB,sql=(query:string,...args:any[])=>db.prepare(query).bind(...args)
 await db.batch([sql("UPDATE nook_notify_queue SET state='failed',error='uncertain',updated=? WHERE channel='push' AND state='sending' AND due<=?",now,now),sql("DELETE FROM nook_notify_queue WHERE channel='push' AND state IN ('sent','folded','cancelled','failed') AND updated<?",now-KEEP_MS)])
 const groups=(await sql(`SELECT q.user,q.conversation,q.device FROM nook_notify_queue q WHERE q.channel='push' AND q.state IN ('pending','retrying') AND (q.due<=? OR (${pushCancellation}) IS NOT NULL) GROUP BY q.user,q.conversation,q.device ORDER BY min(q.due) LIMIT 20`,now,now,now).all<any>()).results
 for(const group of groups){
  const at=clock()
  // Persist both ends of the activity hold before read/done cancellation. This
  // also makes early hide, sign-out and device removal start the chosen delay.
  await sql(`UPDATE nook_notify_queue AS q SET held_at=CASE WHEN ${activeDesktopUntil('q.user')}>? THEN COALESCE(held_at,?) ELSE held_at END,active_until=CASE WHEN ${activeDesktopUntil('q.user')}>? THEN ${activeDesktopUntil('q.user')} ELSE min(COALESCE(active_until,0),CASE WHEN ${activeDesktopUntil('q.user')}>=COALESCE(q.held_at,0) THEN ${activeDesktopUntil('q.user')} ELSE ? END) END WHERE q.channel='push' AND q.user=? AND q.device=? AND q.state IN ('pending','retrying') AND (${mobileRouting})`,at,at,at,at,group.user,group.device).run()
  await sql(`UPDATE nook_notify_queue AS q SET released_at=? WHERE q.channel='push' AND q.user=? AND q.device=? AND q.state IN ('pending','retrying') AND q.held_at IS NOT NULL AND q.released_at IS NULL AND (NOT(${mobileRouting}) OR COALESCE(q.active_until,0)+${mobileDelay}<=?)`,at,group.user,group.device,at).run()
  const selection=(time:number,states="'pending','retrying'")=>(query:string,...args:any[])=>sql(`WITH candidates AS MATERIALIZED (SELECT q.*,${pushCancellation} AS cancel,${pushHeldUntil} AS held FROM nook_notify_queue q WHERE q.channel='push' AND q.user=? AND q.conversation=? AND q.device=? AND q.state IN (${states})) ${query}`,time,time,time,group.user,group.conversation,group.device,...args)
  const candidates=selection(at),eligible="cancel IS NULL AND held<=? AND (due<=? OR state='pending' AND attempts=0 AND created<=? AND due<=created+?)",eligibility=[at,at,at,PUSH_GATHER_MS]
  // Housekeeping is bounded independently of delivery selection. Held or invalid
  // rows cannot occupy the delivery batch and starve eligible work behind them.
  await candidates("UPDATE nook_notify_queue SET state='cancelled',error=(SELECT cancel FROM candidates WHERE candidates.id=nook_notify_queue.id),updated=? WHERE id IN (SELECT id FROM candidates WHERE cancel IS NOT NULL ORDER BY due,id LIMIT 20)",at).run()
  await candidates('UPDATE nook_notify_queue SET due=max(due,created+?,(SELECT held FROM candidates WHERE candidates.id=nook_notify_queue.id)),updated=? WHERE id IN (SELECT id FROM candidates WHERE cancel IS NULL AND held>? AND due<=? ORDER BY due,id LIMIT 20)',PUSH_GATHER_MS,at,at,at).run()
  if(!await candidates('SELECT 1 FROM candidates WHERE cancel IS NULL AND held<=? AND due<=? LIMIT 1',at,at).first())continue
  const last=await sql("SELECT max(updated) AS at FROM nook_notify_queue WHERE channel='push' AND user=? AND conversation=? AND device=? AND state='sent'",group.user,group.conversation,group.device).first<{at:number|null}>()
  if(last?.at!=null&&last.at+PUSH_FOLD_MS>at){await candidates(`UPDATE nook_notify_queue SET due=max(due,?) WHERE id IN (SELECT id FROM candidates WHERE ${eligible})`,last.at+PUSH_FOLD_MS,...eligibility).run();continue}
  // Claim the complete eligible burst in D1. Only a count and one lead row cross
  // into Worker memory; the encrypted packet carries one opaque delivery ID.
  // Future retries and explicitly deferred rows never join an initial gather.
  const claim=crypto.randomUUID()
  const claimed=await candidates(`UPDATE nook_notify_queue SET state='sending',email=?,attempts=attempts+1,due=?,updated=? WHERE id IN (SELECT id FROM candidates WHERE ${eligible}) AND EXISTS(SELECT 1 FROM candidates WHERE cancel IS NULL AND held<=? AND due<=?)`,claim,at+LEASE_MS,at,...eligibility,at,at).run()
  const count=claimed.meta.changes;if(!count)continue
  const lead=await sql("SELECT id,actor,message,reason FROM nook_notify_queue WHERE channel='push' AND email=? AND state='sending' ORDER BY created,id LIMIT 1",claim).first<Row>();if(!lead)continue
  const device=await sql('SELECT subscription FROM nook_push_devices WHERE id=? AND user=?',group.device,group.user).first<{subscription:string}>()
  const release=async()=>{
   const current=clock(),rows=selection(current,"'sending'")
   // No external request was made: do not spend an attempt or lose valid peers
   // when one row was read, revoked, snoozed or otherwise changed during crypto.
   await rows("UPDATE nook_notify_queue SET state=CASE WHEN (SELECT cancel FROM candidates WHERE candidates.id=nook_notify_queue.id) IS NOT NULL THEN 'cancelled' WHEN attempts>1 THEN 'retrying' ELSE 'pending' END,error=COALESCE((SELECT cancel FROM candidates WHERE candidates.id=nook_notify_queue.id),error),attempts=attempts-1,due=max(created+?, ?,COALESCE((SELECT held FROM candidates WHERE candidates.id=nook_notify_queue.id),0)),email=NULL,updated=? WHERE channel='push' AND email=? AND state='sending'",PUSH_GATHER_MS,current,current,claim).run()
  }
  if(!device){await release();continue}
  const info=await sql('SELECT c.name,c.kind,(SELECT display_name FROM oa_operators WHERE id=?) AS actor FROM nook_conversations c WHERE id=?',lead.actor,group.conversation).first<any>()
  const place=info?.kind==='dm'?'a direct conversation':'#'+(info?.name??''),actor=info?.actor??'Someone'
  const wording:Record<string,string>={'broadcast':`${actor} sent a channel-wide mention in ${place}`,'mention':`${actor} mentioned you in ${place}`,'urgent-request':`Urgent request from ${actor} in ${place}`,'direct-message':`${actor} sent a message in ${place}`,'thread-follow':`${actor} replied in ${place}`,'all-messages':`${actor} sent a message in ${place}`,'commitment-proposal':`${actor} proposed a commitment in ${place}`,'commitment-revision':`${actor} changed a commitment in ${place}`,'commitment-complete':`${actor} reported a commitment complete in ${place}`}
  const open=new URL('/app',env.AUTH_ORIGIN);open.searchParams.set('conversation',group.conversation);if(lead.message)open.searchParams.set('focus',lead.message);else open.searchParams.set('panel','outcomes')
  const snapshot=await pushSnapshot(env,group.user,clock())
  const thread=await sql("SELECT CASE WHEN count(DISTINCT COALESCE(m.parent,m.id))=1 AND count(m.id)=count(*) THEN min(COALESCE(m.parent,m.id)) END AS id FROM nook_notify_queue q LEFT JOIN nook_messages m ON m.id=q.message WHERE q.email=? AND q.state='sending'",claim).first<{id:string|null}>()
  const payload={thread:thread?.id??null,title:'Nook',body:wording[lead.reason]+(count>1?` (+${count-1} more)`:''),url:open.href,tag:'nook:'+group.user+':'+group.conversation,ids:[claim],user:group.user,badge:snapshot.badge}
  const authorize=async()=>{
   const current=clock()
   const valid=await selection(current,"'sending'")('SELECT count(*) AS n,(SELECT s.expires_at FROM nook_push_devices d JOIN oa_sessions s ON s.id=d.session WHERE d.id=?) AS expires FROM candidates WHERE email=? AND cancel IS NULL AND held<=? AND EXISTS(SELECT 1 FROM nook_push_devices WHERE id=? AND user=? AND subscription=?)',group.device,claim,current,group.device,group.user,device.subscription).first<{n:number;expires:number}>()
   return valid?.n===count?valid.expires:null
  }
  const result=await sendPush(env,JSON.parse(device.subscription),payload,clock,network,authorize),finished=clock()
  if(result.ok)await sql("UPDATE nook_notify_queue SET state=CASE WHEN id=? THEN 'sent' ELSE 'folded' END,error=NULL,updated=? WHERE channel='push' AND email=? AND state='sending'",lead.id,finished,claim).run()
  else if(result.cancelled)await release()
  else{
   const retry=result.retryable?1:0,backoff=RETRY_MS.map((delay,i)=>`WHEN ${i+1} THEN ${delay}`).join(' ')
   await sql(`UPDATE nook_notify_queue SET state=CASE WHEN ? AND attempts<? THEN 'retrying' ELSE 'failed' END,due=?+CASE WHEN ? AND attempts<? THEN CASE attempts ${backoff} ELSE 0 END ELSE 0 END,error=?,updated=? WHERE channel='push' AND email=? AND state='sending'`,retry,MAX_ATTEMPTS,finished,retry,MAX_ATTEMPTS,result.error,finished,claim).run()
   if(result.expired)await sql('DELETE FROM nook_push_devices WHERE id=?',group.device).run()
  }
 }
 // Retire stale credentials using the current clock, including subscriptions
 // that expired while an earlier device's external request was in flight.
 const finished=clock()
 await sql(`DELETE FROM nook_push_devices WHERE json_extract(subscription,'$.expirationTime')<=? OR NOT EXISTS(SELECT 1 FROM oa_sessions s JOIN oa_operators o ON o.id=s.operator_id WHERE s.id=nook_push_devices.session AND s.operator_id=nook_push_devices.user AND s.operator_version=nook_push_devices.version AND o.version=s.operator_version AND o.status='active' AND s.revoked_at IS NULL AND s.expires_at>?)`,finished,finished).run()
 const next=await sql("SELECT min(due) AS due FROM nook_notify_queue WHERE channel='push' AND state IN ('pending','retrying','sending')").first<{due:number|null}>();const expiry=await sql("SELECT min(due) AS due FROM (SELECT s.expires_at AS due FROM nook_push_devices d JOIN oa_sessions s ON s.id=d.session UNION ALL SELECT json_extract(subscription,'$.expirationTime') AS due FROM nook_push_devices)").first<{due:number|null}>();const deadlines=[next?.due,expiry?.due].filter((v):v is number=>v!=null);return deadlines.length?Math.min(...deadlines):null
}
