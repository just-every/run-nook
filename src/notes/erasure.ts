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
export async function deleteNote(c:Context,conversation:string,id:string,value:unknown){
 const input=exact(value,['version']),expected=version(input.version);await getNote(c,conversation,id)
 const f=await fenceService(c),statements=await eraseNoteRows(c,f,'id=? AND conversation=?',[id,conversation])
 await c.writeBatch(statements.map(s=>c.sql(s.sql,...s.params)),conversation,'EXISTS(SELECT 1 FROM nook_notes WHERE id=? AND conversation=? AND version=? AND deleted=0)',[id,conversation,expected])
 await c.hint();return {ok:true}
}
