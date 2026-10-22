import type {D1Sql} from '../imports/kit'
// Import undo is a reversible custody operation, not an erasure API call. Its
// removed sources still tombstone native forwards and queue their private bytes.
export function tombstoneForwardSql(source:string):D1Sql[]{
 const ids=`WITH RECURSIVE copies(id) AS (SELECT message FROM nook_forwards WHERE source=? UNION SELECT f.message FROM nook_forwards f JOIN copies c ON f.source=c.id) SELECT id FROM copies`
 const where=`IN (${ids})`,at="CAST(unixepoch('subsec')*1000 AS INTEGER)",statements:string[]=[
 `INSERT OR IGNORE INTO nook_object_deletes(object_key,created) SELECT object_key,${at} FROM nook_attachments WHERE message ${where} AND object_key IS NOT NULL`,
 `UPDATE nook_attachments SET state='deleted',object_key=NULL,name='',mime='application/octet-stream',size=0,sha256=NULL WHERE message ${where}`,
 `DELETE FROM nook_forward_files WHERE message ${where}`,
 `DELETE FROM nook_search WHERE message ${where}`,
 `DELETE FROM nook_attention WHERE message ${where}`,
 `DELETE FROM nook_notify_queue WHERE message ${where}`,
 `DELETE FROM nook_push_delivery_records WHERE message ${where}`,
 `DELETE FROM nook_thread_follows WHERE message ${where}`,
 `DELETE FROM nook_thread_unfollows WHERE message ${where}`,
 `DELETE FROM nook_thread_reads WHERE message ${where}`,
 `UPDATE nook_outcomes SET source=NULL WHERE source ${where}`,
 `UPDATE nook_revisions SET body='' WHERE message ${where}`,
 `INSERT INTO nook_revisions SELECT id,version+1,'',strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM nook_messages WHERE id ${where} AND deleted=0`,
 `UPDATE nook_messages SET body='',body_lower='',payload='[erased]',version=version+1,deleted=1 WHERE id ${where} AND deleted=0`,
 `DELETE FROM nook_forwards WHERE message ${where}`,
 ];return statements.map(sql=>({sql,params:[source]}))
}
