import {fail} from '../family/team-chat/domain'
import type {Context} from '../platform/storage/context'
import {content,exact,noteId,version,type NoteContent} from './input'
import {getNote,rootFence,rootValues,scope} from './read'

export function snapshot(c:Context,id:string,actor:string,now:string,reverted:number|null=null){
 return c.sql(`INSERT INTO nook_note_versions(note,version,actor,created,title,body,items_json,links_json,pinned,pinned_by,pinned_at,deleted,reverted_from) SELECT id,version,?,?,title,body,items_json,links_json,pinned,pinned_by,pinned_at,deleted,? FROM nook_notes WHERE id=?`,actor,now,reverted,id)
}
export async function createNote(c:Context,conversation:string,value:unknown){
 noteId(conversation);const input=exact(value,['title','body','items','links','pinned'],['thread'])
 const {thread:rawThread,...fields}=input,note=content(fields),thread=rawThread==null?null:noteId(rawThread)
 await scope(c,conversation,thread)
 const id=crypto.randomUUID(),now=new Date().toISOString()
 await c.writeBatch([...c.event(conversation,'note',id),c.sql(`INSERT INTO nook_notes(id,conversation,thread,author,created,updated,version,title,body,items_json,links_json,pinned,pinned_by,pinned_at) VALUES(?,?,?,?,?,?,1,?,?,?,?,?,?,?)`,id,conversation,thread,c.uid,now,now,note.title,note.body,JSON.stringify(note.items),JSON.stringify(note.links),Number(note.pinned),note.pinned?c.uid:null,note.pinned?now:null),snapshot(c,id,c.uid,now)],conversation,rootFence,rootValues(thread,conversation))
 await c.hint();return getNote(c,conversation,id)
}
async function save(c:Context,conversation:string,id:string,expected:number,note:NoteContent,reverted:number|null){
 const prior=await getNote(c,conversation,id)
 if(prior.deleted)fail(409,'Deleted notes cannot be revised')
 if(prior.version!==expected)fail(409,'Note changed; reload')
 const now=new Date().toISOString(),changed=prior.pinned!==note.pinned
 const by=note.pinned?(changed?c.uid:prior.pinnedBy):null,at=note.pinned?(changed?now:prior.pinnedAt):null
 await c.writeBatch([...c.event(conversation,'note',id),c.sql(`UPDATE nook_notes SET version=version+1,updated=?,title=?,body=?,items_json=?,links_json=?,pinned=?,pinned_by=?,pinned_at=? WHERE id=? AND conversation=?`,now,note.title,note.body,JSON.stringify(note.items),JSON.stringify(note.links),Number(note.pinned),by,at,id,conversation),snapshot(c,id,c.uid,now,reverted)],conversation,`EXISTS(SELECT 1 FROM nook_notes WHERE id=? AND conversation=? AND version=? AND deleted=0)`,[id,conversation,expected])
 await c.hint();return getNote(c,conversation,id)
}
/** Full replacement; checklist IDs remain stable across revisions. */
export async function reviseNote(c:Context,conversation:string,id:string,value:unknown){
 const input=exact(value,['version','title','body','items','links','pinned']),{version:expected,...fields}=input
 return save(c,conversation,id,version(expected),content(fields),null)
}
/** Revert copies content into a new version; pin attribution belongs to this action. */
export async function revertNote(c:Context,conversation:string,id:string,value:unknown){
 const input=exact(value,['version','restoreVersion']),expected=version(input.version),restore=version(input.restoreVersion)
 await getNote(c,conversation,id)
 const row=await c.one('SELECT * FROM nook_note_versions WHERE note=? AND version=? AND deleted=0',[id,restore],conversation)
 if(!row)fail(404,'Note version unavailable')
 return save(c,conversation,id,expected,content({title:row.title,body:row.body,items:JSON.parse(row.items_json),links:JSON.parse(row.links_json),pinned:!!row.pinned}),restore)
}
