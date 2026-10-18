import {literal} from '../../broadcast/policy'
import {broadcastRecipient} from '../../broadcast/audience'
import {conversationThreads} from '../../team/conversation-notify.server'
import {allowedGrant} from '../../team/access'
import {fail} from '../../family/team-chat/domain'
import {publishedImport} from '../../imports/projection'
import {Context} from './context'

// Imported roots remain source records. Native participation only writes the
// member's choices and native reply, never the imported message or its history.
export const liveThreadRoots=`SELECT id,conversation,created FROM nook_messages WHERE parent IS NULL AND deleted=0
 UNION ALL SELECT r.id,r.conversation,strftime('%Y-%m-%dT%H:%M:%fZ',CAST(r.source_timestamp AS REAL),'unixepoch') AS created
 FROM nook_import_records r JOIN nook_imports j ON j.id=r.job WHERE r.parent IS NULL AND j.state='complete' AND ${publishedImport}`
const historicalThreadRoots=`SELECT id,conversation FROM nook_message_history WHERE parent IS NULL
 UNION ALL SELECT r.id,r.conversation FROM nook_import_history r JOIN nook_imports j ON j.id=r.job WHERE r.parent IS NULL AND j.state='complete' AND ${publishedImport}`

async function root(c:Context,id:string,live=true){
 const row=await c.one(`SELECT r.conversation FROM (${live?liveThreadRoots:historicalThreadRoots}) r WHERE r.id=? AND EXISTS(SELECT 1 FROM nook_members m WHERE m.conversation=r.conversation AND m.user=? AND ${allowedGrant('m.user','m.conversation')})`,[id,c.uid])
 if(!row)fail(404,'Thread root unavailable')
 await c.check(row.conversation)
 return row
}

// Run between the new message row and attention/push routing in the same batch.
// Explicit/authored choices retain their source; participation restores an unfollow,
// while mentions and DM defaults must respect a sticky unfollow.
export function automaticFollows(c:Pick<Context,'uid'|'sql'>,conversation:string,message:string,parent:string|null,mentions:string[]){
 const thread=parent??message,source=parent?'replied':'authored'
 return [
  c.sql('DELETE FROM nook_thread_unfollows WHERE user=? AND message=?',c.uid,thread),
  c.sql(`INSERT INTO nook_thread_follows(user,message,source) VALUES(?,?,?) ON CONFLICT(user,message) DO UPDATE SET source=excluded.source WHERE nook_thread_follows.source NOT IN ('explicit','authored')`,c.uid,thread,source),
  c.sql(`INSERT OR IGNORE INTO nook_thread_follows(user,message,source)
   SELECT m.user,?,'mentioned' FROM nook_members m
   WHERE (m.user IN (SELECT value FROM json_each(?)) OR ${broadcastRecipient(literal(message),'m.user')}) AND m.conversation=? AND m.user<>? AND ${allowedGrant('m.user','m.conversation')}
   AND NOT EXISTS(SELECT 1 FROM nook_thread_unfollows u WHERE u.user=m.user AND u.message=?)`,thread,JSON.stringify(mentions),conversation,c.uid,thread),
  c.sql(`INSERT OR IGNORE INTO nook_thread_follows(user,message,source)
   SELECT m.user,?,'dm' FROM nook_members m JOIN nook_conversations v ON v.id=m.conversation
   WHERE m.conversation=? AND v.kind='dm' AND (SELECT COUNT(*) FROM nook_dm_roster d WHERE d.conversation=v.id)=2
   AND ${allowedGrant('m.user','m.conversation')}
   AND NOT EXISTS(SELECT 1 FROM nook_thread_unfollows u WHERE u.user=m.user AND u.message=?)`,thread,conversation,thread),
 ]
}

export async function followThread(c:Context,id:string,input:Record<string,any>){
 if(typeof input.follow!=='boolean')fail(400,'Follow must be boolean')
 const r=await root(c,id)
 const statements=input.follow?[
  c.sql('DELETE FROM nook_thread_unfollows WHERE user=? AND message=?',c.uid,id),
  c.sql("INSERT INTO nook_thread_follows(user,message,source) VALUES(?,?,'explicit') ON CONFLICT(user,message) DO UPDATE SET source='explicit'",c.uid,id),
 ]:[
  c.sql('DELETE FROM nook_thread_follows WHERE user=? AND message=?',c.uid,id),
  c.sql('INSERT OR IGNORE INTO nook_thread_unfollows(user,message) VALUES(?,?)',c.uid,id),
 ]
 await c.batch(statements,r.conversation,`EXISTS(SELECT 1 FROM (${liveThreadRoots}) r WHERE r.id=? AND r.conversation=?)`,[id,r.conversation])
 await c.hint()
 return {followed:input.follow,...(input.follow?{source:'explicit'}:{})}
}

