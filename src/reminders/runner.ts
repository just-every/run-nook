import {broadcastKind,broadcastFence} from '../broadcast/audience'
import {literal} from '../broadcast/policy'
import {authority,type StorageBindings,type MessageWriter} from '../platform/storage/context'
import {productAccess,allowedGrant} from '../team/access'
import {channelManagement,channelWritable} from '../team/channel-policy'
import {canPost} from '../team/posting-policy'
import {messageStatements} from '../platform/storage/message-statements'
import {nextOccurrence,occurrenceAt} from '../scheduled/time.mjs'
import {reminderAvailable} from './policy'
export async function drainReminders(env:StorageBindings){
 const now=Date.now(),rows=(await env.DB.prepare("SELECT * FROM nook_reminders WHERE state='pending' AND next_due<=? ORDER BY next_due,id LIMIT 20").bind(now).all<any>()).results
 for(const r of rows){
  const sql=(s:string,...v:any[])=>env.DB.prepare(s).bind(...v),w:MessageWriter={uid:r.user,sql,event:(id,kind,object)=>[sql('UPDATE nook_conversations SET seq=seq+1 WHERE id=?',id),sql('INSERT INTO nook_events SELECT id,seq,?,?,? FROM nook_conversations WHERE id=?',kind,object,r.user,id)]}
  const account=`EXISTS(SELECT 1 FROM oa_operators o JOIN nook_access a ON a.user=o.id WHERE o.id=? AND o.status='active' AND o.version=? AND a.generation=? AND ${productAccess('o.id')}) AND EXISTS(SELECT 1 FROM oa_operators o WHERE o.id=? AND o.status='active' AND ${productAccess('o.id')})`
  const access=`EXISTS(SELECT 1 FROM nook_reminders r WHERE r.id=? AND ${reminderAvailable()} AND ${reminderAvailable('r','r.user')} AND (r.recipient=r.user OR ${channelManagement('r.user','r.conversation')}))`
  const posting=r.schedule?` AND ${channelWritable('?')} AND ${canPost('?','?','NULL')}`:''
  const kind=r.schedule?broadcastKind('Reminder: '+r.text):null
  const valid=`${account} AND ${access}${posting}${kind?' AND '+broadcastFence(literal(r.conversation),literal(r.user),kind,r.confirm_broadcast===1):''}`,validValues=[r.user,r.operator_version,r.access_generation,r.recipient,r.id,...(r.schedule?[r.conversation,r.conversation,r.user]:[])]
  const allowed=await sql(`SELECT 1 WHERE ${valid}`,...validValues).first()
  const stale=r.schedule&&now-r.next_due>15*60000,reason=!allowed?'Account, audience, source, posting or broadcast permission is no longer available':stale?'Channel reminder is more than 15 minutes late. Review a future time before sending.':null
  const fence="EXISTS(SELECT 1 FROM nook_reminders WHERE id=? AND version=? AND state='pending' AND next_due=?)",fv=[r.id,r.version,r.next_due],key=crypto.randomUUID()
  const guard=(condition:string,values:any[])=>sql(`INSERT INTO nook_guard VALUES(?,CASE WHEN ${authority} AND ${condition} THEN 1 ELSE 0 END)`,key,...values)
  try{
   if(reason){await env.DB.batch([guard(fence,fv),sql("UPDATE nook_reminders SET state='failed',reason=?,updated=? WHERE id=?",reason,now,r.id),sql("INSERT INTO nook_reminder_occurrences VALUES(?,?,'failed',?,NULL)",r.id,r.next_due,now),sql('DELETE FROM nook_guard WHERE id=?',key)]);continue}
   const local=nextOccurrence(r.local_at,r.recurrence,null),due=local?occurrenceAt(local,r.zone):r.next_due,mid=r.schedule?crypto.randomUUID():null
   const payload={body:'Reminder: '+r.text,parent:null,attachments:[],mentions:[],urgent:false,urgentReason:null}
   await env.DB.batch([guard(`${fence} AND ${valid}`,[...fv,...validValues]),
    ...(mid?messageStatements(w,{id:r.conversation,mid,confirmBroadcast:r.confirm_broadcast===1,body:payload.body,parent:null,ids:[],attention:{mentions:[],urgent:false,urgentReason:null},intent:'reminder:'+r.id+':'+r.version+':'+r.next_due,payload:JSON.stringify(payload),now:new Date(now).toISOString()}):[]),
    sql("INSERT INTO nook_reminder_occurrences VALUES(?,?,'delivered',?,?)",r.id,r.next_due,now,mid),
    sql('UPDATE nook_reminders SET local_at=?,next_due=?,state=?,updated=? WHERE id=?',local??r.local_at,due,local?'pending':'ready',now,r.id),sql('DELETE FROM nook_guard WHERE id=?',key)])
  }catch(error){if(!String(error).includes('CHECK constraint')&&!String(error).includes('UNIQUE constraint'))throw error}
 }
 return (await env.DB.prepare("SELECT MIN(next_due) AS due FROM nook_reminders WHERE state='pending'").first<{due:number|null}>())?.due??null
}
