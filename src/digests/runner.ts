import {DigestContext,type DigestSchedule} from './context'
import type {StorageBindings} from '../platform/storage/context'
import {allowedGrant} from '../team/access'
import {syncQuiet} from '../notify/quiet'
import {mailSend,type Send} from '../notify/sender'
import {occurrenceAt,nextOccurrence} from '../scheduled/time.mjs'
import {requestRecap,showRecap} from '../recaps/server'
import {verify,sign,type Receipt} from '../recaps/receipt'
import type {Range} from '../recaps/range'
export async function drainDigests(env:StorageBindings,now=Date.now(),send:Send=mailSend(env)){
 const schedules=(await env.DB.prepare('SELECT * FROM nook_digest_schedules WHERE enabled=1 AND next_due<=? ORDER BY next_due,user LIMIT 10').bind(now).all<DigestSchedule>()).results
 for(const s of schedules){
  const c=new DigestContext(env,s),old=await env.DB.prepare('SELECT * FROM nook_digest_deliveries WHERE user=? AND version=? AND local_at=?').bind(s.user,s.version,s.local_at).first<any>()
  const advance=()=>{let local=nextOccurrence(s.local_at,s.cadence,null);while(local&&occurrenceAt(local,s.zone)<=now)local=nextOccurrence(local,s.cadence,null);return c.sql('UPDATE nook_digest_schedules SET local_at=?,next_due=?,updated=? WHERE user=? AND version=?',local??s.local_at,local?occurrenceAt(local,s.zone):now+86400000,now,s.user,s.version)}
  if(old&&old.state!=='deferred'){
   if(old.state==='delivering'&&now-old.updated<60000)continue
   await env.DB.batch([...(old.state==='delivering'?[c.sql("UPDATE nook_digest_deliveries SET state='failed',reason='A delivery was interrupted and is unconfirmed; it will not be repeated',updated=? WHERE id=? AND state='delivering'",now,old.id)]:[]),advance()]);continue
  }
  const id=old?.id??crypto.randomUUID(),key=crypto.randomUUID(),fence="EXISTS(SELECT 1 FROM nook_digest_schedules WHERE user=? AND version=? AND enabled=1 AND next_due=?)",fenceValues=[s.user,s.version,s.next_due]
  try{
   await c.check();await syncQuiet(c.db,now,s.user)
   const quiet=await c.one<{until:number}>('SELECT max(COALESCE((SELECT dnd_until FROM nook_settings WHERE user=?),0),COALESCE((SELECT quiet_until FROM nook_quiet_schedules WHERE user=?),0)) AS until',[s.user,s.user])
   if((quiet?.until??0)>now){await c.batch([c.sql("INSERT INTO nook_digest_deliveries VALUES(?,?,?,?,?,'deferred',?,NULL,?,?) ON CONFLICT(user,version,local_at) DO UPDATE SET state='deferred',reason=excluded.reason,updated=excluded.updated",id,s.user,s.version,s.local_at,s.next_due,'Quiet time until '+new Date(quiet!.until).toISOString(),now,now),c.sql('UPDATE nook_digest_schedules SET next_due=?,updated=? WHERE user=? AND version=?',quiet!.until,now,s.user,s.version)],undefined,fence,fenceValues);continue}
   await c.batch([c.sql("INSERT INTO nook_digest_deliveries VALUES(?,?,?,?,?,'delivering',NULL,NULL,?,?) ON CONFLICT(user,version,local_at) DO UPDATE SET state='delivering',reason=NULL,updated=excluded.updated",id,s.user,s.version,s.local_at,s.next_due,now,now)],undefined,`${fence} AND NOT EXISTS(SELECT 1 FROM nook_digest_deliveries WHERE user=? AND version=? AND local_at=? AND state<>'deferred')`,[...fenceValues,s.user,s.version,s.local_at])
  }catch{continue}
  let state='empty',reason:string|null='Nothing currently readable is unread',receipt:Receipt|null=null
  try{
   const rows=await c.rows<{conversation:string;unreadAfter:number}>(`SELECT m.conversation,COALESCE(r.seq,0) AS unreadAfter FROM nook_members m LEFT JOIN nook_reads r ON r.user=m.user AND r.conversation=m.conversation WHERE m.user=? AND ${allowedGrant('m.user','m.conversation')} AND NOT EXISTS(SELECT 1 FROM nook_notification_sharing share WHERE share.conversation=m.conversation AND share.state<>'local') AND EXISTS(SELECT 1 FROM nook_messages source WHERE source.conversation=m.conversation AND source.deleted=0 AND source.sequence>COALESCE(r.seq,0) AND source.author<>m.user) ORDER BY m.conversation LIMIT 100`,[s.user])
   const ranges:Range[]=rows.map(r=>({conversation:r.conversation,thread:null,from:'1970-01-01T00:00:00.000Z',through:new Date(now).toISOString(),unreadAfter:r.unreadAfter}))
   if(ranges.length){
    const answer=await requestRecap(c,{}, {...ranges[0],collection:ranges},now)
    if(answer.state==='answered'&&'receipt' in answer){receipt={...await verify(c,answer.receipt),delivery:id};state='delivered';reason=null}
    else if(answer.state==='capped'){state='skipped';reason='The installation daily AI cap is spent; this digest is skipped, not queued'}
    else if(answer.state==='off'){state='skipped';reason='The owner AI door is disabled or needs a key'}
    else {state='failed';reason=answer.state==='unavailable'?'The provider failed or its answer was rejected':'No verified points were returned; nothing was sent'}
   }
   if(receipt&&s.delivery==='email'){
    const shown=await showRecap(c,receipt,await sign(c,receipt)),member=await c.one<{email:string}>('SELECT o.email FROM oa_operators o JOIN nook_notify_preferences p ON p.user=o.id WHERE o.id=? AND o.status=\'active\' AND p.mentions=1',[s.user])
    if(shown.state!=='answered'){receipt=null;state='empty';reason='No current authorized sources remain'}
    else if(!member){receipt=null;state='skipped';reason='Your email notifications are off; no digest email was sent'}
    else {const sent=await send({deliveryId:'digest:'+id,to:member.email,subject:'Your unread Nook digest',text:'Open your cited unread digest in Nook:\n'+env.AUTH_ORIGIN+'/app?view=you#digest-'+id});if(!sent.ok){receipt=null;state='failed';reason='Digest email was not confirmed: '+sent.error}}
   }
  }catch{receipt=null;state='failed';reason='Your access or sources changed, or the digest provider failed; nothing was sent'}
  // Cancel/opt-out fences the next claim. An occurrence already delivering may
  // finish; only the unchanged schedule advances. Stored receipts contain no text.
  try{await c.batch([c.sql('UPDATE nook_digest_deliveries SET state=?,reason=?,receipt=?,updated=? WHERE id=? AND state=\'delivering\'',state,reason,receipt?JSON.stringify(receipt):null,now,id),advance()],undefined,"EXISTS(SELECT 1 FROM nook_digest_deliveries WHERE id=? AND state='delivering')",[id])}catch{/* Erasure or authority withdrawal has removed the pending record. */}
 }
 return (await env.DB.prepare('SELECT min(next_due) AS due FROM nook_digest_schedules WHERE enabled=1').first<{due:number|null}>())?.due??null
}