export async function threadPreferences(c:Context,conversation:string){
 return c.rows(`SELECT r.id AS message,COALESCE(f.source,'all') AS source FROM (${liveThreadRoots}) r LEFT JOIN nook_thread_follows f ON f.message=r.id AND f.user=? WHERE r.conversation=? AND (f.message IS NOT NULL OR ${conversationThreads('?','?')}='all' OR ${conversationThreads(literal(c.uid),literal(conversation),"'mobile'")}='all') AND NOT EXISTS(SELECT 1 FROM nook_thread_unfollows u WHERE u.user=? AND u.message=r.id) ORDER BY r.id`,[c.uid,conversation,c.uid,conversation,c.uid],conversation)
}

export const threadSeen=(user:string,message='m')=>`EXISTS(SELECT 1 FROM nook_thread_reads tr WHERE tr.user=${user} AND tr.message=COALESCE(${message}.parent,${message}.id) AND tr.seq>=${message}.sequence)`
// Conversation counters already cover everything through its frontier. Subtract
// only additional messages read within a thread, with roots/replies indexed
// separately so this does not scan a conversation's full history.
export const threadReadCount=(user:string,conversation:string,frontier:string)=>`COALESCE((SELECT SUM(
 (SELECT COUNT(*) FROM nook_message_history seen WHERE seen.conversation=${conversation} AND seen.parent=tr.message AND seen.sequence>${frontier} AND seen.sequence<=tr.seq AND seen.author<>${user})+
 (SELECT COUNT(*) FROM nook_message_history seen WHERE seen.conversation=${conversation} AND seen.id=tr.message AND seen.sequence>${frontier} AND seen.sequence<=tr.seq AND seen.author<>${user})
 ) FROM nook_thread_reads tr WHERE tr.user=${user}),0)`

export async function readThread(c:Context,id:string,input:Record<string,any>){
 if(!Number.isSafeInteger(input.seq)||input.seq<0)fail(400,'Invalid thread read frontier')
 const r=await root(c,id,false)
 const valid=`EXISTS(SELECT 1 FROM (${historicalThreadRoots}) r WHERE r.id=? AND r.conversation=?) AND (?=0 OR EXISTS(SELECT 1 FROM nook_message_history m WHERE m.conversation=? AND m.sequence=? AND (m.id=? OR m.parent=?)))`
 const values=[id,r.conversation,input.seq,r.conversation,input.seq,id,id]
 if(!await c.one(`SELECT 1 WHERE ${valid}`,values,r.conversation))fail(400,'Invalid thread read frontier')
 await c.batch([c.sql(`INSERT INTO nook_thread_reads(user,message,seq) VALUES(?,?,?) ON CONFLICT(user,message) DO UPDATE SET seq=max(nook_thread_reads.seq,excluded.seq)`,c.uid,id,input.seq)],r.conversation,valid,values)
 const state=await c.one(`SELECT max(COALESCE((SELECT seq FROM nook_reads WHERE user=? AND conversation=?),0),COALESCE((SELECT seq FROM nook_thread_reads WHERE user=? AND message=?),0)) AS readSeq`,[c.uid,r.conversation,c.uid,id],r.conversation)
 await c.hint()
 return {ok:true,thread:id,readSeq:state.readSeq}
}

// A thread viewport has its own barrier: unseen replies in other threads must
// neither block this read nor be marked read by it.
export async function threadWindowRead(c:Context,conversation:string,window:any){
 if(!window.root)return {}
 const id=window.root.id
 const state=await c.one(`SELECT max(COALESCE((SELECT seq FROM nook_reads WHERE user=? AND conversation=?),0),COALESCE((SELECT seq FROM nook_thread_reads WHERE user=? AND message=?),0)) AS seq`,[c.uid,conversation,c.uid,id],conversation)
 const visible=[...window.items,window.root].filter(m=>!m.immutable||m.retainedSource==='native')
 const barrier=await c.one(`SELECT MIN(sequence) AS seq FROM nook_message_history WHERE conversation=? AND parent=? AND author<>? AND deleted=0 AND sequence>? AND id NOT IN (SELECT value FROM json_each(?))`,[conversation,id,c.uid,state.seq,JSON.stringify(visible.map(m=>m.id))],conversation)
 const rendered=Math.max(0,...visible.map(m=>m.sequence)),through=barrier?.seq==null?rendered:Math.min(rendered,barrier.seq-1)
 // A barrier can end at another thread's event. Only return a sequence this
 // thread owns, as required by the read command's durable membership check.
 const marker=await c.one('SELECT MAX(sequence) AS seq FROM nook_message_history WHERE conversation=? AND (id=? OR parent=?) AND sequence<=?',[conversation,id,id,through],conversation)
 return {threadReadSeq:state.seq,threadReadThrough:marker?.seq??0}
}

