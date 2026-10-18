import {previewBroadcast,BroadcastConfirmation} from '../broadcast/audience'
import {Context} from '../platform/storage/context'
import {fail,text} from '../family/team-chat/domain'
import {allowedGrant} from '../team/access'
import {canPost} from '../team/posting-policy'
import {channelWritable,channelManagement} from '../team/channel-policy'
import {savedAccess,savedTargetFence,savedTargetValues} from '../team/saved-policy'
import {parseReminder} from './parse.mjs'
import {reminderAvailable} from './policy'

async function arm(c:Context){const r=await c.env.CHAT_HUB.get(c.env.CHAT_HUB.idFromName('workspace')).fetch('https://hub/reminders',{method:'POST'});if(!r.ok)fail(503,'Reminder saved; scheduler unavailable. Retry the same reminder to arm it.')}
export async function reminderPreview(c:Context,input:Record<string,any>){
 const parsed=parseReminder(input.phrase,input.zone),target=parsed.target
 text(parsed.text,8000)
 let conversation:string|null=null,recipient=c.uid,audience='Only you'
 if(target.startsWith('#')){
  const name=target.slice(1),rows=await c.rows(`SELECT v.id,v.name FROM nook_conversations v JOIN nook_members m ON m.conversation=v.id WHERE m.user=? AND (v.id=? OR lower(v.name)=lower(?)) AND v.kind<>'dm' AND ${allowedGrant('m.user','m.conversation')} LIMIT 2`,[c.uid,name,name])
  if(rows.length!==1)fail(400,'Choose one current channel by its exact name or ID')
  conversation=rows[0].id
  if(!await c.one(`SELECT 1 WHERE ${channelWritable('?')} AND ${canPost('?','?','NULL')}`,[conversation,conversation,c.uid],conversation!))fail(403,'Posting is restricted in this channel')
  audience='Every current member of #'+rows[0].name
 }else if(target!=='me'){
  if(!input.conversation)fail(400,'Choose a conversation before reminding another person')
  conversation=text(input.conversation,128);await c.check(conversation)
  const people=await c.rows(`SELECT a.id,a.name FROM nook_actors a JOIN nook_members m ON m.user=a.id WHERE m.conversation=? AND (a.id=? OR lower(a.name)=lower(?)) AND a.active=1 AND ${allowedGrant('m.user','m.conversation')} LIMIT 2`,[conversation,target.slice(1),target.slice(1)],conversation)
  if(people.length!==1)fail(400,'Choose one current participant by exact name or ID')
  if(!await c.one(`SELECT 1 WHERE ${channelManagement('?','?')}`,[c.uid,conversation],conversation))fail(403,'Only channel managers, owners and admins can remind another person')
  recipient=people[0].id;audience='Only '+people[0].name
 }else if(input.conversation){conversation=text(input.conversation,128);await c.check(conversation)}
 return {...parsed,recipient,conversation,audience,broadcast:target.startsWith('#')?await previewBroadcast(c,conversation!,'Reminder: '+parsed.text):null}
}
export async function createReminder(c:Context,input:Record<string,any>){
 const intent=text(input.intent,128),old=await c.one('SELECT * FROM nook_reminders WHERE user=? AND intent=?',[c.uid,intent])
 const definition=JSON.stringify({phrase:input.phrase,zone:input.zone,conversation:input.conversation??null,sourceKind:input.sourceKind??null,source:input.source??null,confirmedDue:input.confirmedDue,confirmBroadcast:input.confirmBroadcast===true})
 if(old){await c.check(old.conversation??undefined);if(old.definition!==definition)fail(409,'Reminder intent changed');await arm(c);return {id:old.id}}
 const p=await reminderPreview(c,input)
 if(p.broadcast&&p.broadcast.recipients>=6&&input.confirmBroadcast!==true)throw new BroadcastConfirmation(p.broadcast)
 // Relative phrases are confirmed at their previewed instant, not shifted by
 // time spent reviewing. Absolute/recurring times must match exactly.
 if(!Number.isSafeInteger(input.confirmedDue)||input.confirmedDue<=Date.now())fail(400,'Preview and confirm a future reminder time')
 if((/\bin\s+\d+\s+(minutes?|hours?)\b/i.test(input.phrase)?Math.abs(input.confirmedDue-p.due)>120000:input.confirmedDue!==p.due))fail(409,'Reminder time changed; preview it again')
 if(p.recurrence==='none'&&/\bin\s+\d+\s+(minutes?|hours?|days?)\b/i.test(input.phrase)){p.due=input.confirmedDue;p.localAt=new Intl.DateTimeFormat('sv-SE',{timeZone:p.zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(p.due).replace(' ','T')}
 const source=input.source??null,sourceKind=input.sourceKind??null
 if(source!==null&&(!p.conversation||!['message','attachment'].includes(sourceKind)))fail(400,'Choose an available reminder source')
 const fence=source?savedTargetFence(sourceKind):'1',values=source?savedTargetValues({kind:sourceKind,target:text(source,128),conversation:p.conversation!}):[]
 if(source&&!await c.one(`SELECT 1 WHERE ${fence}`,values,p.conversation!))fail(404,'Reminder source unavailable')
 if(sourceKind!==null&&!source)fail(400,'Choose a reminder source')
 if(p.target.startsWith('#')&&source)fail(400,'Use a personal reminder for a private message or file source')
 const id=crypto.randomUUID(),schedule=p.target.startsWith('#')?id:null,now=Date.now()
 await c.batch([c.sql("INSERT INTO nook_reminders SELECT ?,?,?,?,?,?,?,?,?,?,?,'pending',1,?,NULL,?,?,?,generation,?,?,? FROM nook_access WHERE user=?",id,c.uid,p.recipient,p.conversation,sourceKind,source,p.text,p.localAt,p.zone,p.recurrence,p.due,schedule,intent,definition,c.session.operator.version,now,now,input.confirmBroadcast===true?1:0,c.uid)],p.conversation??undefined,`${fence} ${p.recipient!==c.uid?`AND EXISTS(SELECT 1 FROM (SELECT ? AS user,? AS conversation) creator WHERE ${channelManagement('creator.user','creator.conversation')})`:''} AND (? IS NULL OR EXISTS(SELECT 1 FROM nook_members m WHERE m.conversation=? AND m.user=? AND ${allowedGrant('m.user','m.conversation')}))`,[...values,...(p.recipient!==c.uid?[c.uid,p.conversation]:[]),p.conversation,p.conversation,p.recipient])
 await arm(c);await c.hint();return {id}
}
export async function listReminders(c:Context,after=''){
 if(typeof after!=='string'||after.length>128)fail(400,'Invalid reminder cursor')
 const rows=await c.rows(`SELECT r.*,v.name,creator.name AS ownerName,recipient.name AS recipientName,CASE WHEN ${reminderAvailable('r','?')} THEN 1 ELSE 0 END AS available,COALESCE(q.dnd_until,0) AS quiet,(SELECT state FROM nook_reminder_occurrences o WHERE o.reminder=r.id ORDER BY due DESC LIMIT 1) AS last_delivery,(SELECT message FROM nook_reminder_occurrences o WHERE o.reminder=r.id ORDER BY due DESC LIMIT 1) AS delivered_message FROM nook_reminders r LEFT JOIN nook_actors creator ON creator.id=r.user LEFT JOIN nook_actors recipient ON recipient.id=r.recipient LEFT JOIN nook_conversations v ON v.id=r.conversation LEFT JOIN nook_settings q ON q.user=r.recipient WHERE (r.user=? OR r.recipient=? OR r.schedule IS NOT NULL AND ${savedAccess('r.conversation','?')}) AND r.id>? ORDER BY r.id LIMIT 51`,[c.uid,c.uid,c.uid,c.uid,after])
 const items=rows.slice(0,50).map(r=>{const available=!!r.available,state=r.state;return {id:r.id,user:r.user,recipient:r.recipient,ownerName:r.ownerName,recipientName:r.recipientName,conversation:available?r.conversation:null,name:available?r.name:null,source:available?r.source:null,source_kind:r.source_kind,text:available?r.text:null,local_at:r.local_at,zone:r.zone,recurrence:r.recurrence,next_due:r.next_due,state,version:r.version,schedule:r.schedule,reason:available?r.reason:'Source unavailable',unavailable:!available,delivery:!available||state==='failed'?'failed':state==='cancelled'?'cancelled':state==='done'?'done':r.last_delivery==='done'?'done':r.last_delivery==='delivered'?(r.quiet>Date.now()?'held':'delivered'):'pending'}})
 return {items,cursor:rows.slice(0,50).at(-1)?.id??after,hasMore:rows.length>50}
}
export async function changeReminder(c:Context,id:string,input:Record<string,any>){
 const r=await c.one('SELECT * FROM nook_reminders WHERE id=? AND (user=? OR recipient=?)',[id,c.uid,c.uid]);if(!r)fail(404,'Reminder unavailable')
 if(input.version!==r.version)fail(409,'Reminder changed; reload')
 const owner=r.user===c.uid,action=input.action,now=Date.now(),guard='EXISTS(SELECT 1 FROM nook_reminders WHERE id=? AND version=?)',values=[id,r.version]
 if(!['complete','snooze','cancel','edit'].includes(action))fail(400,'Choose complete, snooze, edit or cancel')
 if(!owner&&!['complete','snooze'].includes(action))fail(403,'Only the creator can edit or cancel this reminder')
 if((r.state==='cancelled'&&action!=='cancel')||(r.state==='failed'&&!['cancel','edit'].includes(action)))fail(409,'Create a new reminder for cancelled or failed work')
 if(action==='cancel'||action==='complete'){
  if(r.schedule&&!owner)fail(403,'Only the creator changes a channel reminder')
  const state=action==='cancel'?'cancelled':r.recurrence==='none'?'done':'pending'
  await c.batch([c.sql('UPDATE nook_reminders SET state=?,version=version+1,updated=? WHERE id=?',state,now,id),...(action==='complete'?[c.sql("UPDATE nook_reminder_occurrences SET state='done',completed=? WHERE reminder=? AND state='delivered'",now,id)]:[])],undefined,guard,values)
 }else{
  let p:any
  if(action==='snooze'){
   if(!Number.isSafeInteger(input.until)||input.until<=now||input.until>now+7*86400000)fail(400,'Choose a future snooze within seven days')
   p={text:r.text,zone:r.zone,recurrence:r.recurrence,due:input.until,localAt:new Intl.DateTimeFormat('sv-SE',{timeZone:r.zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(input.until).replace(' ','T')}
  }else{
   p=await reminderPreview(c,{...input,conversation:r.conversation});if(p.broadcast&&p.broadcast.recipients>=6&&input.confirmBroadcast!==true)throw new BroadcastConfirmation(p.broadcast);if(p.recipient!==r.recipient||p.conversation!==r.conversation)fail(400,'Create a new reminder to change its audience')
   if(!Number.isSafeInteger(input.confirmedDue)||input.confirmedDue<=now||Math.abs(input.confirmedDue-p.due)>120000)fail(409,'Preview the changed time before saving')
  }
    await c.batch([c.sql("UPDATE nook_reminders SET text=?,local_at=?,zone=?,recurrence=?,next_due=?,confirm_broadcast=?,state='pending',version=version+1,operator_version=(SELECT version FROM oa_operators WHERE id=nook_reminders.user),access_generation=(SELECT generation FROM nook_access WHERE user=nook_reminders.user),reason=NULL,updated=? WHERE id=?",p.text,p.localAt,p.zone,p.recurrence,p.due,action==='snooze'?r.confirm_broadcast:input.confirmBroadcast===true?1:0,now,id),c.sql("UPDATE nook_reminder_occurrences SET state='done' WHERE reminder=? AND state='delivered'",id)],r.conversation??undefined,`${guard} AND EXISTS(SELECT 1 FROM nook_reminders r WHERE r.id=? AND ${reminderAvailable()})`,[...values,id])
 }
 await arm(c);await c.hint();return {id}
}

export async function personalReminderAttention(c:Context){
 const rows=await c.rows(`SELECT r.id,r.version,r.text,r.zone,r.next_due,r.conversation,r.source,r.source_kind FROM nook_reminders r WHERE r.recipient=? AND r.schedule IS NULL AND r.state NOT IN ('cancelled','failed','done','paused') AND EXISTS(SELECT 1 FROM nook_reminder_occurrences o WHERE o.reminder=r.id AND o.state='delivered') AND ${reminderAvailable()} ORDER BY r.next_due,r.id LIMIT 51`,[c.uid]);
 return rows.slice(0,50)
}
