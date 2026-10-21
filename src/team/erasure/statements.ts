import {eraseNoteRows} from '../../notes/erasure'
import {erasedIntent} from './intent.mjs'
import {graph} from './graph'
import type {Context} from '../../platform/storage/context'
import {fenceService,type Sql} from './portability'
export const sql=(sql:string,...params:any[]):Sql=>({sql,params})
export async function fencedRows(c:Context,f:Awaited<ReturnType<typeof fenceService>>,table:string,keys:string[],where:string,params:any[]){
 const rows=await c.rows(`SELECT ${keys.join(',')} FROM ${table} WHERE ${where}`,params)
 const result:Sql[]=[];for(const row of rows)result.push(...await f.row(table,row));return result
}
export function audit(scope:string,params:any[]){return [sql(`UPDATE nook_conversations SET seq=seq+1 WHERE id IN (${scope})`,...params),sql(`INSERT INTO nook_events SELECT id,seq,'erasure',lower(hex(randomblob(16))),NULL FROM nook_conversations WHERE id IN (${scope})`,...params)]}
export async function files(c:Context,f:Awaited<ReturnType<typeof fenceService>>,operation:string,where:string,params:any[]){
 const rows=await c.rows(`SELECT * FROM nook_attachments WHERE ${where}`,params),result:Sql[]=[]
 for(const row of rows){
  result.push(...await f.row('nook_attachments',{id:row.id}))
  if(row.object_key)result.push(sql('INSERT OR IGNORE INTO nook_erasure_blobs VALUES(?,?)',operation,row.object_key),sql('INSERT OR IGNORE INTO nook_object_deletes(object_key,created) VALUES(?,?)',row.object_key,Date.now()),sql("INSERT OR IGNORE INTO nook_erasure_blobs SELECT operation,? FROM nook_erasure_work WHERE (kind='attachment' AND target=?) OR (kind IN ('message','imported-message') AND target=?) OR (kind='imported-author' AND target IN (SELECT job||':'||source_actor FROM nook_import_records WHERE id=?))",row.object_key,row.id,row.message,row.message))
  result.push(sql('INSERT INTO nook_erased_attachments SELECT id,conversation,author,message,created,position,? FROM nook_attachments WHERE id=?',await erasedIntent(row.author,row.intent),row.id),sql('DELETE FROM nook_attachments WHERE id=?',row.id),sql("UPDATE nook_erasure_work SET phase='blobs' WHERE kind='attachment' AND target=?",row.id))
 }
 // Unbound uploads are private staging; only message bindings invalidate readers.
 const conversations=[...new Set(rows.filter(r=>r.message!==null).map(r=>r.conversation))]
 if(conversations.length)result.push(...audit('SELECT value FROM json_each(?)',[JSON.stringify(conversations)]))
 return result
}
export async function messages(c:Context,f:Awaited<ReturnType<typeof fenceService>>,operation:string,ids:string[],retain=false){
 if(!ids.length)return []
 const set=JSON.stringify(ids),where='message IN (SELECT value FROM json_each(?))',result:Sql[]=[]
 result.push(...await eraseNoteRows(c,f,'thread IN (SELECT value FROM json_each(?))',[set]))
 for(const row of await c.rows('SELECT id,author,intent,conversation FROM nook_messages WHERE id IN (SELECT value FROM json_each(?))',[set])){const id=row.id;result.push(...await f.row('nook_messages',{id}));result.push(sql('INSERT INTO nook_erased_messages SELECT id,conversation,author,parent,version+1,created,sequence,ordinal,author_ordinal,? FROM nook_messages WHERE id=?',await erasedIntent(row.author,row.intent,row.conversation),id))}
 if(retain)result.push(sql("INSERT INTO nook_retained_message_bodies SELECT id,body,body_lower FROM nook_messages WHERE deleted=0 AND id IN (SELECT value FROM json_each(?)) AND NOT EXISTS(SELECT 1 FROM nook_erasure_work w WHERE w.kind='message' AND w.target=nook_messages.id)",set))
 for(const {table,key:keys} of graph.message.edges){result.push(...await fencedRows(c,f,table,[...keys],where,[set]),sql(`DELETE FROM ${table} WHERE ${where}`,set))}
 result.push(...await files(c,f,operation,where,[set]),
  sql('UPDATE nook_outcomes SET source=NULL WHERE source IN (SELECT value FROM json_each(?))',set),
  sql("UPDATE nook_events SET kind='erasure',object=lower(hex(randomblob(16))),actor=NULL WHERE object IN (SELECT value FROM json_each(?))",set),
  sql('DELETE FROM nook_search WHERE message IN (SELECT value FROM json_each(?))',set),
  sql('DELETE FROM nook_messages WHERE id IN (SELECT value FROM json_each(?))',set),sql("UPDATE nook_erasure_work SET phase='blobs' WHERE kind='message' AND target IN (SELECT value FROM json_each(?))",set),
  ...(retain?[sql("INSERT INTO nook_search(message,conversation,source,scope,body_lower) SELECT b.id,m.conversation,'native','|'||m.conversation||'|',b.body_lower FROM nook_retained_message_bodies b JOIN nook_erased_messages m ON m.id=b.id WHERE b.id IN (SELECT value FROM json_each(?))",set)]:[]),
  sql("INSERT INTO nook_search(nook_search) VALUES('optimize')"),...audit('SELECT conversation FROM nook_erased_messages WHERE id IN (SELECT value FROM json_each(?))',[set]))
 return result
}
export async function outcomes(c:Context,f:Awaited<ReturnType<typeof fenceService>>,target:string){
 const result:Sql[]=[];const rows=await c.rows('SELECT id FROM nook_outcomes WHERE author=? LIMIT 30',[target]),ids=JSON.stringify(rows.map(r=>r.id))
 result.push(...await fencedRows(c,f,'nook_note_proposals',['outcome'],'outcome IN (SELECT value FROM json_each(?))',[ids]),sql('DELETE FROM nook_note_proposals WHERE outcome IN (SELECT value FROM json_each(?))',ids))
 result.push(...await fencedRows(c,f,'nook_outcomes',['id'],'id IN (SELECT value FROM json_each(?))',[ids]),...await fencedRows(c,f,'nook_outcome_versions',['outcome','version'],'outcome IN (SELECT value FROM json_each(?))',[ids]))
 for(const table of ['nook_push_delivery_records','nook_notify_queue','nook_attention'])result.push(...await fencedRows(c,f,table,['id'],'outcome IN (SELECT value FROM json_each(?))',[ids]),sql(`DELETE FROM ${table} WHERE outcome IN (SELECT value FROM json_each(?))`,ids))
 result.push(sql('DELETE FROM nook_erased_assignees WHERE outcome IN (SELECT value FROM json_each(?))',ids),sql('DELETE FROM nook_erased_outcome_actions WHERE outcome IN (SELECT value FROM json_each(?))',ids),sql('DELETE FROM nook_outcome_versions WHERE outcome IN (SELECT value FROM json_each(?))',ids),sql('INSERT INTO nook_erased_outcomes SELECT id,conversation,kind,version,status FROM nook_outcomes WHERE id IN (SELECT value FROM json_each(?))',ids),sql('DELETE FROM nook_outcomes WHERE id IN (SELECT value FROM json_each(?))',ids),sql("UPDATE nook_events SET kind='erasure',object=lower(hex(randomblob(16))),actor=NULL WHERE object IN (SELECT value FROM json_each(?))",ids),...audit('SELECT conversation FROM nook_erased_outcomes WHERE id IN (SELECT value FROM json_each(?))',[ids]))
 return result
}