type Cursor={unread:string;activity:string;id:string}
function decodeCursor(after:unknown):Cursor|null{
 if(after===undefined||after==='')return null
 const encoded=typeof after==='string'&&after.length<=2048?after:fail(400,'Invalid threads cursor')
 let value:any=null
 try{value=JSON.parse(atob(encoded))}catch{fail(400,'Invalid threads cursor')}
 if(!value||typeof value!=='object'||Object.keys(value).sort().join()!=='activity,id,unread'||typeof value.id!=='string'||!value.id||typeof value.activity!=='string'||!Number.isFinite(Date.parse(value.activity))||typeof value.unread!=='string'||value.unread!==''&&!Number.isFinite(Date.parse(value.unread)))fail(400,'Invalid threads cursor')
 return value as Cursor
}

export async function threads(c:Context,input:Record<string,any>,hydrate:(id:string)=>Promise<any>){
 const after=decodeCursor(input.after),limit=input.limit??50
 if(!Number.isSafeInteger(limit)||limit<1||limit>100)fail(400,'Invalid threads page')
 const rows=await c.rows(`WITH candidates AS MATERIALIZED (
  SELECT user,message,source FROM nook_thread_follows WHERE user=?
  UNION ALL
  SELECT n.user,r.id,'all' AS source FROM nook_conversation_notify n JOIN (${liveThreadRoots}) r ON r.conversation=n.conversation
  WHERE n.user=? AND (n.threads='all' OR n.mobile_threads='all') AND NOT EXISTS(SELECT 1 FROM nook_thread_follows f WHERE f.user=n.user AND f.message=r.id)
 ), followed AS MATERIALIZED (
  SELECT f.message,f.source,r.created,v.id AS conversation,v.name,v.kind,v.owner,v.seq,
   max(COALESCE(cr.seq,0),COALESCE(tr.seq,0)) AS readSeq
  FROM candidates f JOIN (${liveThreadRoots}) r ON r.id=f.message
  JOIN nook_conversations v ON v.id=r.conversation JOIN nook_members m ON m.conversation=v.id AND m.user=f.user
  LEFT JOIN nook_preferences p ON p.user=f.user AND p.conversation=v.id
  LEFT JOIN nook_reads cr ON cr.user=f.user AND cr.conversation=v.id
  LEFT JOIN nook_thread_reads tr ON tr.user=f.user AND tr.message=f.message
  WHERE ${allowedGrant('m.user','m.conversation')} AND NOT EXISTS(SELECT 1 FROM nook_thread_unfollows u WHERE u.user=f.user AND u.message=f.message) AND (COALESCE(p.muted,0)=0 OR f.source='explicit')
  AND NOT EXISTS(SELECT 1 FROM nook_import_channels ch JOIN nook_imports j ON j.id=ch.job WHERE ch.conversation=v.id AND (j.state<>'complete' OR NOT (${publishedImport})))
 ), summarized AS (
  SELECT f.*,
   (SELECT COUNT(*) FROM nook_message_history reply WHERE reply.conversation=f.conversation AND reply.parent=f.message AND reply.deleted=0 AND reply.author<>? AND reply.sequence>f.readSeq) AS unread,
   COALESCE((SELECT MAX(reply.created) FROM nook_message_history reply WHERE reply.conversation=f.conversation AND reply.parent=f.message AND reply.deleted=0 AND reply.author<>? AND reply.sequence>f.readSeq),'') AS newestUnread,
   max(COALESCE((SELECT MAX(reply.created) FROM nook_message_history reply WHERE reply.conversation=f.conversation AND reply.parent=f.message AND reply.deleted=0),''),COALESCE((SELECT MAX(strftime('%Y-%m-%dT%H:%M:%fZ',CAST(reply.source_timestamp AS REAL),'unixepoch')) FROM nook_import_history reply JOIN nook_imports j ON j.id=reply.job WHERE reply.conversation=f.conversation AND reply.parent=f.message AND (reply.erased=0 OR reply.retained_body=1) AND j.state='complete' AND ${publishedImport}),'')) AS latestReplyAt,
   COALESCE((SELECT MAX(sequence) FROM nook_message_history reply WHERE reply.conversation=f.conversation AND (reply.id=f.message OR reply.parent=f.message)),0) AS lastSequence
  FROM followed f
 ), ordered AS (SELECT *,max(created,latestReplyAt) AS activity FROM summarized)
 SELECT * FROM ordered ${after?'WHERE (newestUnread,activity,message)<(?,?,?)':''}
 ORDER BY newestUnread DESC,activity DESC,message DESC LIMIT ?`,[c.uid,c.uid,c.uid,c.uid,...(after?[after.unread,after.activity,after.id]:[]),limit+1])
 const hasMore=rows.length>limit,page=rows.slice(0,limit)
 const items=await Promise.all(page.map(async r=>({root:await hydrate(r.message),conversation:{id:r.conversation,name:r.name,kind:r.kind,owner:r.owner,seq:r.seq},source:r.source,unread:r.unread,latestReplyAt:r.latestReplyAt||null,lastSequence:r.lastSequence,readSeq:r.readSeq})))
 const last=page.at(-1),cursor=last?btoa(JSON.stringify({unread:last.newestUnread,activity:last.activity,id:last.message})):input.after??''
 return {items,cursor,hasMore}
}
