import {keywordUsers} from '../notify/keywords.server'
import {deliverForward} from './forward'
import {broadcastKind,broadcastFence} from '../broadcast/audience'
import {literal} from '../broadcast/policy'
import {materializeOccurrenceFiles,cleanupOccurrenceFiles} from './files'
import {type StorageBindings,type MessageWriter,authority} from '../platform/storage/context'
import {messageStatements} from '../platform/storage/message-statements'
import {productAccess,allowedGrant} from '../team/access'
import {canPost} from '../team/posting-policy'
import {channelWritable} from '../team/channel-policy'
import {liveThreadRoots} from '../platform/storage/threads'
import {occurrenceAt,nextOccurrence,type Recurrence} from './time.mjs'

type Schedule={id:string;user:string;conversation:string;payload:string;local_at:string;zone:string;recurrence:Recurrence;end_date:string|null;next_due:number;version:number;operator_version:number;access_generation:number}
function writer(env:StorageBindings,uid:string):MessageWriter{
 const sql=(statement:string,...values:any[])=>env.DB.prepare(statement).bind(...values)
 return {uid,sql,event:(id,kind,object)=>[sql('UPDATE nook_conversations SET seq=seq+1 WHERE id=?',id),sql('INSERT INTO nook_events SELECT id,seq,?,?,? FROM nook_conversations WHERE id=?',kind,object,uid,id)]}
}
export async function drainSchedules(env:StorageBindings,now=Date.now()){
 const rows=(await env.DB.prepare("SELECT * FROM nook_schedules WHERE state='active' AND next_due<=? ORDER BY next_due,id LIMIT 10").bind(now).all<Schedule>()).results
 for(const s of rows){
  const w=writer(env,s.user),payload=JSON.parse(s.payload),id=s.conversation,parent=payload.parent,kind=broadcastKind(payload.body)
  if(payload.forward&&now-s.next_due<=15*60_000){await deliverForward(env,s,payload.forward,now);continue}
  const rules=[
   ...(kind?[{sql:broadcastFence(literal(id),literal(s.user),kind,payload.confirmBroadcast===true),values:[],reason:'Broadcast policy or audience changed. Review consent before rescheduling.'}]:[]),
   {sql:`EXISTS(SELECT 1 FROM oa_operators o JOIN nook_access a ON a.user=o.id WHERE o.id=? AND o.version=? AND o.status='active' AND a.generation=? AND ${productAccess('o.id')})`,values:[s.user,s.operator_version,s.access_generation],reason:'Your account changed or was deactivated. Review and save a new time.'},
   {sql:`EXISTS(SELECT 1 FROM nook_members m WHERE m.conversation=? AND m.user=? AND ${allowedGrant('m.user','m.conversation')})`,values:[id,s.user],reason:'You no longer have access to this conversation.'},
   {sql:channelWritable('?'),values:[id],reason:'The conversation is archived or has moved. Review its destination before rescheduling.'},
   {sql:canPost('?','?','?'),values:[id,parent,s.user],reason:'Posting permission changed. Ask a channel manager before rescheduling.'},
   {sql:`(? IS NULL OR EXISTS(SELECT 1 FROM (${liveThreadRoots}) WHERE id=? AND conversation=?))`,values:[parent,parent,id],reason:'The original thread is no longer available.'},
   {sql:`NOT EXISTS(SELECT 1 FROM json_each(?) r WHERE NOT EXISTS(SELECT 1 FROM nook_members m JOIN oa_operators o ON o.id=m.user AND o.status='active' WHERE m.conversation=? AND m.user=r.value AND ${allowedGrant('m.user','m.conversation')}))`,values:[JSON.stringify(payload.mentions),id],reason:'A mentioned person no longer has access. Edit the recipients before rescheduling.'},
  ]
  const flags=await env.DB.prepare('SELECT '+rules.map((r,i)=>`(${r.sql}) AS r${i}`).join(',')).bind(...rules.flatMap(r=>r.values)).first<Record<string,number>>()
  const denied=rules.find((_,i)=>!flags?.['r'+i]),stale=now-s.next_due>15*60_000
  const reason=denied?.reason??(stale?'More than 15 minutes late after an outage. Review a future time before sending.':null)
  const fence="EXISTS(SELECT 1 FROM nook_schedules WHERE id=? AND version=? AND state='active' AND next_due=?)",fenceValues=[s.id,s.version,s.next_due],key=crypto.randomUUID()
  const guard=(condition:string,values:any[])=>w.sql(`INSERT INTO nook_guard VALUES(?,CASE WHEN ${authority} AND ${condition} THEN 1 ELSE 0 END)`,key,...values)
  if(reason){
   await env.DB.batch([guard(fence,fenceValues),w.sql('INSERT INTO nook_schedule_occurrences VALUES(?,?,?,?,?,NULL,?,?,?)',s.id,s.local_at,s.version,s.next_due,s.zone,denied?'failed':'needs-review',reason,now),w.sql('UPDATE nook_schedules SET state=?,reason=?,updated=? WHERE id=?',denied?'failed':'needs-review',reason,now,s.id),w.sql('DELETE FROM nook_guard WHERE id=?',key)]).catch(error=>{if(!String(error).includes('CHECK constraint')&&!String(error).includes('UNIQUE constraint'))throw error})
   continue
  }
  const intent='scheduled:'+s.id+':'+s.version+':'+s.local_at,mid=crypto.randomUUID(),local=nextOccurrence(s.local_at,s.recurrence,s.end_date),nextDue=local?occurrenceAt(local,s.zone):s.next_due
  let files:string[]=[]
  try{
   files=await materializeOccurrenceFiles(env,s,`${fence} AND ${rules.map(r=>'('+r.sql+')').join(' AND ')}`,[...fenceValues,...rules.flatMap(r=>r.values)])
   const fileFence="NOT EXISTS(SELECT 1 FROM json_each(?) j WHERE NOT EXISTS(SELECT 1 FROM nook_attachments f WHERE f.id=j.value AND f.conversation=? AND f.author=? AND f.state='staged' AND f.expires>CAST(unixepoch('subsec')*1000 AS INTEGER)))"
   await env.DB.batch([
    guard(`${fence} AND ${rules.map(r=>'('+r.sql+')').join(' AND ')} AND ${fileFence}`,[...fenceValues,...rules.flatMap(r=>r.values),JSON.stringify(files),id,s.user]),
    ...messageStatements(w,{id,mid,confirmBroadcast:payload.confirmBroadcast===true,body:payload.body,parent,ids:files,attention:{mentions:payload.mentions,urgent:payload.urgent,urgentReason:payload.urgentReason},intent,payload:JSON.stringify({...payload,attachments:files}),now:new Date(now).toISOString(),keywordUsers:await keywordUsers(env.DB,id,payload.body,s.user)}),
    w.sql("INSERT INTO nook_schedule_occurrences VALUES(?,?,?,?,?,?,'sent',NULL,?)",s.id,s.local_at,s.version,s.next_due,s.zone,mid,now),
    ...(!local?[w.sql('INSERT OR IGNORE INTO nook_object_deletes(object_key,created) SELECT object_key,? FROM nook_schedule_files WHERE schedule=?',now,s.id),w.sql('DELETE FROM nook_schedule_files WHERE schedule=?',s.id)]:[]),
    w.sql('UPDATE nook_schedules SET local_at=?,next_due=?,state=?,payload=?,reason=NULL,updated=? WHERE id=?',local??s.local_at,nextDue,local?'active':'complete',local?s.payload:JSON.stringify({...payload,attachments:[]}),now,s.id),w.sql('DELETE FROM nook_guard WHERE id=?',key),
   ])
  }catch(error){
   const current=await env.DB.prepare(`SELECT 1 WHERE ${fence}`).bind(...fenceValues).first()
   if(current){
    const reason=error instanceof Error&&[400,409,503].includes((error as any).status)?error.message:'Scheduled send was not confirmed. Review this occurrence before rescheduling.'
    // Stop this occurrence before cleaning partial copies. Another worker with
    // the old version can no longer commit against the same schedule fence.
    await env.DB.batch([guard(fence,fenceValues),w.sql('INSERT INTO nook_schedule_occurrences VALUES(?,?,?,?,?,NULL,?,?,?)',s.id,s.local_at,s.version,s.next_due,s.zone,'failed',reason,now),w.sql("UPDATE nook_schedules SET state='failed',reason=?,updated=? WHERE id=?",reason,now,s.id),w.sql('DELETE FROM nook_guard WHERE id=?',key)]).catch(e=>{if(!String(e).includes('CHECK constraint')&&!String(e).includes('UNIQUE constraint'))throw e})
   }
   // A lost response to a successful transaction finds attached files, which
   // cleanup deliberately preserves. A changed/failed occurrence is fenced off.
   await cleanupOccurrenceFiles(env,(error as any).occurrenceFileIds??files)
  }
 }
 const next=await env.DB.prepare("SELECT MIN(next_due) AS due FROM nook_schedules WHERE state='active'").first<{due:number|null}>()
 return next?.due??null
}
