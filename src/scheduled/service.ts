import {prepareForward,publicForward} from './forward'
import {previewBroadcast,BroadcastConfirmation} from '../broadcast/audience'
import {prepareScheduleFiles} from './files'
import {Context} from '../platform/storage/context'
import {fail,text,messageBody} from '../family/team-chat/domain'
import {messageAttentionInput} from '../family/team-chat/attention'
import {allowedGrant} from '../team/access'
import {canPost} from '../team/posting-policy'
import {liveThreadRoots} from '../platform/storage/threads'
import {validateScheduleTime,occurrenceAt,nextOccurrence} from './time.mjs'

export async function listSchedules(c:Context,after=''){
 if(typeof after!=='string'||after.length>128)fail(400,'Invalid schedule cursor')
 const rows=await c.rows(`SELECT s.*,CASE WHEN m.user IS NOT NULL AND ${allowedGrant('m.user','m.conversation')} THEN v.name ELSE NULL END AS name,v.kind,
 CASE WHEN m.user IS NOT NULL AND ${allowedGrant('m.user','m.conversation')} THEN s.payload ELSE NULL END AS visiblePayload
 FROM nook_schedules s JOIN nook_conversations v ON v.id=s.conversation LEFT JOIN nook_members m ON m.conversation=s.conversation AND m.user=s.user WHERE s.user=? AND s.id>? ORDER BY s.id LIMIT 51`,[c.uid,after])
 const page=rows.slice(0,50),ids=JSON.stringify(page.map(r=>r.id))
 const files=await c.rows('SELECT schedule,attachment AS id,name,mime,size,position FROM nook_schedule_files WHERE schedule IN (SELECT value FROM json_each(?)) ORDER BY position',[ids])
 const names=await c.rows<{id:string;name:string}>(`SELECT v.id,v.name FROM nook_conversations v JOIN nook_members m ON m.conversation=v.id WHERE m.user=? AND ${allowedGrant('m.user','m.conversation')}`,[c.uid])
 const occurrences=await c.rows(`SELECT * FROM (SELECT *,ROW_NUMBER() OVER(PARTITION BY schedule ORDER BY completed DESC,version DESC,local_at DESC) AS position FROM nook_schedule_occurrences WHERE schedule IN (SELECT value FROM json_each(?))) WHERE position<=6`,[ids])
 return {items:page.map(({payload,definition,visiblePayload,operator_version,access_generation,intent,...row})=>({...row,payload:visiblePayload?publicPayload(visiblePayload,names):null,files:visiblePayload?files.filter(f=>f.schedule===row.id):[],hasMoreOccurrences:occurrences.filter(o=>o.schedule===row.id).length>5,occurrences:occurrences.filter(o=>o.schedule===row.id).slice(0,5)})),cursor:page.at(-1)?.id??after,hasMore:rows.length>50}
}
function publicPayload(value:string,names:{id:string;name:string}[]){const payload=JSON.parse(value);if(payload.forward){payload.forward=publicForward(payload.forward);payload.forward.destinations=payload.forward.destinations.map((d:any)=>({...d,name:names.find(n=>n.id===d.conversation)?.name??'Conversation unavailable'}))}return payload}
async function arm(c:Context){const response=await c.env.CHAT_HUB.get(c.env.CHAT_HUB.idFromName('workspace')).fetch('https://hub/reminders',{method:'POST'});if(!response.ok)fail(503,'Message saved; scheduler unavailable. Open Scheduled messages and retry to arm it.')}
async function definition(c:Context,conversation:string,input:Record<string,any>,allowPast=false){
 if(Object.keys(input).some(k=>!['body','confirmBroadcast','parent','mentions','urgent','urgentReason','attachments','localAt','zone','recurrence','endDate','intent','version','action','forward'].includes(k)))fail(400,'Unsupported schedule field')
 const attachments=input.attachments??[];if(!Array.isArray(attachments)||attachments.length>5||attachments.some((id:any)=>typeof id!=='string')||new Set(attachments).size!==attachments.length)fail(400,'Choose up to five ordered attachments')
 const body=messageBody(input.body),time=validateScheduleTime(input),due=occurrenceAt(time.localAt,time.zone)
 if(!allowPast&&(due<=Date.now()||due>Date.now()+366*86400000))fail(400,'Choose a future time within one year')
 if(time.recurrence!=='none'&&!time.endDate)fail(400,'Choose an end date for a recurring prompt')
 const parent=input.parent??null;if(parent!==null&&typeof parent!=='string')fail(400,'Invalid thread')
 const broadcast=input.forward?null:await previewBroadcast(c,conversation,body)
 if(input.confirmBroadcast!==undefined&&typeof input.confirmBroadcast!=='boolean')fail(400,'confirmBroadcast must be boolean')
 if(broadcast&&broadcast.recipients>=6&&input.confirmBroadcast!==true)throw new BroadcastConfirmation(broadcast)
 const forward=input.forward?await prepareForward(c,input.forward):null
 if(forward&&(time.recurrence!=='none'||attachments.length))fail(400,'A scheduled forward is a one-time forward with its original source files')
 const attention=messageAttentionInput(input),payload={body,parent,attachments,...attention,...(broadcast?{confirmBroadcast:input.confirmBroadcast===true}:{}),...(forward?{forward}:{})}
 const permission=canPost('?','?','?'),values=[conversation,parent,c.uid]
 if(!await c.one(`SELECT 1 WHERE ${permission}`,values,conversation))fail(403,'Posting is restricted in this channel')
 const sources=`(? IS NULL OR EXISTS(SELECT 1 FROM (${liveThreadRoots}) WHERE id=? AND conversation=?)) AND NOT EXISTS(SELECT 1 FROM json_each(?) r WHERE NOT EXISTS(SELECT 1 FROM nook_members m WHERE m.conversation=? AND m.user=r.value AND ${allowedGrant('m.user','m.conversation')}))`
 const sourceValues=[parent,parent,conversation,JSON.stringify(attention.mentions),conversation]
 if(!await c.one(`SELECT 1 WHERE ${sources}`,sourceValues,conversation))fail(400,'The thread or a mention recipient is no longer available')
 return {time,due,payload:JSON.stringify(payload),definition:JSON.stringify({payload:{...payload,...(forward?{forward:{...publicForward(forward),confirmation:undefined}}:{})},...time}),permission:`${permission} AND ${sources}`,values:[...values,...sourceValues]}
}
function forwardAudit(c:Context,payload:string){const f=JSON.parse(payload).forward;return f&&f.mode==='show'?[c.sql('INSERT INTO nook_audit VALUES(?,?,?,?,?,?,?,?,?,?)',crypto.randomUUID(),c.uid,'forwarding',Date.now(),'forward.schedule',f.destinations[0].conversation,1,'Show message disclosure approved for scheduled delivery','confirmed',f.destinations.length)]:[]}
export async function createSchedule(c:Context,conversation:string,input:Record<string,any>){
 const intent=text(input.intent,128)
 const old=await c.one('SELECT id,definition FROM nook_schedules WHERE user=? AND intent=?',[c.uid,intent],conversation)
 const d=await definition(c,conversation,input,!!old)
 if(old){if(old.definition!==d.definition)fail(409,'Schedule intent changed');await arm(c);return {id:old.id}}
 const id=crypto.randomUUID(),now=Date.now(),files=await prepareScheduleFiles(c,id,conversation,JSON.parse(d.payload).attachments)
 await c.writeBatch([c.sql("INSERT INTO nook_schedules SELECT ?,?,?,?, ?,?,?,?,?,?,?,'active',1,?,generation,NULL,?,? FROM nook_access WHERE user=?",id,c.uid,conversation,intent,d.definition,d.payload,d.time.localAt,d.time.zone,d.time.recurrence,d.time.endDate,d.due,c.session.operator.version,now,now,c.uid),...files.statements,...forwardAudit(c,d.payload)],conversation,`${d.permission} AND ${files.fence}`,[...d.values,...files.values])
 await arm(c);await c.hint();return {id}
}
export async function changeSchedule(c:Context,id:string,input:Record<string,any>){
 const old=await c.one('SELECT * FROM nook_schedules WHERE id=? AND user=?',[id,c.uid])
 if(!old)fail(404,'Scheduled message unavailable')
 if(!Number.isSafeInteger(input.version)||old.version!==input.version)fail(409,'Scheduled message changed; reload')
 const version='EXISTS(SELECT 1 FROM nook_schedules WHERE id=? AND user=? AND version=?)',values=[id,c.uid,input.version],now=Date.now()
 if(input.action==='cancel'){
  await c.batch([c.sql('INSERT OR IGNORE INTO nook_object_deletes(object_key,created) SELECT object_key,? FROM nook_schedule_files WHERE schedule=?',now,id),c.sql('DELETE FROM nook_schedule_files WHERE schedule=?',id),c.sql("UPDATE nook_schedules SET state='cancelled',payload=json_remove(json_set(payload,'$.attachments',json('[]')),'$.forward.session'),version=version+1,reason=NULL,updated=? WHERE id=?",now,id)],undefined,version,values)
 }else if(input.action==='pause'){
  if(old.state!=='active')fail(409,'Only a pending series can be paused')
  await c.batch([c.sql("UPDATE nook_schedules SET state='paused',version=version+1,reason='Paused by you',updated=? WHERE id=?",now,id)],undefined,version,values)
 }else if(input.action==='edit'){
  if(old.state==='cancelled'||old.state==='complete')fail(409,'Create a new schedule for a completed or cancelled message')
  const d=await definition(c,old.conversation,input),files=await prepareScheduleFiles(c,id,old.conversation,JSON.parse(d.payload).attachments)
  await c.writeBatch([c.sql("UPDATE nook_schedules SET payload=?,local_at=?,zone=?,recurrence=?,end_date=?,next_due=?,state='active',version=version+1,operator_version=?,access_generation=(SELECT generation FROM nook_access WHERE user=?),reason=NULL,updated=? WHERE id=?",d.payload,d.time.localAt,d.time.zone,d.time.recurrence,d.time.endDate,d.due,c.session.operator.version,c.uid,now,id),...files.statements,...forwardAudit(c,d.payload)],old.conversation,`${version} AND ${d.permission} AND ${files.fence}`,[...values,...d.values,...files.values])
 }else if(input.action==='arm'){await arm(c);return {id}}
 else fail(400,'Choose edit, pause, cancel or arm. To resume, review a future time and save it.')
 await arm(c);await c.hint();return {id}
}
export function schedulePreview(input:Record<string,any>){const time=validateScheduleTime(input);let local:string|null=time.localAt;const instances=[];for(let i=0;i<3&&local;i++){instances.push({localAt:local,at:occurrenceAt(local,time.zone)});local=nextOccurrence(local,time.recurrence,time.endDate)}return {...time,instances,catchUp:'More than 15 minutes late: held for review, never posted automatically.'}}

