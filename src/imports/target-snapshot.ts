import { missingFileRefs } from './slack-records.mjs';
import type { D1Database, D1Sql, TargetRow } from './kit.ts';
import { encodeTargetSet, decodedTargetSetSql } from './target-set-codec.ts';
import { nativeStateSql, expectedStateSql, statesEqualSql, snapshotTuple, valueState } from './target-state.ts';
export const sql = (sql: string, ...params: any[]): D1Sql => ({ sql, params });
export const fileColumns = 'f.message,f.id,f.source_id,a.name,a.mime,a.size,a.sha256,f.position,a.object_key,a.state,a.author,a.expires,a.created,a.intent,a.message AS attachment_message,a.conversation AS attachment_conversation,a.position AS attachment_position,f.attachment';
/** A message target's value from its record (with its import owner) and files. */
export function messageValue(r: any, files: any[]): any {
    const value: any = { id: r.id, job: r.job, owner: r.owner, conversation: r.conversation, key: r.key, sourceActor: r.source_actor, sourceTimestamp: r.source_timestamp, sourceRecord: JSON.parse(r.source_record), body: r.body, parent: r.parent, sequence: r.sequence, files: files.map(f => ({ id: f.id, sourceId: f.source_id, name: f.name, mime: f.mime, size: f.size, sha256: f.sha256, position: f.position, objectKey: f.object_key, state: f.state, author: f.author, expires: f.expires, created: f.created, intent: f.intent })) };
    const missing = missingFileRefs(value.sourceRecord, value.files);
    if (missing.length) value.missingFiles = missing;
    return value;
}

const erasedAudience = (field: string, source: string) => `(SELECT json_group_array(user) FROM (
    SELECT a.value user FROM nook_import_channels ch JOIN nook_imports j ON j.id=ch.job JOIN nook_import_reviews review ON review.id=j.intent,json_each(${source}) channel,json_each(json_extract(channel.value,'$.${field}')) a JOIN nook_erased_actors erased ON erased.id=a.value WHERE ch.conversation=e.id AND json_extract(channel.value,'$.sourceId')=ch.source_id
    UNION
    SELECT a.value user FROM nook_import_channels ch JOIN nook_door_imports door ON door.domain_job=ch.job JOIN ik_door_plans plan ON plan.id=door.plan_id JOIN ik_provenance ownership ON ownership.job_id=plan.job_id AND ownership.destination=e.destination AND ownership.target_kind='channel' AND ownership.target_id=e.id AND ownership.reversed=0,json_each(door.summary_json,'$.channels') channel,json_each(json_extract(channel.value,'$.${field}')) a JOIN nook_erased_actors erased ON erased.id=a.value WHERE ch.conversation=e.id AND json_extract(channel.value,'$.sourceId')=ch.source_id
    ORDER BY user))`;
const snapshotSelect = `SELECT e.kind,e.id,e.revision,${nativeStateSql()} state,
    CASE WHEN e.kind='channel' THEN ${erasedAudience('members','review.channels_json')} ELSE '[]' END erased_members,
    CASE WHEN e.kind='channel' THEN ${erasedAudience('guestMembers',"review.summary_json,'$.channels'")} ELSE '[]' END erased_guests
    FROM nook_import_effect_revisions e WHERE e.destination=?`;
