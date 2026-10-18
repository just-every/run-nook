import {fail} from '../family/team-chat/domain'
import type {Context,StorageBindings} from '../platform/storage/context'
import {productAccess} from './access'
import {exact,savedId,savedAccess,savedTargetFence,savedTargetValues,savedProjection,savedItem,savedLiveMessage,type SavedTarget} from './saved-policy'

const available=(save='s',user='s.user')=>`${savedAccess(save+'.conversation',user)} AND (${save}.kind='link' OR ${save}.kind='message' AND ${savedLiveMessage(save+'.target',save+'.conversation')} OR ${save}.kind='attachment' AND EXISTS(SELECT 1 FROM nook_attachments a WHERE a.id=${save}.target AND a.conversation=${save}.conversation AND a.state='attached' AND a.object_key IS NOT NULL AND ${savedLiveMessage('a.message','a.conversation')}))`
export async function setSavedReminder(c:Context,value:unknown,input:unknown){
 const id=savedId(value),data=exact(input,['due','timeZone'])
 if(typeof data.timeZone!=='string'||data.timeZone.length>100)return fail(400,'Choose an IANA time zone')
 try{new Intl.DateTimeFormat('en-US',{timeZone:data.timeZone})}catch{fail(400,'Choose an IANA time zone')}
 const due=data.due
 if(due!==null&&(!Number.isSafeInteger(due)||Number(due)<=Date.now()||Number(due)>8.64e15))fail(400,'Choose a future reminder time')
 const saved=await c.one<SavedTarget>('SELECT conversation,kind,target FROM nook_saved_items WHERE id=? AND user=?',[id,c.uid])
 if(!saved)return fail(404,'Saved item unavailable')
 const now=Date.now(),fence=savedTargetFence(saved.kind),values=savedTargetValues(saved)
 if(due!==null&&!await c.one(`SELECT 1 WHERE ${fence}`,values,saved.conversation))fail(404,'Source unavailable')
 if(due===null){
  await c.batch([c.sql("UPDATE nook_saved_reminders SET state='cancelled',reason=NULL,updated=? WHERE saved=? AND user=?",now,id,c.uid)])
 }else{
  await c.batch([c.sql("INSERT INTO nook_saved_reminders VALUES(?,?,?,?,'pending',NULL,?) ON CONFLICT(saved) DO UPDATE SET due=excluded.due,time_zone=excluded.time_zone,state='pending',reason=NULL,updated=excluded.updated WHERE nook_saved_reminders.due<>excluded.due OR nook_saved_reminders.time_zone<>excluded.time_zone OR nook_saved_reminders.state='cancelled'",id,c.uid,due,data.timeZone,now)],saved.conversation,`EXISTS(SELECT 1 FROM nook_saved_items WHERE id=? AND user=? AND conversation=? AND kind=? AND target=?) AND ${fence}`,[id,c.uid,saved.conversation,saved.kind,saved.target,...values])
 }
 // A saved due time must arm the durable scheduler even with no browser socket.
 const response=await c.env.CHAT_HUB.get(c.env.CHAT_HUB.idFromName('workspace')).fetch('https://hub/reminders',{method:'POST'})
 if(!response.ok)fail(503,'Reminder saved; scheduler unavailable. Retry to arm it.')
 return {saved:id,reminder:await c.one('SELECT due,time_zone AS timeZone,state,reason FROM nook_saved_reminders WHERE saved=? AND user=?',[id,c.uid])}
}

/** Only body-free personal intent is durable. Resolve current sources at firing
 * and again on every read; no event, unread, notification or work acceptance. */
export async function drainSavedReminders(env:StorageBindings){
 const now=Date.now()
 const current=`EXISTS(SELECT 1 FROM nook_saved_items s JOIN oa_operators o ON o.id=s.user WHERE s.id=nook_saved_reminders.saved AND s.user=nook_saved_reminders.user AND o.status='active' AND ${productAccess('o.id')} AND ${available()})`
 await env.DB.prepare(`UPDATE nook_saved_reminders SET state=CASE WHEN ${current} THEN 'ready' ELSE 'cancelled' END,reason=CASE WHEN ${current} THEN NULL ELSE 'source-unavailable' END,updated=? WHERE state='pending' AND due<=?`).bind(now,now).run()
 const next=await env.DB.prepare("SELECT MIN(due) AS due FROM nook_saved_reminders WHERE state='pending'").first<{due:number|null}>()
 return next?.due??null
}

export async function reminderAttention(c:Context){
 const now=Date.now(),quiet=await c.one<{dnd_until:number|null}>('SELECT dnd_until FROM nook_settings WHERE user=?',[c.uid])
 const pageSql=`SELECT s.id,s.seq,s.created,s.kind,s.conversation,s.target,NULL AS actor FROM nook_saved_items s JOIN nook_saved_reminders reminder ON reminder.saved=s.id AND reminder.user=s.user WHERE s.user=? AND reminder.state='ready' AND reminder.due<=? AND ${available()} ORDER BY s.seq DESC LIMIT 51`
 const rows=await c.rows(savedProjection(pageSql),[c.uid,now,c.uid]),visible=rows.map(r=>savedItem(r)).filter(r=>!r.unavailable)
 const next=await c.one<{due:number|null}>("SELECT MIN(due) AS due FROM nook_saved_reminders WHERE user=? AND state='pending' AND due>?",[c.uid,now])
 return {items:quiet?.dnd_until&&quiet.dnd_until>now?[]:visible.slice(0,50),hasMore:visible.length>50,deferredCount:quiet?.dnd_until&&quiet.dnd_until>now?visible.length:0,nextWakeAt:next?.due??null}
}
export async function actOnSavedReminder(c:Context,id:string,input:Record<string,any>){
 if(!['done','snooze'].includes(input.action))fail(400,'Choose done or snooze')
 const saved=await c.one<SavedTarget>('SELECT s.conversation,s.kind,s.target FROM nook_saved_items s JOIN nook_saved_reminders r ON r.saved=s.id WHERE s.id=? AND s.user=? AND r.user=s.user',[id,c.uid])
 if(!saved)return fail(404,'Reminder unavailable')
 const until=input.until
 if(input.action==='snooze'&&(!Number.isSafeInteger(until)||until<=Date.now()||until>Date.now()+7*86400000))fail(400,'Choose a future time within seven days')
 await c.batch([c.sql('UPDATE nook_saved_reminders SET state=?,due=COALESCE(?,due),reason=NULL,updated=? WHERE saved=? AND user=?',input.action==='done'?'done':'pending',input.action==='snooze'?until:null,Date.now(),id,c.uid)],saved.conversation,savedTargetFence(saved.kind),savedTargetValues(saved))
 await c.env.CHAT_HUB.get(c.env.CHAT_HUB.idFromName('workspace')).fetch('https://hub/reminders',{method:'POST'})
 return {ok:true}
}
