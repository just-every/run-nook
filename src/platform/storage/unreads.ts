import {fail} from '../../family/team-chat/domain'
import {allowedGrant} from '../../team/access'
import {Context} from './context'
import {read} from './read'
import {historyPage} from './history'
import {threadSeen} from './threads'

export async function unreads(c:Context,input:Record<string,any>){
 const after=input.after??'',conversation=input.conversation
 if(typeof after!=='string'||after.length>256||conversation!==undefined&&typeof conversation!=='string')fail(400,'Invalid unread cursor')
 if(conversation){
  const seq=Number(after||0);if(!Number.isSafeInteger(seq)||seq<0)fail(400,'Invalid unread cursor')
  const rows=await historyPage(c,conversation,`m.sequence>? AND m.sequence>COALESCE((SELECT seq FROM nook_reads WHERE conversation=m.conversation AND user=?),0) AND m.author<>? AND m.deleted=0 AND NOT (${threadSeen('?')})`,[seq,c.uid,c.uid,c.uid],51)
  return {items:rows.slice(0,50),cursor:String(rows.slice(0,50).at(-1)?.sequence??seq),hasMore:rows.length>50}
 }
 // The same ordering as the sidebar. Explicit paging never calls a short page complete.
 const conversations=(await read(c,'conversations')).filter((r:any)=>r.unread>0&&r.id>after)
 const page=conversations.slice(0,20)
 const items=await Promise.all(page.map(async (conversation:any)=>({conversation,...await unreads(c,{conversation:conversation.id})})))
 return {items,cursor:page.at(-1)?.id??after,hasMore:conversations.length>20}
}

export async function markUnreads(c:Context,input:Record<string,any>){
 if(input.action==='undo')return undo(c,input.token)
 if(input.action!=='read'||input.conversation!==undefined&&typeof input.conversation!=='string')fail(400,'Choose read or undo')
 const conversations=(await read(c,'conversations')).filter((r:any)=>r.unread>0&&(!input.conversation||r.id===input.conversation))
 const ids=conversations.map((r:any)=>r.id),snapshot=await c.rows(`SELECT v.id AS conversation,v.seq AS frontier,r.seq,r.total,r.own,COALESCE(g.generation,0)+1 AS generation FROM nook_conversations v LEFT JOIN nook_reads r ON r.conversation=v.id AND r.user=? LEFT JOIN nook_read_generations g ON g.conversation=v.id AND g.user=? WHERE v.id IN (SELECT value FROM json_each(?))`,[c.uid,c.uid,JSON.stringify(ids)])
 const token=crypto.randomUUID(),expires=Date.now()+10000
 await c.batch([
  c.sql('DELETE FROM nook_read_undo WHERE user=? OR expires<?',c.uid,Date.now()),
  ...snapshot.map(r=>c.sql(`INSERT INTO nook_reads(conversation,user,seq,total,own) SELECT id,?,seq,message_count,COALESCE((SELECT total FROM nook_author_counts WHERE conversation=v.id AND user=?),0) FROM nook_conversations v WHERE id=? ON CONFLICT(conversation,user) DO UPDATE SET seq=excluded.seq,total=excluded.total,own=excluded.own`,c.uid,c.uid,r.conversation)),
  c.sql('INSERT INTO nook_read_undo VALUES(?,?,?,?)',token,c.uid,expires,JSON.stringify(snapshot)),
 ],undefined,`NOT EXISTS(SELECT 1 FROM json_each(?) j WHERE NOT EXISTS(SELECT 1 FROM nook_members m JOIN nook_conversations v ON v.id=m.conversation LEFT JOIN nook_read_generations g ON g.conversation=v.id AND g.user=m.user WHERE m.conversation=json_extract(j.value,'$.conversation') AND m.user=? AND ${allowedGrant('m.user','m.conversation')} AND v.seq=json_extract(j.value,'$.frontier') AND COALESCE(g.generation,0)+1=json_extract(j.value,'$.generation')))`,[JSON.stringify(snapshot),c.uid])
 await c.hint();return {token,expires,count:snapshot.length}
}
async function undo(c:Context,token:unknown){
 if(typeof token!=='string')fail(400,'Undo token required')
 const operation=await c.one('SELECT * FROM nook_read_undo WHERE id=? AND user=? AND expires>?',[token,c.uid,Date.now()])
 if(!operation)fail(409,'The ten-second undo window has ended')
 const snapshot=JSON.parse(operation.snapshot) as {conversation:string;seq:number|null;total:number|null;own:number|null;generation:number}[]
 // Each scope is restored only if it is still readable and no client has read
 // it since this action. New messages do not prevent undo or get marked read.
 const statements=snapshot.flatMap(r=>{
  const condition=`EXISTS(SELECT 1 FROM nook_members m WHERE m.conversation=? AND m.user=? AND ${allowedGrant('m.user','m.conversation')}) AND EXISTS(SELECT 1 FROM nook_read_generations WHERE conversation=? AND user=? AND generation=?)`
  const values=[r.conversation,c.uid,r.conversation,c.uid,r.generation]
  return [r.seq===null?c.sql(`DELETE FROM nook_reads WHERE conversation=? AND user=? AND ${condition}`,r.conversation,c.uid,...values):c.sql(`UPDATE nook_reads SET seq=?,total=?,own=? WHERE conversation=? AND user=? AND ${condition}`,r.seq,r.total,r.own,r.conversation,c.uid,...values)]
 })
 await c.batch([...statements,c.sql('DELETE FROM nook_read_undo WHERE id=?',token)],undefined,'EXISTS(SELECT 1 FROM nook_read_undo WHERE id=? AND user=? AND expires>?)',[token,c.uid,Date.now()])
 await c.hint();return {ok:true}
}
