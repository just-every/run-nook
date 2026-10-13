import { missingFileRefs } from './slack-records.mjs';
import type { D1Database, D1Sql, TargetRow } from './kit.ts';
export const sql = (sql: string, ...params: any[]): D1Sql => ({ sql, params });
export async function readTarget(db: D1Database, destination: string, kind: string, id: string): Promise<TargetRow | undefined> {
    const rev = await db.prepare('SELECT revision FROM nook_import_effect_revisions WHERE destination=? AND kind=? AND id=?').bind(destination, kind, id).first<{
        revision: string;
    }>();
    if (!rev)
        return undefined;
    let value: any;
    if (kind === 'channel') {
        const row = await db.prepare('SELECT c.*,i.job,i.source_id,i.source_record FROM nook_conversations c JOIN nook_import_channels i ON i.conversation=c.id WHERE c.id=?').bind(id).first<any>();
        if (!row)
            throw new Error('IMPORT_NATIVE_MISSING');
        const members = (await db.prepare('SELECT user FROM nook_members WHERE conversation=? ORDER BY user').bind(id).all<{
            user: string;
        }>()).results.map(x => x.user);
        const guestMembers = (await db.prepare('SELECT user FROM nook_guest_grants WHERE conversation=? ORDER BY user').bind(id).all<{
            user: string;
        }>()).results.map(x => x.user);
        value = { id: row.id, job: row.job, owner: row.owner, name: row.name, sourceId: row.source_id, sourceRecord: JSON.parse(row.source_record), members, guestMembers, seq: row.seq, version: row.version, messageCount: row.message_count, kind: row.kind };
    }
    else if (kind === 'actor') {
        const row = await db.prepare('SELECT * FROM nook_import_actors WHERE job=? AND source_id=?').bind(...id.split(':')).first<any>();
        if (!row)
            throw new Error('IMPORT_NATIVE_MISSING');
        value = { job: row.job, sourceId: row.source_id, association: row.association, sourceRecord: JSON.parse(row.source_record) };
    }
    else if (kind === 'message') {
        const r = await db.prepare('SELECT r.*,j.owner FROM nook_import_records r JOIN nook_imports j ON j.id=r.job WHERE r.id=?').bind(id).first<any>();
        if (!r)
            throw new Error('IMPORT_NATIVE_MISSING');
        const files = (await db.prepare('SELECT f.id,f.source_id,a.name,a.mime,a.size,a.sha256,f.position,a.object_key,a.state,a.author,a.expires,a.created,a.intent,a.message AS attachment_message,a.conversation AS attachment_conversation,a.position AS attachment_position,f.attachment FROM nook_import_files f JOIN nook_attachments a ON a.id=f.attachment WHERE f.message=? ORDER BY f.position').bind(id).all<any>()).results;
        value = { id: r.id, job: r.job, owner: r.owner, conversation: r.conversation, key: r.key, sourceActor: r.source_actor, sourceTimestamp: r.source_timestamp, sourceRecord: JSON.parse(r.source_record), body: r.body, parent: r.parent, sequence: r.sequence, files: files.map(f => ({ id: f.id, sourceId: f.source_id, name: f.name, mime: f.mime, size: f.size, sha256: f.sha256, position: f.position, objectKey: f.object_key, state: f.state, author: f.author, expires: f.expires, created: f.created, intent: f.intent })) };
        const missing = missingFileRefs(value.sourceRecord, value.files);
        if (missing.length) value.missingFiles = missing;
    }
    else
        throw new Error('IMPORT_TARGET_KIND');
    return { destination, targetKind: kind, targetId: id, revision: rev.revision, value };
}
function conjunct(parts: D1Sql[]): D1Sql { return sql(parts.map(p => `(${p.sql})`).join(' AND '), ...parts.flatMap(p => p.params ?? [])); }
export function targetMatches(row: TargetRow | null, destination: string, kind: string, id: string): D1Sql { return conjunct(targetMatchParts(row, destination, kind, id)); }
export function targetMatchParts(row: TargetRow | null, destination: string, kind: string, id: string): D1Sql[] {
    const parts = [row ? sql('EXISTS(SELECT 1 FROM nook_import_effect_revisions WHERE destination=? AND kind=? AND id=? AND revision=?)', destination, kind, id, row.revision) : sql('NOT EXISTS(SELECT 1 FROM nook_import_effect_revisions WHERE destination=? AND kind=? AND id=?)', destination, kind, id)];
    const v = row?.value as any;
    if (kind === 'channel') {
        if (!v)
            parts.push(sql('NOT EXISTS(SELECT 1 FROM nook_conversations WHERE id=?) AND NOT EXISTS(SELECT 1 FROM nook_import_channels WHERE conversation=?)', id, id));
        else {
            parts.push(sql('EXISTS(SELECT 1 FROM nook_conversations c JOIN nook_import_channels i ON i.conversation=c.id WHERE c.id=? AND c.name=? AND c.kind=? AND c.owner=? AND c.seq=? AND c.version=? AND c.message_count=? AND i.job=? AND i.source_id=? AND i.source_record=?)', id, v.name, v.kind, v.owner, v.seq, v.version, v.messageCount, v.job, v.sourceId, JSON.stringify(v.sourceRecord)), sql('(SELECT COUNT(*) FROM nook_members WHERE conversation=?)=? AND NOT EXISTS(SELECT 1 FROM nook_members WHERE conversation=? AND user NOT IN (SELECT value FROM json_each(?)))', id, v.members.length, id, JSON.stringify(v.members)), sql('(SELECT COUNT(*) FROM nook_guest_grants WHERE conversation=?)=? AND NOT EXISTS(SELECT 1 FROM nook_guest_grants WHERE conversation=? AND user NOT IN (SELECT value FROM json_each(?)))', id, v.guestMembers.length, id, JSON.stringify(v.guestMembers)));
        }
    }
    else if (kind === 'actor')
        parts.push(v ? sql('EXISTS(SELECT 1 FROM nook_import_actors WHERE job=? AND source_id=? AND association IS ? AND source_record=?)', v.job, v.sourceId, v.association, JSON.stringify(v.sourceRecord)) : sql("NOT EXISTS(SELECT 1 FROM nook_import_actors WHERE job=? AND source_id=?)", ...id.split(':')));
    else if (kind === 'message') {
        if (!v)
            parts.push(sql('NOT EXISTS(SELECT 1 FROM nook_import_records WHERE id=?) AND NOT EXISTS(SELECT 1 FROM nook_messages WHERE id=?) AND NOT EXISTS(SELECT 1 FROM nook_import_files WHERE message=?) AND NOT EXISTS(SELECT 1 FROM nook_attachments WHERE message=?) AND NOT EXISTS(SELECT 1 FROM nook_search s WHERE message=? AND NOT EXISTS(SELECT 1 FROM nook_retained_import_bodies b JOIN nook_erased_import_messages e ON e.id=b.id WHERE b.id=s.message AND e.conversation=s.conversation AND s.source=\'imported\' AND s.scope=\'|\'||e.conversation||\'|\' AND s.body_lower=b.body_lower))', id, id, id, id, id));
        else {
            parts.push(sql('EXISTS(SELECT 1 FROM nook_import_records WHERE id=? AND job=? AND key=? AND conversation=? AND source_actor=? AND source_timestamp=? AND source_record=? AND body=? AND body_lower=? AND parent IS ? AND sequence=?)', id, v.job, v.key, v.conversation, v.sourceActor, v.sourceTimestamp, JSON.stringify(v.sourceRecord), v.body, v.body.toLowerCase(), v.parent, v.sequence), sql('(SELECT COUNT(*) FROM nook_import_files WHERE message=?)=? AND (SELECT COUNT(*) FROM nook_attachments WHERE message=?)=? AND (SELECT COUNT(*) FROM nook_search WHERE message=?)=1', id, v.files.length, id, v.files.length, id), sql("(SELECT COUNT(*) FROM nook_search WHERE message=? AND conversation=? AND source='imported' AND body_lower=? AND scope=?)=1", id, v.conversation, v.body.toLowerCase(), '|'+v.conversation+'|'));
            for (const f of v.files)
                parts.push(sql('EXISTS(SELECT 1 FROM nook_import_files f JOIN nook_attachments a ON a.id=f.attachment WHERE f.id=? AND f.job=? AND f.message=? AND f.source_id=? AND f.position=? AND a.id=f.id AND a.message=f.message AND a.conversation=? AND a.name=? AND a.mime=? AND a.size=? AND a.sha256=? AND a.object_key=? AND a.state=? AND a.author=? AND a.expires=? AND a.created=? AND a.intent=? AND a.position=f.position AND f.attachment=f.id)', f.id, v.job, id, f.sourceId, f.position, v.conversation, f.name, f.mime, f.size, f.sha256, f.objectKey, f.state, f.author, f.expires, f.created, f.intent));
        }
    }
    else
        throw new Error('IMPORT_TARGET_KIND');
    return parts;
}
