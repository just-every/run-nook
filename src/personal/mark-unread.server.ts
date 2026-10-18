import {fail} from '../family/team-chat/domain'
import type {Context} from '../platform/storage/context'
export async function markUnread(c:Context,id:string){
 const row=await c.one(`SELECT sequence FROM nook_messages WHERE conversation=? AND author<>? AND deleted=0 ORDER BY sequence DESC LIMIT 1`,[id,c.uid],id)
 if(!row)fail(409,'There is no received message to mark unread')
 const before=row.sequence-1
 // Explicit user action is separate from the ordinary monotonic read cursor.
 // Recompute ordinal totals and clear per-thread reads only beyond this point.
 await c.batch([
  c.sql(`INSERT INTO nook_reads(conversation,user,seq,total,own) SELECT ?,?,?,(SELECT count(*) FROM nook_message_history WHERE conversation=? AND sequence<=?),(SELECT count(*) FROM nook_message_history WHERE conversation=? AND author=? AND sequence<=?) ON CONFLICT(conversation,user) DO UPDATE SET seq=excluded.seq,total=excluded.total,own=excluded.own`,id,c.uid,before,id,before,id,c.uid,before),
  c.sql(`DELETE FROM nook_thread_reads WHERE user=? AND message IN (SELECT id FROM nook_message_history WHERE conversation=?)`,c.uid,id),
  c.sql('DELETE FROM nook_read_undo WHERE user=?',c.uid),
 ],id)
 await c.hint();return {ok:true,conversation:id,readSeq:before}
}
