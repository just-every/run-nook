import {channelColumns} from '../../team/channel-policy'
import {allowedGrant,productAccess,visibleIdentity} from '../../team/access'
import {fail,text} from '../../family/team-chat/domain'
import {Context} from './context'
import {messageReactions} from '../../team/reactions.server'
import {historyPage} from './history'
import {mixedWindow} from '../../imports/window'
import {mixedHistory,mixedSearch} from '../../imports/history'
import {threadPreferences,threads,threadWindowRead,threadReadCount} from './threads'
import {historicalMessage,importedSelect,publishedImport} from '../../imports/projection'
export const attachmentColumns='id,conversation,author,message,name,mime,size,sha256,expires,state,created'
// Counts cover the whole authorized thread, independently of the current page.
// Native routing intent is projected separately so bodies and retry payloads
// never need to be sent to the client a second time.
async function messageMetadata(c:Context,conversation:string,items:any[]){
 if(!items.length)return items
 const ids=JSON.stringify([...new Set(items.map(m=>m.id))])
 const [rows,reactions]=await Promise.all([c.rows(`WITH requested AS (SELECT value AS id FROM json_each(?)),
 native AS (SELECT m.id,CASE WHEN m.deleted=0 AND json_valid(m.payload) THEN m.payload ELSE '{}' END AS routing FROM nook_message_history m JOIN requested p ON p.id=m.id WHERE m.conversation=?)
 SELECT p.id,
 (SELECT COUNT(*) FROM nook_message_history reply WHERE reply.conversation=? AND reply.parent=p.id AND reply.deleted=0)+
 (SELECT COUNT(*) FROM nook_import_history reply JOIN nook_imports j ON j.id=reply.job WHERE reply.conversation=? AND reply.parent=p.id AND (reply.erased=0 OR reply.retained_body=1) AND j.state='complete' AND ${publishedImport}) AS replyCount,
 COALESCE(json_extract(n.routing,'$.urgent'),0) AS urgent,json_extract(n.routing,'$.urgentReason') AS urgentReason,
 (SELECT json_group_array(json_object('id',a.id,'name',a.name)) FROM json_each(n.routing,'$.mentions') recipient JOIN nook_actor_history a ON a.id=recipient.value) AS notified
 FROM requested p LEFT JOIN native n ON n.id=p.id`,[ids,conversation,conversation,conversation],conversation),
  messageReactions(c,conversation,items.filter(m=>!m.immutable&&!m.deleted).map(m=>m.id)),
 ])
 const metadata=new Map(rows.map(row=>[row.id,{replyCount:row.replyCount,urgent:!!row.urgent,urgentReason:row.urgentReason,notified:JSON.parse(row.notified)}]))
 return items.map(m=>({...m,...metadata.get(m.id),reactions:reactions[m.id]??[]}))
}
export async function message(c:Context,id:string){const m=await c.one(`SELECT m.*,CASE WHEN m.retained_body=1 THEN 'Former member' ELSE a.name END AS authorName FROM nook_message_history m JOIN nook_actor_history a ON a.id=m.author WHERE m.id=? AND EXISTS(SELECT 1 FROM nook_members WHERE conversation=m.conversation AND user=?)`,[id,c.uid]);if(!m){const source=await c.one(`${importedSelect} WHERE r.id=? AND EXISTS(SELECT 1 FROM nook_members WHERE conversation=r.conversation AND user=?)`,[id,c.uid]);if(!source)fail(404,'Message unavailable');await c.check(source.conversation);return historicalMessage(c,source)}await c.check(m.conversation);const {payload,body_lower,ordinal,author_ordinal,...publicMessage}=m;return {...publicMessage,...(m.retained_body?{immutable:true,retainedSource:'native'}:{}),attachments:await c.rows(`SELECT ${attachmentColumns} FROM nook_attachment_history WHERE message=? ORDER BY position LIMIT 5`,[id],m.conversation)}}
export const outcomeSelect=`SELECT o.*,a.name AS authorName,CASE WHEN EXISTS(SELECT 1 FROM nook_erased_assignees e WHERE e.outcome=o.id) THEN 'Erased member' ELSE b.name END AS assigneeName,CASE WHEN o.source IS NULL THEN CASE WHEN o.source_version IS NULL THEN 'none' ELSE 'deleted' END WHEN m.version=o.source_version THEN 'current' ELSE 'changed' END AS sourceState FROM nook_outcome_history o LEFT JOIN nook_actor_history a ON a.id=o.author LEFT JOIN nook_actor_history b ON b.id=o.assignee LEFT JOIN nook_messages m ON m.id=o.source`
export async function outcome(c:Context,id:string){const o=await c.one(`${outcomeSelect} WHERE o.id=? AND EXISTS(SELECT 1 FROM nook_members WHERE conversation=o.conversation AND user=?)`,[id,c.uid]);if(!o)fail(404,'Outcome unavailable');await c.check(o.conversation);return o}
export async function read(c:Context,action:string,id='',input:Record<string,any>={}){
 if(action==='message'){const m=await message(c,id);return (await messageMetadata(c,m.conversation,[m]))[0]}
 if(action==='me'){const access=await c.one('SELECT mode FROM nook_access WHERE user=? AND active=1',[c.uid]);return {id:c.uid,name:c.session.operator.displayName,role:c.session.operator.role,mode:access?.mode}}
 if(action==='users')return c.rows(`SELECT o.id,o.display_name AS name FROM oa_operators o WHERE o.status='active' AND ${productAccess('o.id')} AND ${visibleIdentity('?', 'o.id')} ORDER BY o.id LIMIT 1000`,[c.uid,c.uid,c.uid])
 if(action==='settings')return {dndUntil:(await c.one('SELECT dnd_until FROM nook_settings WHERE user=?',[c.uid]))?.dnd_until??null}
 if(action==='conversations')return c.rows(`SELECT c.id,c.name,c.kind,c.owner,c.seq,${channelColumns()},COALESCE(r.seq,0) AS readSeq,c.message_count-COALESCE(r.total,0)-COALESCE(a.total,0)+COALESCE(r.own,0)-(${threadReadCount('m.user','c.id','COALESCE(r.seq,0)')}) AS unread FROM nook_members m JOIN nook_conversations c ON c.id=m.conversation LEFT JOIN nook_reads r ON r.conversation=c.id AND r.user=m.user LEFT JOIN nook_author_counts a ON a.conversation=c.id AND a.user=m.user WHERE m.user=? AND ${allowedGrant('m.user','m.conversation')} AND NOT EXISTS(SELECT 1 FROM nook_import_channels ch JOIN nook_imports j ON j.id=ch.job WHERE ch.conversation=c.id AND (j.state<>'complete' OR NOT (${publishedImport}))) ORDER BY c.id LIMIT 1000`,[c.uid]).then(rows=>rows.map(row=>({...row,archived:!!row.archived})))
 if(action==='historyWindow'){
  const window=await mixedWindow(c,id,input),messages=await messageMetadata(c,id,[...window.items,...(window.root?[window.root]:[])])
  return {...window,...await threadWindowRead(c,id,window),items:messages.slice(0,window.items.length),root:window.root?messages.at(-1):null}
 }
 if(action==='threads')return threads(c,input,async id=>{const m=await message(c,id);return (await messageMetadata(c,m.conversation,[m]))[0]})
 if(action==='search')return mixedSearch(c,input)
 if(action==='attention')return attention(c,input)
 if(action==='members')return c.rows(`SELECT o.id,o.display_name AS name FROM nook_members m JOIN oa_operators o ON o.id=m.user WHERE m.conversation=? AND ${allowedGrant('m.user','m.conversation')} ORDER BY o.id LIMIT 50`,[id],id)
 if(action==='roster')return c.rows(`SELECT a.id,a.name,EXISTS(SELECT 1 FROM nook_members m WHERE m.conversation=r.conversation AND m.user=r.user AND ${allowedGrant('m.user','m.conversation')}) AS active FROM nook_dm_roster r JOIN nook_actor_history a ON a.id=r.user WHERE r.conversation=? ORDER BY a.id LIMIT 50`,[id],id)
 if(action==='preferences'){const [p,threadFollows]=await Promise.all([c.one('SELECT muted,followed FROM nook_preferences WHERE user=? AND conversation=?',[c.uid,id],id),threadPreferences(c,id)]);return {muted:!!p?.muted,followed:!!p?.followed,threads:threadFollows.map(f=>f.message),threadFollows}}
 if(action==='replay'){const frontier=(await c.one('SELECT seq FROM nook_conversations WHERE id=?',[id],id)).seq;const after=input.after??0;if(!Number.isSafeInteger(after)||after<0)fail(400,'Invalid cursor');if(after>frontier)fail(400,'Invalid cursor');const events=await c.rows('SELECT conversation,seq,kind,object FROM nook_events WHERE conversation=? AND seq>? ORDER BY seq LIMIT 100',[id,after],id);return {events,cursor:events.at(-1)?.seq??after,frontier,hasMore:(events.at(-1)?.seq??after)<frontier}}
 if(action==='messages'){await c.check(id);return messageMetadata(c,id,await mixedHistory(c,id,input,async input=>{const limit=input.limit??100,after=input.after??'';if(typeof after!=='string'||!Number.isSafeInteger(limit)||limit<1||limit>1000)fail(400,'Invalid history page');let seq=0;if(after){const row=await c.one('SELECT sequence FROM nook_message_history WHERE conversation=? AND (created||id)=?',[id,after],id);if(!row)fail(400,'History cursor unavailable');seq=row.sequence}return historyPage(c,id,'m.sequence>?',[seq],limit)}))}
 if(action==='outcomes')return c.rows(`${outcomeSelect} WHERE o.conversation=? AND o.id>? ORDER BY o.id LIMIT 1000`,[id,input.after??''],id)
 await c.check(id);return fail(404,'Not found')
}
export async function search(c:Context,input:Record<string,any>,source='native'){return mixedSearch(c,input,source)}
async function attention(c:Context,input:Record<string,any>){
 const now=Date.now();
 const [settings,rows,wake]=await Promise.all([
 c.one('SELECT dnd_until FROM nook_settings WHERE user=?',[c.uid]),
 // Each authorized conversation contributes at most 100 candidates per state.
 // Old/done/private history cannot make a page scan an unbounded inbox.
 c.rows(`WITH candidates AS (
 SELECT j.value AS id FROM nook_members m JOIN json_each((SELECT json_group_array(id) FROM (SELECT a.id FROM nook_attention a WHERE a.user=m.user AND a.conversation=m.conversation AND a.state='open' AND a.id>? ORDER BY a.id LIMIT 100))) j WHERE m.user=? AND ${allowedGrant('m.user','m.conversation')}
 UNION ALL
 SELECT j.value AS id FROM nook_members m JOIN json_each((SELECT json_group_array(id) FROM (SELECT a.id FROM nook_attention a WHERE a.user=m.user AND a.conversation=m.conversation AND a.state='snoozed' AND a.id>? ORDER BY a.id LIMIT 100))) j WHERE m.user=? AND ${allowedGrant('m.user','m.conversation')}
 ) SELECT a.* FROM candidates p JOIN nook_attention a ON a.id=p.id ORDER BY a.id LIMIT 100`,[input.after??'',c.uid,input.after??'',c.uid]),
 c.one(`SELECT MIN(deadline) AS deadline FROM (SELECT (SELECT a.snooze_until FROM nook_attention a WHERE a.user=m.user AND a.conversation=m.conversation AND a.state='snoozed' AND a.snooze_until>? ORDER BY a.snooze_until LIMIT 1) AS deadline FROM nook_members m WHERE m.user=? AND ${allowedGrant('m.user','m.conversation')})`,[now,c.uid]),
 ])
 const dndUntil=settings?.dnd_until??null;let deferredCount=0;const items=[];
 const visible=rows.filter(a=>!(a.state==='snoozed'&&a.snooze_until>now||dndUntil>now&&a.reason!=='urgent-request'))
 deferredCount=rows.length-visible.length
 const messages=new Map<string,any>(),outcomes=new Map<string,any>()
 await Promise.all([...new Set<string>(visible.map(a=>a.conversation))].map(async conversation=>{
  const scoped=visible.filter(a=>a.conversation===conversation)
  const [messageRows,outcomeRows]=await Promise.all([
   c.rows(`SELECT m.id,m.body,m.deleted,m.parent,m.author,CASE WHEN m.retained_body=1 THEN 'Former member' ELSE o.name END AS authorName,m.payload FROM nook_message_history m JOIN nook_actor_history o ON o.id=m.author WHERE m.id IN (SELECT value FROM json_each(?))`,[JSON.stringify(scoped.flatMap(a=>a.message?[a.message]:[]))],conversation),
   c.rows(`${outcomeSelect} WHERE o.id IN (SELECT value FROM json_each(?))`,[JSON.stringify(scoped.flatMap(a=>a.outcome?[a.outcome]:[]))],conversation),
  ])
  for(const {payload,...m} of messageRows)messages.set(m.id,{...m,urgentReason:m.deleted?null:JSON.parse(payload).urgentReason??null})
  for(const o of outcomeRows)outcomes.set(o.id,o)
 }))
 for(const a of visible){if(a.outcome&&!outcomes.has(a.outcome))fail(404,'Outcome unavailable');items.push({...a,message:messages.get(a.message)??null,outcome:outcomes.get(a.outcome)??null})}

 const deadlines=[wake?.deadline,dndUntil].filter((value):value is number=>typeof value==='number'&&value>now);
 return {items,deferredCount,dndUntil,observedAt:now,nextWakeAt:deadlines.length?Math.min(...deadlines):null,cursor:rows.at(-1)?.id??input.after??'',hasMore:rows.length===100,deferredCountScope:'this page'}
}