const ordered = (values: string[]) => [...new Set(values)].sort((a,b)=>Buffer.compare(Buffer.from(a),Buffer.from(b)));
function fromState(r: any, destination: string, erased: Set<string>): TargetRow {
    if (r.state === null) throw new Error('IMPORT_NATIVE_MISSING');
    const s = JSON.parse(r.state); let v: any;
    if (r.kind === 'channel') v = {id:s[0],name:s[1],kind:s[2],owner:s[3],seq:s[4],version:s[5],messageCount:s[6],job:s[7],sourceId:s[8],sourceRecord:JSON.parse(s[9]),members:ordered([...s[10],...JSON.parse(r.erased_members)]),guestMembers:ordered([...s[11],...JSON.parse(r.erased_guests)]),...(s[13]?{retained:true}:{})};
    else if (r.kind === 'actor') v = {job:s[0],sourceId:s[1],association:s[2],sourceRecord:JSON.parse(s[3])};
    else if (r.kind === 'message') v = messageValue({id:s[0],job:s[1],key:s[2],conversation:s[3],source_actor:s[4],source_timestamp:s[5],source_record:s[6],body:s[7],parent:s[9],sequence:s[10],owner:s[11]},s[12].filter((f:any[])=>f[6]!==null).map((f:any[])=>({id:f[0],source_id:f[3],position:f[5],name:f[10],mime:f[11],size:f[12],sha256:f[13],expires:f[14],state:f[15],created:f[16],object_key:f[17],intent:f[18],author:f[8]})));
    else throw new Error('IMPORT_TARGET_KIND');
    const expected = valueState(r.kind,v);
    if (r.kind === 'channel') {
        expected[10] = expected[10].filter((u:string)=>!erased.has(u));
        expected[11] = expected[11].filter((u:string)=>!erased.has(u));
    }
    // Values with changed search rows, dangling file links, raw provenance text,
    // unexpected rosters or attachment metadata must never look unchanged to undo.
    if (JSON.stringify(expected)!==JSON.stringify(s)) {
        // Source provenance has one privacy address: sourceRecord. Never retain
        // a second raw copy under diagnostic state that field erasure cannot see.
        const sourceAt = r.kind==='channel'?9:r.kind==='actor'?3:6;
        if (s[sourceAt]!==JSON.stringify(v.sourceRecord)) throw new Error('IMPORT_NATIVE_PROVENANCE_ENCODING');
        s[sourceAt]=null;
        v.nativeState=s;
    }
    return {destination,targetKind:r.kind,targetId:r.id,revision:r.revision,value:v};
}
async function snapshots(db: D1Database, destination: string, kind?: string, id?: string): Promise<TargetRow[]> {
    const [rows,erased] = await Promise.all([
        db.prepare(snapshotSelect+(kind===undefined?' ORDER BY e.kind,e.id':' AND e.kind=? AND e.id=?')).bind(destination,...(kind===undefined?[]:[kind,id])).all<any>(),
        db.prepare('SELECT id FROM nook_erased_actors').all<{id:string}>()
    ]);
    const ids = new Set(erased.results.map(r=>r.id));
    return rows.results.map(r=>fromState(r,destination,ids));
}
/** Two reads for the entire destination, regardless of its target count. */
export const listTargets = (db: D1Database, destination: string) => snapshots(db,destination);
export async function readTarget(db: D1Database, destination: string, kind: string, id: string): Promise<TargetRow | undefined> {
    return (await snapshots(db,destination,kind,id))[0];
}
function conjunct(parts: D1Sql[]): D1Sql { return sql(parts.map(p=>`(${p.sql})`).join(' AND '),...parts.flatMap(p=>p.params??[])); }
export function targetMatches(row: TargetRow | null, destination: string, kind: string, id: string): D1Sql { return conjunct(targetMatchParts(row,destination,kind,id)); }
export function targetMatchParts(row: TargetRow | null, destination: string, kind: string, id: string): D1Sql[] {
    if (row) {
        const state="json_extract(k.value,'$[3]')",keyKind="json_extract(k.value,'$[0]')",raw="json_extract(k.value,'$[4]')";
        return [sql(`EXISTS(SELECT 1 FROM json_each(?) k JOIN nook_import_effect_revisions e ON e.destination=? AND e.kind=? AND e.id=? WHERE e.kind=${keyKind} AND e.id=json_extract(k.value,'$[1]') AND e.revision=json_extract(k.value,'$[2]') AND ${statesEqualSql(nativeStateSql(),expectedStateSql(state,keyKind,raw))})`,JSON.stringify([snapshotTuple(row)]),destination,kind,id)];
    }
    const parts = [sql('NOT EXISTS(SELECT 1 FROM nook_import_effect_revisions WHERE destination=? AND kind=? AND id=?)',destination,kind,id)];
    if (kind==='channel') parts.push(sql('NOT EXISTS(SELECT 1 FROM nook_conversations WHERE id=?) AND NOT EXISTS(SELECT 1 FROM nook_import_channels WHERE conversation=?)',id,id));
    else if (kind==='actor') parts.push(sql("NOT EXISTS(SELECT 1 FROM nook_import_actors WHERE job||':'||source_id=?)",id));
    else if (kind==='message') parts.push(sql("NOT EXISTS(SELECT 1 FROM nook_import_records WHERE id=?) AND NOT EXISTS(SELECT 1 FROM nook_messages WHERE id=?) AND NOT EXISTS(SELECT 1 FROM nook_import_files WHERE message=?) AND NOT EXISTS(SELECT 1 FROM nook_attachments WHERE message=?) AND NOT EXISTS(SELECT 1 FROM nook_search s WHERE message=? AND NOT EXISTS(SELECT 1 FROM nook_retained_import_bodies b JOIN nook_erased_import_messages e ON e.id=b.id WHERE b.id=s.message AND e.conversation=s.conversation AND s.source='imported' AND s.scope='|'||e.conversation||'|' AND s.body_lower=b.body_lower))",id,id,id,id,id));
    else throw new Error('IMPORT_TARGET_KIND');
    return parts;
}
// A D1 statement carries at most 2,000,000 bytes of values; keep each predicate's
// encoded set under that with room for the destination and token bound.
const ENCODED_SET_BYTES = 1_900_000;
/** One count plus as few exact set predicates as fit D1's value limit. A shared
 * dictionary spans every row it can, so repeated structure travels once across the
 * whole destination; a set splits in half only when its encoding does not fit. */
export function targetsMatchMany(rows: TargetRow[], destination: string): D1Sql[] {
    const parts = [sql('(SELECT COUNT(*) FROM nook_import_effect_revisions WHERE destination=?)=?',destination,rows.length)];
    const state="json_extract(k.value,'$[3]')",kind="json_extract(k.value,'$[0]')",raw="json_extract(k.value,'$[4]')";
    const emit = (tuples: any[][]) => {
        const encoded=encodeTargetSet(tuples);
        if(tuples.length>1&&Buffer.byteLength(encoded.dictionary)+Buffer.byteLength(encoded.codes)>ENCODED_SET_BYTES) {
            const half=Math.ceil(tuples.length/2);emit(tuples.slice(0,half));emit(tuples.slice(half));return;
        }
        parts.push(sql(`(${decodedTargetSetSql} SELECT NOT EXISTS(SELECT 1 FROM expected k WHERE NOT EXISTS(SELECT 1 FROM nook_import_effect_revisions e WHERE e.destination=? AND e.kind=${kind} AND e.id=json_extract(k.value,'$[1]') AND e.revision=json_extract(k.value,'$[2]') AND ${statesEqualSql(nativeStateSql(),expectedStateSql(state,kind,raw))})))`,encoded.dictionary,encoded.maxTokens,encoded.codes,destination));
    };
    const keys = new Set<string>(), tuples: any[][] = [];
    for (const row of rows) {
        const key=JSON.stringify([row.targetKind,row.targetId]);
        if(row.destination!==destination||keys.has(key)) throw new Error('IMPORT_NATIVE_SET_MISMATCH');
        keys.add(key);tuples.push(snapshotTuple(row));
    }
    if(tuples.length) emit(tuples);
    return parts;
}
