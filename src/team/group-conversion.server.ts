import {Context} from '../platform/storage/context'
import {fullMember} from './access'
import {fail,text} from '../family/team-chat/domain'

// Move the durable history, retaining every object ID and its atomic sequence.
// The original fixed DM remains an immutable doorway, never a second copy.
const scopedTables=['nook_messages','nook_erased_messages','nook_attachments','nook_erased_attachments','nook_events','nook_outcomes','nook_erased_outcomes','nook_read_generations','nook_reads','nook_author_counts','nook_attention','nook_notify_queue','nook_preferences','nook_conversation_notify','nook_saved_items','nook_creator_revocations','nook_schedules']
export async function convertGroup(c:Context,id:string,input:Record<string,any>){
 const name=text(input.name,80)
 if(!Number.isSafeInteger(input.version))fail(400,'Conversation version required')
 const source=await c.one('SELECT * FROM nook_conversations WHERE id=?',[id],id)
 const old=await c.one('SELECT destination FROM nook_group_conversions WHERE source=?',[id],id)
 if(old)return {id:old.destination,converted:true}
 if(source?.kind!=='dm'||!await c.one('SELECT 1 WHERE (SELECT COUNT(*) FROM nook_dm_roster WHERE conversation=?)>2',[id],id))fail(400,'Only a group DM can become a private channel')
 // A deactivated participant's old audience cannot silently become a new grant.
 // Their re-admission must be resolved explicitly before conversion.
 const eligible=`NOT EXISTS(SELECT 1 FROM nook_dm_roster r LEFT JOIN nook_members m ON m.conversation=r.conversation AND m.user=r.user WHERE r.conversation=? AND (m.user IS NULL OR NOT (${fullMember('r.user')})))`
 if(!await c.one(`SELECT 1 WHERE ${eligible}`,[id],id))fail(409,'Restore access for every original participant before converting this group DM')
 const destination=crypto.randomUUID(),conversion=crypto.randomUUID(),created=new Date().toISOString()
 await c.batch([
  c.sql("INSERT INTO nook_conversations(id,name,kind,owner,seq,version,message_count) SELECT ?,?,'private',owner,seq,1,message_count FROM nook_conversations WHERE id=?",destination,name,id),
  c.sql('INSERT INTO nook_members SELECT ?,user FROM nook_members WHERE conversation=?',destination,id),
  ...scopedTables.map(table=>c.sql(`UPDATE ${table} SET conversation=? WHERE conversation=?`,destination,id)),
  c.sql("UPDATE nook_search SET conversation=?,scope='|'||?||'|' WHERE conversation=?",destination,destination,id),
  c.sql('DELETE FROM nook_read_undo WHERE EXISTS(SELECT 1 FROM json_each(snapshot) WHERE json_extract(value,\'$.conversation\')=?)',id),
  c.sql("INSERT INTO nook_events(conversation,seq,kind,object,actor) SELECT ?,seq,'conversion',?,? FROM nook_events WHERE conversation=?",id,conversion,c.uid,destination),
  c.sql('UPDATE nook_conversations SET message_count=0,version=version+1 WHERE id=?',id),
  ...c.event(id,'conversion',conversion),...c.event(destination,'conversion',conversion),
  c.sql('INSERT INTO nook_group_conversions VALUES(?,?,?,?,?)',conversion,id,destination,c.uid,created),
 ],id,`EXISTS(SELECT 1 FROM nook_conversations WHERE id=? AND kind='dm' AND version=?) AND NOT EXISTS(SELECT 1 FROM nook_group_conversions WHERE source=?) AND ${eligible}`,[id,input.version,id,id])
 await c.hint();return {id:destination,name,kind:'private',owner:source.owner,seq:source.seq+1,version:1,readSeq:0,unread:0}
}
