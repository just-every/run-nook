import {Context} from '../platform/storage/context'
import {allowedGrant} from './access'
import {fail,text} from '../family/team-chat/domain'

// Move the durable history, retaining every object ID and its atomic sequence.
// The original fixed DM remains an immutable doorway, never a second copy.
const scopedTables=['nook_messages','nook_erased_messages','nook_attachments','nook_erased_attachments','nook_events','nook_outcomes','nook_erased_outcomes','nook_read_generations','nook_reads','nook_author_counts','nook_attention','nook_notify_queue','nook_push_delivery_records','nook_preferences','nook_conversation_notify','nook_saved_items','nook_schedules']
export async function convertGroup(c:Context,id:string,input:Record<string,any>){
 const name=text(input.name,80)
 if(!Number.isSafeInteger(input.version))fail(400,'Conversation version required')
 const source=await c.one('SELECT * FROM nook_conversations WHERE id=?',[id],id)
 const old=await c.one('SELECT destination FROM nook_group_conversions WHERE source=?',[id],id)
 if(old)return {id:old.destination,converted:true}
 if(source?.kind!=='dm'||!await c.one('SELECT 1 WHERE (SELECT COUNT(*) FROM nook_dm_roster WHERE conversation=?)>2',[id],id))fail(400,'Only a group DM can become a private channel')
 // The fixed source roster remains the complete historical audience. Copy
 // current grants only: conversion cannot reactivate a departed participant.
 const destination=crypto.randomUUID(),conversion=crypto.randomUUID(),created=new Date().toISOString()
 await c.batch([
  c.sql("INSERT INTO nook_conversations(id,name,kind,owner,seq,version,message_count) SELECT ?,?,'private',?,seq,1,message_count FROM nook_conversations WHERE id=?",destination,name,c.uid,id),
  c.sql(`INSERT INTO nook_members SELECT ?,user FROM nook_members m WHERE conversation=? AND ${allowedGrant('m.user','m.conversation')}`,destination,id),
  ...scopedTables.map(table=>c.sql(`UPDATE ${table} SET conversation=? WHERE conversation=?`,destination,id)),
  c.sql("UPDATE nook_search SET conversation=?,scope='|'||?||'|' WHERE conversation=?",destination,destination,id),
  c.sql('DELETE FROM nook_read_undo WHERE EXISTS(SELECT 1 FROM json_each(snapshot) WHERE json_extract(value,\'$.conversation\')=?)',id),
  c.sql("INSERT INTO nook_events(conversation,seq,kind,object,actor) SELECT ?,e.seq,CASE WHEN r.conversation IS NULL THEN 'conversion' ELSE 'access-revoked' END,CASE WHEN r.conversation IS NULL THEN ? ELSE r.user END,CASE WHEN r.conversation IS NULL THEN ? ELSE r.user END FROM nook_events e LEFT JOIN nook_creator_revocations r ON r.conversation=? AND r.event_seq=e.seq WHERE e.conversation=?",id,conversion,c.uid,id,destination),
  c.sql("UPDATE nook_events SET kind='conversion',object=?,actor=? WHERE conversation=? AND kind='access-revoked'",conversion,c.uid,destination),
  c.sql('UPDATE nook_conversations SET message_count=0,version=version+1 WHERE id=?',id),
  ...c.event(id,'conversion',conversion),...c.event(destination,'conversion',conversion),
  c.sql('INSERT INTO nook_group_conversions VALUES(?,?,?,?,?)',conversion,id,destination,c.uid,created),
 ],id,`EXISTS(SELECT 1 FROM nook_conversations WHERE id=? AND kind='dm' AND version=?) AND NOT EXISTS(SELECT 1 FROM nook_group_conversions WHERE source=?) AND EXISTS(SELECT 1 WHERE ${allowedGrant('?','?')})`,[id,input.version,id,c.uid,id])
 await c.hint();return {id:destination,name,kind:'private',owner:c.uid,seq:source.seq+1,version:1,readSeq:0,unread:0}
}
