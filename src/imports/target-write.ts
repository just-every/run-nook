import { importDigest } from '../family/team-chat/import-capture.mjs';
import type { D1Sql, TargetRow } from './kit.ts';
import { sql } from './target-snapshot.ts';
import { assertImportEffect } from './formats.mjs';

function channelWrites(v: any): D1Sql[] {
    const members=JSON.stringify(v.members), guests=JSON.stringify(v.guestMembers), guard='import-members:'+v.id;
    const result = [
        // A reviewed audience never revives an erased or deactivated identity.
        // Guest status must still agree with the explicitly reviewed guest set.
        sql(`INSERT INTO nook_guard(id,ok) SELECT ?,CASE WHEN
            NOT EXISTS(SELECT 1 FROM json_each(?) m WHERE NOT EXISTS(SELECT 1 FROM nook_erased_actors e WHERE e.id=m.value) AND NOT EXISTS(SELECT 1 FROM nook_access a JOIN oa_operators o ON o.id=a.user WHERE a.user=m.value AND a.active=1 AND o.status='active' AND (a.mode='guest')=EXISTS(SELECT 1 FROM json_each(?) g WHERE g.value=m.value)))
            AND NOT EXISTS(SELECT 1 FROM json_each(?) g WHERE NOT EXISTS(SELECT 1 FROM json_each(?) m WHERE m.value=g.value))
            THEN 1 ELSE 0 END`,guard,members,guests,guests,members),
        sql(`INSERT INTO nook_conversations(id,name,kind,owner,seq,version,message_count) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,kind=excluded.kind,owner=excluded.owner,seq=excluded.seq+CASE WHEN ? THEN 0 ELSE (SELECT COUNT(*) FROM nook_events e WHERE e.conversation=excluded.id AND e.kind='erasure' AND e.actor IS NULL) END,version=excluded.version,message_count=excluded.message_count`,v.id,v.name,v.kind,v.owner,v.seq,v.version,v.messageCount,v.retained?1:0),
        sql('INSERT INTO nook_import_channels(job,source_id,conversation,source_record) VALUES(?,?,?,?) ON CONFLICT(conversation) DO UPDATE SET job=excluded.job,source_id=excluded.source_id,source_record=excluded.source_record',v.job,v.sourceId,v.id,JSON.stringify(v.sourceRecord)),
        // Prune only removed members. Deleting and re-adding the owner would
        // manufacture a native access-revoked event during an inert catch-up.
        sql('DELETE FROM nook_members WHERE conversation=? AND (user NOT IN (SELECT value FROM json_each(?)) OR EXISTS(SELECT 1 FROM nook_erased_actors WHERE id=user))',v.id,members),
        sql('DELETE FROM nook_guest_grants WHERE conversation=? AND (user NOT IN (SELECT value FROM json_each(?)) OR EXISTS(SELECT 1 FROM nook_erased_actors WHERE id=user))',v.id,guests),
        sql('INSERT INTO nook_guest_grants(user,conversation) SELECT g.value,? FROM json_each(?) g WHERE NOT EXISTS(SELECT 1 FROM nook_erased_actors WHERE id=g.value) AND NOT EXISTS(SELECT 1 FROM nook_guest_grants present WHERE present.user=g.value AND present.conversation=?)',v.id,guests,v.id),
        sql('INSERT INTO nook_members(conversation,user) SELECT ?,m.value FROM json_each(?) m WHERE NOT EXISTS(SELECT 1 FROM nook_erased_actors WHERE id=m.value) AND NOT EXISTS(SELECT 1 FROM nook_members present WHERE present.user=m.value AND present.conversation=?)',v.id,members,v.id),
        sql('DELETE FROM nook_dm_roster WHERE conversation=? AND (?<>\'dm\' OR user NOT IN (SELECT value FROM json_each(?)))',v.id,v.kind,members)
    ];
    if(v.kind==='dm') result.push(sql('INSERT INTO nook_dm_roster(conversation,user) SELECT ?,m.value FROM json_each(?) m WHERE NOT EXISTS(SELECT 1 FROM nook_dm_roster present WHERE present.conversation=? AND present.user=m.value)',v.id,members,v.id));
    result.push(sql('DELETE FROM nook_guard WHERE id=?',guard));
    return result;
}

