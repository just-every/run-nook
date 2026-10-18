import type {Context} from '../platform/storage/context'
import {fail} from '../family/team-chat/domain'
import {allowedGrant} from './access'
import {GATHER_MS} from '../notify/queue'

export type ConversationLevel='all'|'mentions'|'nothing'
export type ConversationThreads='all'|'followed'
export const defaultConversationLevel=(kind:string):ConversationLevel=>kind==='dm'?'all':'mentions'
export const conversationLevel=(user:string,conversation:string,deviceClass="'desktop'")=>`COALESCE((SELECT CASE WHEN ${deviceClass}='mobile' THEN COALESCE(mobile_level,level) ELSE level END FROM nook_conversation_notify WHERE user=${user} AND conversation=${conversation}),(SELECT CASE WHEN kind='dm' THEN 'all' ELSE 'mentions' END FROM nook_conversations WHERE id=${conversation}))`
export const conversationThreads=(user:string,conversation:string,deviceClass="'desktop'")=>`COALESCE((SELECT CASE WHEN ${deviceClass}='mobile' THEN COALESCE(mobile_threads,threads) ELSE threads END FROM nook_conversation_notify WHERE user=${user} AND conversation=${conversation}),'followed')`
export const effectiveThreadFollow=(user:string,conversation:string,root:string,deviceClass="'desktop'")=>`(${root} IS NOT NULL AND NOT EXISTS(SELECT 1 FROM nook_thread_unfollows u WHERE u.user=${user} AND u.message=${root}) AND (EXISTS(SELECT 1 FROM nook_thread_follows t WHERE t.user=${user} AND t.message=${root}) OR ${conversationThreads(user,conversation,deviceClass)}='all'))`

export async function readConversationNotify(c:Context,conversation:string){
 const row=await c.one(`SELECT v.kind,n.level,n.threads,n.mobile_level,n.mobile_threads FROM nook_conversations v LEFT JOIN nook_conversation_notify n ON n.user=? AND n.conversation=v.id WHERE v.id=?`,[c.uid,conversation],conversation)
 if(!row)fail(404,'Conversation unavailable')
 const defaultLevel=defaultConversationLevel(row.kind),level=row.level??defaultLevel,threads=row.threads??'followed'
 return {level,threads,mobileLevel:row.mobile_level??null,mobileThreads:row.mobile_threads??null,defaultLevel,overridden:level!==defaultLevel||threads!=='followed'||row.mobile_level!==null||row.mobile_threads!==null}
}

export async function conversationNotifyExceptions(c:Context){
 return c.rows(`SELECT v.id AS conversation,v.name,v.kind,COALESCE(n.level,CASE WHEN v.kind='dm' THEN 'all' ELSE 'mentions' END) AS level,n.threads,n.mobile_level AS mobileLevel,n.mobile_threads AS mobileThreads FROM nook_conversation_notify n JOIN nook_conversations v ON v.id=n.conversation JOIN nook_members m ON m.user=n.user AND m.conversation=n.conversation WHERE n.user=? AND ${allowedGrant('m.user','m.conversation')} AND (n.level IS NOT NULL AND n.level<>CASE WHEN v.kind='dm' THEN 'all' ELSE 'mentions' END OR n.threads<>'followed' OR n.mobile_level IS NOT NULL OR n.mobile_threads IS NOT NULL) ORDER BY v.name,v.id`,[c.uid])
}

export async function updateConversationNotify(c:Context,conversation:string,input:Record<string,unknown>){
 const keys=Object.keys(input)
 if(!keys.length||keys.some(key=>!['level','threads','mobileLevel','mobileThreads','reset'].includes(key)))fail(400,'Choose notification levels, thread replies, mobile overrides or reset')
 if('reset'in input&&(input.reset!==true||keys.length!==1))fail(400,'Reset must be true and supplied alone')
 if('level'in input&&!['all','mentions','nothing'].includes(input.level as string))fail(400,'Choose all, mentions or nothing')
 if('threads'in input&&!['all','followed'].includes(input.threads as string))fail(400,'Choose all or followed threads')
 if('mobileLevel'in input&&input.mobileLevel!==null&&!['all','mentions','nothing'].includes(input.mobileLevel as string))fail(400,'Choose all, mentions, nothing or inherit for mobile')
 if('mobileThreads'in input&&input.mobileThreads!==null&&!['all','followed'].includes(input.mobileThreads as string))fail(400,'Choose all, followed or inherit for mobile threads')
 const statements=input.reset?[
  c.sql('DELETE FROM nook_conversation_notify WHERE user=? AND conversation=?',c.uid,conversation),
  c.sql("UPDATE nook_preferences SET muted=0 WHERE user=? AND conversation=? AND EXISTS(SELECT 1 FROM nook_conversations WHERE id=? AND kind='dm')",c.uid,conversation,conversation),
 ]:[
  c.sql(`INSERT INTO nook_conversation_notify(user,conversation,level,threads,mobile_level,mobile_threads) VALUES(?,?,?,COALESCE(?,'followed'),?,?) ON CONFLICT(user,conversation) DO UPDATE SET level=CASE WHEN ? THEN excluded.level ELSE nook_conversation_notify.level END,threads=CASE WHEN ? THEN excluded.threads ELSE nook_conversation_notify.threads END,mobile_level=CASE WHEN ? THEN excluded.mobile_level ELSE nook_conversation_notify.mobile_level END,mobile_threads=CASE WHEN ? THEN excluded.mobile_threads ELSE nook_conversation_notify.mobile_threads END`,c.uid,conversation,input.level??null,input.threads??null,input.mobileLevel??null,input.mobileThreads??null,'level'in input?1:0,'threads'in input?1:0,'mobileLevel'in input?1:0,'mobileThreads'in input?1:0),
  ...(input.level==='all'||input.mobileLevel==='all'?[c.sql('UPDATE nook_preferences SET muted=0 WHERE user=? AND conversation=?',c.uid,conversation)]:[]),
 ]
 // A changed policy applies at delivery, too. Wake pending work without advancing
 // its initial gather or a retry's backoff, then arm the durable alarm.
 statements.push(c.sql("UPDATE nook_notify_queue SET due=max(created+?,min(due,?)) WHERE user=? AND conversation=? AND state='pending'",GATHER_MS,Date.now(),c.uid,conversation))
 await c.batch(statements,conversation)
 await c.hint()
 return readConversationNotify(c,conversation)
}

// Called in the same transaction as the older mute door. A DM's default is all,
// so setting NULL would immediately restore all and violate exclusivity.
export function muteConversationNotify(c:Context,conversation:string){
 return c.sql(`INSERT INTO nook_conversation_notify(user,conversation,level,threads) SELECT ?,v.id,'mentions','followed' FROM nook_conversations v LEFT JOIN nook_conversation_notify n ON n.user=? AND n.conversation=v.id WHERE v.id=? AND COALESCE(n.level,CASE WHEN v.kind='dm' THEN 'all' ELSE 'mentions' END)='all' OR v.id=? AND n.mobile_level='all' ON CONFLICT(user,conversation) DO UPDATE SET level=CASE WHEN COALESCE(nook_conversation_notify.level,(SELECT CASE WHEN kind='dm' THEN 'all' ELSE 'mentions' END FROM nook_conversations WHERE id=excluded.conversation))='all' THEN 'mentions' ELSE nook_conversation_notify.level END,mobile_level=CASE WHEN nook_conversation_notify.mobile_level='all' THEN 'mentions' ELSE nook_conversation_notify.mobile_level END`,c.uid,c.uid,conversation,conversation)
}
