import type { D1TargetAdapter, TargetRow } from './kit.ts';
import { readTarget, targetMatches, targetMatchParts, sql } from './target-snapshot.ts';
import { assertSlackEffect } from './policy.mjs';
export function importTargets(): D1TargetAdapter {
    return {
        read: readTarget, matches: targetMatches, matchesParts: targetMatchParts,
        async list(db, destination) { const rows = (await db.prepare('SELECT kind,id FROM nook_import_effect_revisions WHERE destination=? ORDER BY kind,id').bind(destination).all<{
            kind: string;
            id: string;
        }>()).results; const result: TargetRow[] = []; for (const row of rows) {
            const value = await readTarget(db, destination, row.kind, row.id);
            if (value)
                result.push(value);
        } return result; },
        matchesCount: (count, destination) => sql('(SELECT COUNT(*) FROM nook_import_effect_revisions WHERE destination=?)=?', destination, count),
        write(row) {
            assertSlackEffect(row.targetKind, row.value);
            const v = row.value as any, result = [];
            if (row.targetKind === 'channel')
                result.push(sql('INSERT INTO nook_conversations(id,name,kind,owner,seq,version,message_count) VALUES(?,?,?,?,?,?,?)', v.id, v.name, v.kind, v.owner, v.seq, v.version, v.messageCount), sql('INSERT INTO nook_guest_grants(user,conversation) SELECT value,? FROM json_each(?)', v.id, JSON.stringify(v.guestMembers)), sql('INSERT INTO nook_members(conversation,user) SELECT ?,value FROM json_each(?)', v.id, JSON.stringify(v.members)), sql('INSERT INTO nook_import_channels(job,source_id,conversation,source_record) VALUES(?,?,?,?)', v.job, v.sourceId, v.id, JSON.stringify(v.sourceRecord)));
            else if (row.targetKind === 'actor')
                result.push(sql('INSERT INTO nook_import_actors(job,source_id,association,source_record) VALUES(?,?,?,?)', v.job, v.sourceId, v.association, JSON.stringify(v.sourceRecord)));
            else if (row.targetKind === 'message') {
                result.push(sql('INSERT INTO nook_import_records(id,job,key,conversation,source_actor,source_timestamp,source_record,body,body_lower,parent,sequence) VALUES(?,?,?,?,?,?,?,?,?,?,?)', v.id, v.job, v.key, v.conversation, v.sourceActor, v.sourceTimestamp, JSON.stringify(v.sourceRecord), v.body, v.body.toLowerCase(), v.parent, v.sequence), sql("INSERT INTO nook_search(message,conversation,source,scope,body_lower) VALUES(?,?,'imported',?,?)", v.id, v.conversation, '|' + v.conversation + '|', v.body.toLowerCase()));
                for (const f of v.files)
                    result.push(sql("INSERT INTO nook_attachments(id,conversation,author,message,name,mime,size,sha256,expires,state,created,object_key,intent,position) SELECT ?,?,?, ?,?,?,?,?,0,'attached',?,?,?,? WHERE EXISTS(SELECT 1 FROM nook_import_objects WHERE object_key=? AND sha256=? AND size=? AND mime=? AND state='ready')", f.id, v.conversation, f.author, v.id, f.name, f.mime, f.size, f.sha256, f.created, f.objectKey, f.intent, f.position, f.objectKey, f.sha256, f.size, f.mime), sql('INSERT INTO nook_import_files(id,job,message,source_id,attachment,position) VALUES(?,?,?,?,?,?)', f.id, v.job, v.id, f.sourceId, f.id, f.position));
            }
            else
                throw new Error('IMPORT_TARGET_KIND');
            result.push(sql('INSERT INTO nook_import_effect_revisions(destination,kind,id,revision) VALUES(?,?,?,?)', row.destination, row.targetKind, row.targetId, row.revision));
            return result;
        },
        remove(destination, kind, id) {
            const result = [];
            if (kind === 'message')
                result.push(sql('INSERT INTO nook_guard(id,ok) SELECT ?,CASE WHEN NOT EXISTS(SELECT 1 FROM nook_messages WHERE parent=?) AND NOT EXISTS(SELECT 1 FROM nook_outcomes WHERE source=?) AND NOT EXISTS(SELECT 1 FROM nook_thread_follows WHERE message=?) THEN 1 ELSE 0 END', 'undo:' + id, id, id, id), sql('INSERT OR IGNORE INTO nook_object_deletes(object_key,created) SELECT object_key,CAST(unixepoch(\'subsec\')*1000 AS INTEGER) FROM nook_attachments WHERE id IN (SELECT attachment FROM nook_import_files WHERE message=?)', id), sql('DELETE FROM nook_attachments WHERE id IN (SELECT attachment FROM nook_import_files WHERE message=?)', id), sql('DELETE FROM nook_import_files WHERE message=?', id), sql("DELETE FROM nook_search WHERE message=? AND source='imported'", id), sql('DELETE FROM nook_import_records WHERE id=?', id), sql('DELETE FROM nook_guard WHERE id=?', 'undo:' + id));
            else if (kind === 'actor')
                result.push(sql("DELETE FROM nook_import_actors WHERE job=? AND source_id=?", ...id.split(':')));
            else if (kind === 'channel')
                result.push(sql('INSERT INTO nook_guard(id,ok) SELECT ?,CASE WHEN NOT EXISTS(SELECT 1 FROM nook_messages WHERE conversation=?) AND NOT EXISTS(SELECT 1 FROM nook_import_records WHERE conversation=?) AND NOT EXISTS(SELECT 1 FROM nook_outcomes WHERE conversation=?) AND NOT EXISTS(SELECT 1 FROM nook_attachments WHERE conversation=?) AND NOT EXISTS(SELECT 1 FROM nook_events WHERE conversation=?) THEN 1 ELSE 0 END', 'undo:' + id, id, id, id, id, id), sql('DELETE FROM nook_reads WHERE conversation=?', id), sql('DELETE FROM nook_preferences WHERE conversation=?', id), sql('DELETE FROM nook_members WHERE conversation=?', id), sql('DELETE FROM nook_guest_grants WHERE conversation=?', id), sql('DELETE FROM nook_import_channels WHERE conversation=?', id), sql('DELETE FROM nook_conversations WHERE id=?', id), sql('DELETE FROM nook_guard WHERE id=?', 'undo:' + id));
            else
                throw new Error('IMPORT_TARGET_KIND');
            result.push(sql('DELETE FROM nook_import_effect_revisions WHERE destination=? AND kind=? AND id=?', destination, kind, id));
            return result;
        }
    };
}
