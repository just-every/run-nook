import {fail} from '../family/team-chat/domain'
import type {Context} from '../platform/storage/context'
import {createOutcome} from '../platform/storage/outcomes'
import {exact,noteId,version,type NoteItem} from './input'
import {getNote} from './read'

/** One proposal per item at an exact note version. No checkbox changes occur. */
export async function proposeNoteItem(c:Context,conversation:string,id:string,value:unknown){
 const input=exact(value,['version','item','assignee'],['deadline']),expected=version(input.version),itemId=noteId(input.item),assignee=noteId(input.assignee)
 const note=await getNote(c,conversation,id)
 if(note.deleted||note.version!==expected)fail(409,'Note changed; reload')
 const item=(note.items as NoteItem[]).find(item=>item.id===itemId)??fail(404,'Checklist item unavailable')
 // createOutcome owns outcome, attention and delivery writes. Inject the source
 // link and note CAS into its SAME writeBatch so neither half can commit alone.
 const writer:Context=Object.create(c)
 writer.writeBatch=async(statements,scope,condition='1',values=[])=>{
  if(scope!==conversation)fail(400,'Proposal conversation changed')
  const link=c.sql(`INSERT INTO nook_note_proposals(outcome,note,item,note_version,created) SELECT e.object,?,?,?,? FROM nook_events e JOIN nook_conversations cv ON cv.id=e.conversation AND cv.seq=e.seq WHERE e.conversation=? AND e.kind='outcome' AND e.actor=?`,id,itemId,expected,new Date().toISOString(),conversation,c.uid)
  await c.writeBatch([...statements,link],conversation,`(${condition}) AND EXISTS(SELECT 1 FROM nook_notes n,json_each(n.items_json) item WHERE n.id=? AND n.conversation=? AND n.version=? AND n.deleted=0 AND json_extract(item.value,'$.id')=? AND json_extract(item.value,'$.text')=?) AND NOT EXISTS(SELECT 1 FROM nook_note_proposals WHERE note=? AND item=? AND note_version=?)`,[...values,id,conversation,expected,itemId,item.text,id,itemId,expected])
 }
 return createOutcome(writer,conversation,{kind:'commitment',body:item.text,assignee,deadline:input.deadline??null,source:null})
}