function messageWrites(v: any): D1Sql[] {
    const files=JSON.stringify(v.files),guard='undo:'+v.id;
    const result = [
        // The record table deliberately forbids UPDATE. Reinsert the same id;
        // no imported record FK cascades into native replies or references.
        sql('DELETE FROM nook_import_records WHERE id=?',v.id),
        sql('INSERT INTO nook_import_records(id,job,key,conversation,source_actor,source_timestamp,source_record,body,body_lower,parent,sequence) VALUES(?,?,?,?,?,?,?,?,?,?,?)',v.id,v.job,v.key,v.conversation,v.sourceActor,v.sourceTimestamp,JSON.stringify(v.sourceRecord),v.body,v.body.toLowerCase(),v.parent,v.sequence),
        sql("DELETE FROM nook_search WHERE message=? AND source='imported'",v.id),
        sql("INSERT INTO nook_search(message,conversation,source,scope,body_lower) VALUES(?,?,'imported',?,?)",v.id,v.conversation,'|'+v.conversation+'|',v.body.toLowerCase()),
        sql('INSERT INTO nook_guard(id,ok) VALUES(?,1)',guard),
        sql('DELETE FROM nook_attachments WHERE id IN (SELECT attachment FROM nook_import_files WHERE message=?)',v.id),
        sql('DELETE FROM nook_import_files WHERE message=?',v.id),
        // Replaced objects stay in original custody: a predecessor before-image
        // can still restore them on undo. Only final removal queues deletion.
        sql(`INSERT INTO nook_attachments(id,conversation,author,message,name,mime,size,sha256,expires,state,created,object_key,intent,position)
            SELECT json_extract(f.value,'$.id'),?,json_extract(f.value,'$.author'),?,json_extract(f.value,'$.name'),json_extract(f.value,'$.mime'),json_extract(f.value,'$.size'),json_extract(f.value,'$.sha256'),json_extract(f.value,'$.expires'),json_extract(f.value,'$.state'),json_extract(f.value,'$.created'),json_extract(f.value,'$.objectKey'),json_extract(f.value,'$.intent'),json_extract(f.value,'$.position') FROM json_each(?) f
            WHERE EXISTS(SELECT 1 FROM nook_import_objects o WHERE o.object_key=json_extract(f.value,'$.objectKey') AND o.sha256=json_extract(f.value,'$.sha256') AND o.size=json_extract(f.value,'$.size') AND o.mime=json_extract(f.value,'$.mime') AND o.state='ready')`,v.conversation,v.id,files),
        sql(`INSERT INTO nook_import_files(id,job,message,source_id,attachment,position) SELECT json_extract(value,'$.id'),?,?,json_extract(value,'$.sourceId'),json_extract(value,'$.id'),json_extract(value,'$.position') FROM json_each(?)`,v.job,v.id,files),
        sql('DELETE FROM nook_guard WHERE id=?',guard)
    ];
    if(v.sourceRecord.nookSource==='mattermost') {
        // These opaque references intentionally survive reversal as tombstones.
        for(const user of v.sourceRecord.mappedSavedUsers) result.push(sql("INSERT OR IGNORE INTO nook_saved_items(id,user,conversation,kind,target,created) SELECT ?,?,?,'message',?,? WHERE NOT EXISTS(SELECT 1 FROM nook_erased_actors WHERE id=?)",'mattermost-save-'+importDigest([v.id,user]).slice(0,40),user,v.conversation,v.id,new Date().toISOString(),user));
        if(v.sourceRecord.is_pinned) result.push(sql("INSERT OR IGNORE INTO nook_channel_pins(id,conversation,message,actor,created) SELECT ?,?,?,NULL,? WHERE EXISTS(SELECT 1 FROM nook_conversations WHERE id=? AND kind IN ('channel','private'))",'mattermost-pin-'+v.id.slice(11),v.conversation,v.id,new Date().toISOString(),v.conversation));
    }
    return result;
}

export function writeTarget(row: TargetRow): D1Sql[] {
    assertImportEffect(row.targetKind,row.value);
    const v=row.value as any;
    const result = row.targetKind==='channel'?channelWrites(v):row.targetKind==='message'?messageWrites(v):row.targetKind==='actor'?
        [sql('INSERT INTO nook_import_actors(job,source_id,association,source_record) VALUES(?,?,?,?) ON CONFLICT(job,source_id) DO UPDATE SET association=excluded.association,source_record=excluded.source_record',v.job,v.sourceId,v.association,JSON.stringify(v.sourceRecord))]:null;
    if(!result) throw new Error('IMPORT_TARGET_KIND');
    result.push(sql('INSERT INTO nook_import_effect_revisions(destination,kind,id,revision) VALUES(?,?,?,?) ON CONFLICT(destination,kind,id) DO UPDATE SET revision=excluded.revision',row.destination,row.targetKind,row.targetId,row.revision));
    return result;
}
