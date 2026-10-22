import type {Context} from '../platform/storage/context'
import {fail,text} from '../family/team-chat/domain'
import {fullMember} from '../team/access'
import {message,outcomeSelect} from '../platform/storage/read'
import {publishedImport} from '../imports/projection'
import {searchFileText} from '../search/files'
export type Range={conversation:string;thread:string|null;from:string;through:string;unreadAfter:number|null}
export type Passage={id:string;message:string;conversation:string;parent:string|null;text:string;author:string;at:string;kind:string;name:string;edited:boolean;stale:boolean}
export async function authorize(c:Context,conversation:string){
 if(!await c.one(`SELECT 1 FROM nook_conversations v WHERE v.id=? AND ${fullMember('?')} AND NOT EXISTS(SELECT 1 FROM nook_notification_sharing s WHERE s.conversation=v.id AND s.state<>'local')`,[conversation,c.uid]))fail(404,'Recap unavailable')
 try{await c.check(conversation)}catch{fail(404,'Recap unavailable')}
}
export async function rangeInput(c:Context,input:Record<string,unknown>):Promise<Range>{
 if(Object.keys(input).some(k=>!['conversation','thread','from','through','unread'].includes(k)))fail(400,'Unsupported recap range')
 const conversation=text(input.conversation,128),thread=input.thread?text(input.thread,128):null
 await authorize(c,conversation)
 const date=(value:unknown,fallback:string)=>{if(value===undefined||value==='')return fallback;if(typeof value!=='string'||!Number.isFinite(Date.parse(value)))fail(400,'Choose a valid range');return new Date(value as string).toISOString()}
 const from=date(input.from,'1970-01-01T00:00:00.000Z'),through=date(input.through,new Date().toISOString());if(from>through)fail(400,'Range end precedes its start')
 if(thread){const root=await message(c,thread);if(root.conversation!==conversation||root.parent||root.deleted)fail(404,'Recap unavailable')}
 if(input.unread!==undefined&&typeof input.unread!=='boolean')fail(400,'Invalid unread range')
 const unreadAfter=input.unread?(await c.one<{seq:number}>('SELECT seq FROM nook_reads WHERE conversation=? AND user=?',[conversation,c.uid],conversation))?.seq??0:null
 return {conversation,thread,from,through,unreadAfter}
}
export async function retrieve(c:Context,range:Range){
 await authorize(c,range.conversation)
 // The candidate query is scoped by the same current membership and imported
 // publication fence as message(). Every selected source is then read there.
 const rows=await c.rows<{id:string;created:string;version:number}>(`SELECT * FROM (
 SELECT id,created,version,sequence,parent FROM nook_message_history WHERE conversation=? AND deleted=0
 UNION ALL SELECT r.id,strftime('%Y-%m-%dT%H:%M:%fZ',CAST(r.source_timestamp AS REAL),'unixepoch'),CASE WHEN json_extract(r.source_record,'$.edited') IS NOT NULL THEN 2 ELSE 1 END,-1,r.parent FROM nook_import_history r JOIN nook_imports j ON j.id=r.job WHERE r.conversation=? AND r.erased=0 AND j.state='complete' AND ${publishedImport}
 ) WHERE created>=? AND created<=? AND (? IS NULL OR id=? OR parent=?) AND (? IS NULL OR sequence>?) ORDER BY created,id LIMIT 101`,[range.conversation,range.conversation,range.from,range.through,range.thread,range.thread,range.thread,range.unreadAfter,range.unreadAfter],range.conversation)
 const candidates=rows.slice(0,100),passages:Passage[]=[],omissions:{name:string;status:string}[]=[];let bytes=0,omitted=rows.length>100?1:0
 const files=await searchFileText(c,candidates.slice(0,8).map(r=>r.id))
 for(const row of candidates){
  if(passages.length>=8){omitted++;continue}
  const m=await message(c,row.id);if(m.deleted)continue
  const later=await c.one(`SELECT 1 FROM (SELECT created,parent,id FROM nook_message_history WHERE conversation=? AND deleted=0 UNION ALL SELECT strftime('%Y-%m-%dT%H:%M:%fZ',CAST(r.source_timestamp AS REAL),'unixepoch'),r.parent,r.id FROM nook_import_history r JOIN nook_imports j ON j.id=r.job WHERE r.conversation=? AND r.erased=0 AND j.state='complete' AND ${publishedImport}) WHERE (id=? OR parent=?) AND created>? LIMIT 1`,[range.conversation,range.conversation,m.parent??m.id,m.parent??m.id,m.created],range.conversation)
  const values=[{id:'message:'+m.id,text:[m.body,m.forward?.body].filter(Boolean).join('\n\n'),kind:'message',name:'Message'},...(files.get(m.id)??[]).flatMap(f=>{if(f.status!=='indexed'){omissions.push({name:f.name,status:f.status});return []}return [{id:'file:'+f.attachment,text:f.text,kind:'file',name:f.name}]})]
  for(const value of values){const size=new TextEncoder().encode(value.text).length;if(!value.text.trim())continue;if(passages.length===8||bytes+size>32768){omitted++;continue}bytes+=size;passages.push({...value,message:m.id,conversation:m.conversation,parent:m.parent,author:m.authorName??'Former member',at:m.created,edited:row.version>1,stale:row.version>1||!!later})}
 }
 const outcomes=await c.rows(`${outcomeSelect} WHERE o.conversation=? AND o.erased=0 AND (o.source IN (SELECT value FROM json_each(?))) ORDER BY o.id LIMIT 101`,[range.conversation,JSON.stringify(passages.map(p=>p.message))],range.conversation)
 await authorize(c,range.conversation)
 return {passages,omissions,omitted,more:rows.length>100,bytes,outcomes:outcomes.slice(0,100).map(o=>({id:o.id,source:o.source,body:o.body,kind:o.kind,status:o.status,label:o.kind==='decision'?'Recorded decision':o.status==='accepted'?'Accepted obligation':o.status==='reported-complete'?'Completion report (not verified)':o.status==='proposed'?'Proposal':o.status}))}
}