export async function scheduleOccurrences(c:Context,id:string,after:string){
 if(!await c.one('SELECT 1 FROM nook_schedules WHERE id=? AND user=?',[id,c.uid]))fail(404,'Scheduled message unavailable')
 let cursor:{completed:number;version:number;local:string}|null=null
 if(after){try{cursor=JSON.parse(atob(after))}catch{fail(400,'Invalid occurrence cursor')};if(!cursor||!Number.isSafeInteger(cursor.completed)||!Number.isSafeInteger(cursor.version)||typeof cursor.local!=='string')fail(400,'Invalid occurrence cursor')}
 const rows=await c.rows(`SELECT * FROM nook_schedule_occurrences WHERE schedule=? ${cursor?'AND (completed,version,local_at)<(?,?,?)':''} ORDER BY completed DESC,version DESC,local_at DESC LIMIT 51`,[id,...(cursor?[cursor.completed,cursor.version,cursor.local]:[])])
 const items=rows.slice(0,50),last=items.at(-1);return {items,hasMore:rows.length>50,cursor:last?btoa(JSON.stringify({completed:last.completed,version:last.version,local:last.local_at})):after}
}

export async function scheduleAudience(c:Context,conversation:string){
 await c.check(conversation)
 const people=await c.rows(`SELECT a.id,a.name FROM nook_members m JOIN nook_actors a ON a.id=m.user WHERE m.conversation=? AND a.active=1 AND ${allowedGrant('m.user','m.conversation')} ORDER BY a.name,a.id LIMIT 20`,[conversation],conversation)
 const total=(await c.one(`SELECT count(*) AS n FROM nook_members m JOIN nook_actors a ON a.id=m.user WHERE m.conversation=? AND a.active=1 AND ${allowedGrant('m.user','m.conversation')}`,[conversation],conversation)).n
 return {owner:c.session.operator.displayName,people,total}
}
