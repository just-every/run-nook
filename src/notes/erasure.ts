import type {Context} from '../platform/storage/context'
import {fenceService,type Sql} from '../team/erasure/portability'
import {sql,audit,fencedRows} from '../team/erasure/statements'
import {getNote} from './read'
import {exact,version} from './input'
/** Redact all snapshots rather than leaving erased text in version history.
 * A checkpoint invalidates archives and staged copies predating this redaction. */
export async function eraseNoteRows(c:Context,f:Awaited<ReturnType<typeof fenceService>>,where:string,params:any[]):Promise<Sql[]>{
 const notes=await c.rows(`SELECT id,conversation FROM nook_notes WHERE deleted=0 AND (${where}) LIMIT 30`,params)
 if(!notes.length)return []
 const ids=JSON.stringify(notes.map(n=>n.id)),inSet='IN (SELECT value FROM json_each(?))'
 return [...await f.invalidate(),...await f.checkpoint(),...await fencedRows(c,f,'nook_note_proposals',['outcome'],`note ${inSet}`,[ids]),
 sql(`DELETE FROM nook_note_proposals WHERE note ${inSet}`,ids),
 sql(`UPDATE nook_note_versions SET title='',body='',items_json='[]',links_json='[]',pinned=0,pinned_by=NULL,pinned_at=NULL,deleted=1,actor=NULL WHERE note ${inSet}`,ids),
 sql(`UPDATE nook_notes SET title='',body='',items_json='[]',links_json='[]',pinned=0,pinned_by=NULL,pinned_at=NULL,deleted=1,author=NULL WHERE id ${inSet}`,ids),
 ...audit(`SELECT DISTINCT conversation FROM nook_notes WHERE id ${inSet}`,[ids])]
}
/** Member erasure clears a note only when that member wrote every version, or its
 * thread root is their erased message. Erasing a thread root clears its notes. */
export const memberClearedNotes=`(author=? AND NOT EXISTS(SELECT 1 FROM nook_note_versions v WHERE v.note=nook_notes.id AND v.actor IS NOT ?)) OR thread IN (SELECT id FROM nook_messages WHERE author=?)`
/** Shared notes keep content and every snapshot; the member's authorship,
 * revisions and pins become anonymous. A checkpoint refuses older attributed copies. */
export async function anonymizeMemberNotes(c:Context,f:Awaited<ReturnType<typeof fenceService>>,target:string):Promise<Sql[]>{
 const attributed='SELECT conversation FROM nook_notes WHERE author=? OR pinned_by=? OR id IN (SELECT note FROM nook_note_versions WHERE actor=? OR pinned_by=?)',params=[target,target,target,target]
 if(!await c.one(attributed+' LIMIT 1',params))return []
 return [...await f.checkpoint(),...audit(attributed,params),
 sql('UPDATE nook_note_versions SET actor=NULL WHERE actor=?',target),sql('UPDATE nook_note_versions SET pinned_by=NULL WHERE pinned_by=?',target),
 sql('UPDATE nook_notes SET author=NULL WHERE author=?',target),sql('UPDATE nook_notes SET pinned_by=NULL WHERE pinned_by=?',target)]
}
export async function deleteNote(c:Context,conversation:string,id:string,value:unknown){
 const input=exact(value,['version']),expected=version(input.version);await getNote(c,conversation,id)
 const f=await fenceService(c),statements=await eraseNoteRows(c,f,'id=? AND conversation=?',[id,conversation])
 await c.writeBatch(statements.map(s=>c.sql(s.sql,...s.params)),conversation,'EXISTS(SELECT 1 FROM nook_notes WHERE id=? AND conversation=? AND version=? AND deleted=0)',[id,conversation,expected])
 await c.hint();return {ok:true}
}
