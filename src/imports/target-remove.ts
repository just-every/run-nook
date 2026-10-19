import type { D1Sql } from './kit.ts';
import { sql } from './target-snapshot.ts';
import { importedAttachment, retainedChannelHistory } from './channel-guard.ts';
export function removeTarget(destination: string, kind: string, id: string): D1Sql[] {
            const result = [];
            // Private saves and shared pins store references without source FKs.
            // Undo may remove a source/channel while keeping those opaque rows:
            // saved projections then return unavailable, body-free tombstones.
            if (kind === 'message')
                result.push(sql('INSERT INTO nook_guard(id,ok) SELECT ?,CASE WHEN NOT EXISTS(SELECT 1 FROM nook_messages WHERE parent=?) AND NOT EXISTS(SELECT 1 FROM nook_import_records WHERE parent=?) AND NOT EXISTS(SELECT 1 FROM nook_outcomes WHERE source=?) AND NOT EXISTS(SELECT 1 FROM nook_thread_follows WHERE message=?) THEN 1 ELSE 0 END', 'undo:' + id, id, id, id, id), sql('INSERT OR IGNORE INTO nook_object_deletes(object_key,created) SELECT object_key,CAST(unixepoch(\'subsec\')*1000 AS INTEGER) FROM nook_attachments WHERE id IN (SELECT attachment FROM nook_import_files WHERE message=?)', id), sql('DELETE FROM nook_attachments WHERE id IN (SELECT attachment FROM nook_import_files WHERE message=?)', id), sql('DELETE FROM nook_import_files WHERE message=?', id), sql("DELETE FROM nook_search WHERE message=? AND source='imported'", id), sql('DELETE FROM nook_thread_unfollows WHERE message=?', id), sql('DELETE FROM nook_thread_reads WHERE message=?', id), sql('DELETE FROM nook_import_records WHERE id=?', id), sql('DELETE FROM nook_guard WHERE id=?', 'undo:' + id));
            else if (kind === 'actor')
                result.push(sql("DELETE FROM nook_import_actors WHERE job||':'||source_id=?", id));
            else if (kind === 'channel')
                result.push(sql(`INSERT INTO nook_guard(id,ok) SELECT ?,CASE WHEN NOT EXISTS(SELECT 1 FROM nook_import_records WHERE conversation=?) AND NOT EXISTS(SELECT 1 FROM nook_attachments WHERE conversation=?) AND NOT EXISTS(SELECT 1 FROM nook_conversations c WHERE c.id=? AND (${retainedChannelHistory('c.id')})) AND NOT EXISTS(SELECT 1 FROM nook_events WHERE conversation=? AND (kind<>'erasure' OR actor IS NOT NULL)) THEN 1 ELSE 0 END`, 'undo:' + id, id, id, id, id), sql("DELETE FROM nook_events WHERE conversation=? AND kind='erasure' AND actor IS NULL", id), sql(`DELETE FROM nook_erased_attachments WHERE conversation=? AND (${importedAttachment('nook_erased_attachments')})`, id), sql('DELETE FROM nook_erased_import_messages WHERE conversation=? AND NOT EXISTS(SELECT 1 FROM nook_retained_import_bodies b WHERE b.id=nook_erased_import_messages.id)', id), sql('DELETE FROM nook_reads WHERE conversation=?', id), sql('DELETE FROM nook_preferences WHERE conversation=?', id), sql('DELETE FROM nook_dm_roster WHERE conversation=?', id), sql('DELETE FROM nook_members WHERE conversation=?', id), sql('DELETE FROM nook_guest_grants WHERE conversation=?', id), sql('DELETE FROM nook_import_channels WHERE conversation=?', id), sql('DELETE FROM nook_conversations WHERE id=?', id), sql('DELETE FROM nook_guard WHERE id=?', 'undo:' + id));
            else
                throw new Error('IMPORT_TARGET_KIND');
            result.push(sql('DELETE FROM nook_import_effect_revisions WHERE destination=? AND kind=? AND id=?', destination, kind, id));
            return result;
        }
