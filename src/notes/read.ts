import {fail} from '../family/team-chat/domain'
import type {Context} from '../platform/storage/context'
import {publishedImport} from '../imports/projection'
import {exact,noteId,version} from './input'
export const noteColumns='id,conversation,thread,author,created,updated,version,title,body,items_json,links_json,pinned,pinned_by,pinned_at,deleted'
export function projectNote(row:Record<string,any>):Record<string,any>{
 const {items_json,links_json,pinned,pinned_by,pinned_at,...rest}=row
 return {...rest,items:JSON.parse(items_json),links:JSON.parse(links_json),pinned:!!pinned,pinnedBy:pinned_by,pinnedAt:pinned_at,deleted:!!row.deleted}
}
// Used again inside the write transaction; a preflight alone cannot bind scope.
export const rootFence=`(? IS NULL OR EXISTS(SELECT 1 FROM nook_messages WHERE id=? AND conversation=? AND parent IS NULL AND deleted=0) OR EXISTS(SELECT 1 FROM nook_import_records r JOIN nook_imports j ON j.id=r.job WHERE r.id=? AND r.conversation=? AND r.parent IS NULL AND j.state='complete' AND ${publishedImport}))`
export const rootValues=(thread:string|null,conversation:string)=>[thread,thread,conversation,thread,conversation]
export async function scope(c:Context,conversation:string,thread:string|null){
 if(!await c.one(`SELECT 1 FROM nook_conversations WHERE id=? AND ${rootFence}`,[conversation,...rootValues(thread,conversation)],conversation))fail(404,'Note scope unavailable')
}
export async function getNote(c:Context,conversation:string,id:string){
 noteId(conversation);noteId(id)
 const row=await c.one(`SELECT ${noteColumns} FROM nook_notes WHERE id=? AND conversation=?`,[id,conversation],conversation)
 if(!row)fail(404,'Note unavailable')
 return projectNote(row)
}
/** Omitted thread returns channel-level notes; pass a root ID for thread notes. */
export async function listNotes(c:Context,conversation:string,input:unknown={}){
 noteId(conversation);const query=exact(input,[],['thread','after'])
 const thread=query.thread==null?null:noteId(query.thread),after=query.after===undefined?'':noteId(query.after)
 await scope(c,conversation,thread)
 const rows=await c.rows(`SELECT ${noteColumns} FROM nook_notes WHERE conversation=? AND thread IS ? AND id>? AND deleted=0 ORDER BY id LIMIT 51`,[conversation,thread,after],conversation)
 return {items:rows.slice(0,50).map(projectNote),cursor:rows.length>50?rows[49].id:null}
}
export async function noteHistory(c:Context,conversation:string,id:string,input:unknown={}){
 const query=exact(input,[],['before']),before=query.before===undefined?Number.MAX_SAFE_INTEGER:version(query.before)
 await getNote(c,conversation,id)
 const rows=await c.rows(`SELECT v.*,a.name AS actorName FROM nook_note_versions v LEFT JOIN nook_actor_history a ON a.id=v.actor WHERE v.note=? AND v.version<? ORDER BY v.version DESC LIMIT 51`,[id,before],conversation)
 return {items:rows.slice(0,50).map(projectNote),cursor:rows.length>50?rows[49].version:null}
}
/** Links are opaque source bindings. Read current outcome state through its
 * existing ACL-checked doors; never derive agreement from a checklist value. */
export async function noteProposals(c:Context,conversation:string,id:string,input:unknown={}){
 const query=exact(input,[],['after']),after=query.after===undefined?'':noteId(query.after)
 await getNote(c,conversation,id)
 const rows=await c.rows('SELECT outcome,note,item,note_version AS noteVersion,created FROM nook_note_proposals WHERE note=? AND outcome>? ORDER BY outcome LIMIT 51',[id,after],conversation)
 return {items:rows.slice(0,50),cursor:rows.length>50?rows[49].outcome:null}
}
