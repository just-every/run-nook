import {broadcastSummary} from '../../broadcast/recipients'
import {literal} from '../../broadcast/policy'
import {countedMessage} from './thread-badge'
import {fail} from '../../family/team-chat/domain'
import {Context} from './context'
import {threadSeen} from './threads'
// Every projection uses one indexed page and at most five attachment rows per
// message. Public sequence is also the exclusive window cursor.
const projection=`m.id,m.conversation,m.author,EXISTS(SELECT 1 FROM nook_notification_apps app WHERE app.id=m.author) AS app,m.body,m.parent,m.version,m.deleted,m.created,m.intent,m.sequence,m.retained_body,CASE WHEN m.deleted=0 THEN ${broadcastSummary('m.id')} END AS broadcast_json,CASE WHEN m.retained_body=1 THEN 'Former member' ELSE o.name END AS authorName,(SELECT ia.name FROM nook_integration_audit ia WHERE ia.message=m.id AND ia.action='post') AS via,(SELECT json_group_array(json_object('id',a.id,'conversation',a.conversation,'author',a.author,'message',a.message,'name',a.name,'mime',a.mime,'size',a.size,'sha256',a.sha256,'expires',a.expires,'state',a.state,'created',a.created)) FROM (SELECT * FROM nook_attachment_history WHERE message=m.id ORDER BY position LIMIT 5) a) AS files`
export async function historyPage(c:Context,id:string,where:string,values:unknown[],limit:number,descending=false){
 const rows=await c.rows(`SELECT ${projection} FROM nook_message_history m JOIN nook_actor_history o ON o.id=m.author WHERE m.conversation=? AND ${where} ORDER BY m.sequence ${descending?'DESC':'ASC'} LIMIT ?`,[id,...values,limit],id)
 return rows.map(({files,broadcast_json,via,...m})=>({...m,...(via?{via}:{}),broadcast:broadcast_json?JSON.parse(broadcast_json):null,...(m.retained_body?{immutable:true,retainedSource:'native'}:{}),attachments:JSON.parse(files)}))
}
export async function firstUnreadMessage(c:Context,id:string,readSeq:number){
 return c.one(`SELECT m.id FROM nook_message_history m WHERE m.conversation=? AND m.sequence>? AND m.author<>? AND m.deleted=0 AND ${countedMessage(literal(c.uid))} AND NOT (${threadSeen('?')}) ORDER BY m.sequence LIMIT 1`,[id,readSeq,c.uid,c.uid],id)
}
export async function historyWindow(c:Context,id:string,input:Record<string,any>){
 const snapshot=await c.one('SELECT c.seq AS frontier,COALESCE(r.seq,0) AS readSeq FROM nook_conversations c LEFT JOIN nook_reads r ON r.conversation=c.id AND r.user=? WHERE c.id=?',[c.uid,id],id)
 const limit=input.limit??50,before=input.before?Number(input.before):null,thread=input.thread||null,around=input.around||null,firstUnread=input.firstUnread===true
 if(!Number.isSafeInteger(limit)||limit<1||limit>1000||before!==null&&(!Number.isSafeInteger(before)||before<1)||around&&before!==null||thread&&typeof thread!=='string'||around&&typeof around!=='string'||firstUnread&&(before!==null||thread||around))fail(400,'Invalid history window')
 // View thread and Back focus the root itself. A surviving reply keeps an
 // erased root addressable, without exposing erased reply targets or content.
 const unread=firstUnread?await firstUnreadMessage(c,id,snapshot.readSeq):null,targetId=around??unread?.id??null
 const target=targetId?await c.one('SELECT m.id,m.parent,m.sequence FROM nook_message_history m WHERE m.id=? AND m.conversation=? AND (m.deleted=0 OR (m.parent IS NULL AND EXISTS(SELECT 1 FROM nook_message_history r WHERE r.conversation=m.conversation AND r.parent=m.id AND r.deleted=0)))',[targetId,id],id):null
 if(targetId&&!target)fail(404,'Message unavailable')
 const effectiveThread=thread??target?.parent??null
 const rootId=effectiveThread??(target?.id||null)
 // Erased roots remain navigable tombstones for their surviving replies.
 const root=rootId?(await historyPage(c,id,'m.id=? AND m.parent IS NULL',[rootId],1))[0]:null
 if(rootId&&!root)fail(404,'Thread root unavailable')
 if(thread&&target&&target.id!==thread&&target.parent!==thread)fail(404,'Message unavailable in this thread')
 const filter=effectiveThread?'m.parent=?':'m.parent IS NULL',params=effectiveThread?[effectiveThread]:[]
 let items:any[]
 if(target&&(!effectiveThread||target.id!==effectiveThread)){
  const prior=await historyPage(c,id,filter+' AND m.sequence<?',[...params,target.sequence],Math.floor(limit/2),true)
  const after=await historyPage(c,id,filter+' AND m.sequence>=?',[...params,target.sequence],limit-prior.length)
  items=[...prior.reverse(),...after]
 }else items=(await historyPage(c,id,filter+(before===null?'':' AND m.sequence<?'),before===null?params:[...params,before],limit,true)).reverse()
 const cursor=items[0]?.sequence??before
 const visible=[...items.map(m=>m.id),...(root?[root.id]:[])]
 const [earlier,later,barrier]=await Promise.all([
  cursor===null||cursor===undefined?null:c.one(`SELECT m.id FROM nook_message_history m WHERE m.conversation=? AND ${filter} AND m.sequence<? ORDER BY m.sequence DESC LIMIT 1`,[id,...params,cursor],id),
  items.length?c.one(`SELECT m.id FROM nook_message_history m WHERE m.conversation=? AND ${filter} AND m.sequence>? ORDER BY m.sequence LIMIT 1`,[id,...params,items.at(-1).sequence],id):null,
  c.one(`SELECT MIN(sequence) AS sequence FROM (SELECT (SELECT m.sequence FROM nook_message_history m WHERE m.conversation=a.conversation AND m.author=a.user AND m.deleted=0 AND m.sequence>? AND NOT (${threadSeen('?')}) AND m.id NOT IN (SELECT value FROM json_each(?)) ORDER BY m.sequence LIMIT 1) AS sequence FROM nook_author_counts a WHERE a.conversation=? AND a.user<>?)`,[snapshot.readSeq,c.uid,JSON.stringify(visible),id,c.uid],id),
 ])
 const renderedThrough=Math.max(snapshot.readSeq,...items.map(m=>m.sequence),root?.sequence??0),readBarrierSeq=barrier?.sequence??null,readThrough=Math.max(snapshot.readSeq,Math.min(renderedThrough,readBarrierSeq===null?renderedThrough:readBarrierSeq-1))
 return {items,root:root??null,target:target?{id:target.id,parent:target.parent,root:rootId}:null,cursor:cursor==null?null:String(cursor),hasMore:!!earlier,hasNewer:!!later,frontier:snapshot.frontier,readSeq:snapshot.readSeq,readBarrierSeq,readThrough}
}
