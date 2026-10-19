import type { TargetRow } from './kit.ts';
import { retainedChannelHistory } from './channel-guard.ts';

// JSON arrays frame every scalar, including NULL, empty text and embedded NUL.
// Compare decoded paths, types and scalar values: transport may escape Unicode
// in JSON text without changing any native value.
const array = (columns: string) => `json_array(${columns})`;
const collected = (select: string) => `(SELECT json_group_array(json(x)) FROM (${select}))`;
const attachmentColumns = (a: string) => `${a}.id,${a}.conversation,${a}.author,${a}.message,${a}.name,${a}.mime,${a}.size,${a}.sha256,${a}.expires,${a}.state,${a}.created,${a}.object_key,${a}.intent,${a}.position`;
export const channelMembers = (table: string, conversation: string) => collected(`SELECT json_quote(user) x FROM ${table} WHERE conversation=${conversation} ORDER BY user`);
const fileState = collected(`SELECT ${array(`f.id,f.job,f.message,f.source_id,f.attachment,f.position,${attachmentColumns('a')}`)} x FROM nook_import_files f LEFT JOIN nook_attachments a ON a.id=f.attachment WHERE f.message=r.id ORDER BY f.position,f.id`);
const attachmentState = collected(`SELECT ${array(attachmentColumns('a'))} x FROM nook_attachments a WHERE a.message=r.id ORDER BY a.id`);
const searchState = collected(`SELECT ${array('s.message,s.conversation,s.source,s.scope,s.body_lower')} x FROM nook_search s WHERE s.message=r.id ORDER BY s.source,s.conversation,s.scope,s.body_lower`);
const collisionState = collected(`SELECT ${array('m.id,m.conversation,m.author,m.body,m.body_lower,m.parent,m.version,m.deleted,m.created,m.intent,m.payload,m.sequence,m.ordinal,m.author_ordinal')} x FROM nook_messages m WHERE m.id=r.id ORDER BY m.id`);

/** Complete native ownership projection. e is the destination revision row. */
export function nativeStateSql(e = 'e'): string {
    const history = retainedChannelHistory('c.id');
    return `CASE ${e}.kind
      WHEN 'channel' THEN (SELECT json_array(c.id,c.name,c.kind,c.owner,c.seq-CASE WHEN ${history} THEN 0 ELSE (SELECT COUNT(*) FROM nook_events ev WHERE ev.conversation=c.id AND ev.kind='erasure' AND ev.actor IS NULL) END,c.version,c.message_count,i.job,i.source_id,i.source_record,json(${channelMembers('nook_members','c.id')}),json(${channelMembers('nook_guest_grants','c.id')}),json(${channelMembers('nook_dm_roster','c.id')}),CASE WHEN ${history} THEN 1 ELSE 0 END) FROM nook_conversations c JOIN nook_import_channels i ON i.conversation=c.id WHERE c.id=${e}.id)
      WHEN 'actor' THEN (SELECT json_array(a.job,a.source_id,a.association,a.source_record) FROM nook_import_actors a WHERE a.job||':'||a.source_id=${e}.id)
      WHEN 'message' THEN (SELECT json_array(r.id,r.job,r.key,r.conversation,r.source_actor,r.source_timestamp,r.source_record,r.body,r.body_lower,r.parent,r.sequence,j.owner,json(${fileState}),json(${attachmentState}),json(${searchState}),json(${collisionState})) FROM nook_import_records r JOIN nook_imports j ON j.id=r.job WHERE r.id=${e}.id)
      END`;
}


/** JSON text has several spellings for the same scalar. Both images pass
 * through SQLite's decoder and serializer, preserving every path, container,
 * type and scalar while removing transport-only escaping differences. A missing
 * SQL value has no tree and normalizes to NULL, so it never matches a row. */
export function normalizedStateSql(state: string): string {
    return `(SELECT CASE WHEN COUNT(*)=0 THEN NULL ELSE json_group_array(json_array(fullkey,type,atom)) END FROM (SELECT fullkey,type,atom FROM json_tree(${state}) ORDER BY fullkey COLLATE BINARY))`;
}
export function statesEqualSql(actual: string, expected: string): string {
    return `CAST(${normalizedStateSql(actual)} AS BLOB)=CAST(${normalizedStateSql(expected)} AS BLOB)`;
}

const order = (a: string, b: string) => Buffer.compare(Buffer.from(a), Buffer.from(b));
const sorted = (values: string[]) => [...values].sort(order);
const attachment = (v: any, f: any) => [f.id,v.conversation,f.author,v.id,f.name,f.mime,f.size,f.sha256,f.expires,f.state,f.created,f.objectKey,f.intent,f.position];
/** The storage state a reviewed value promises. nativeState records deviations
 * discovered by a read, so edited child rows remain observable and fenceable. */
export function valueState(kind: string, v: any): any[] {
    if (v.nativeState) {
        const state = [...v.nativeState];
        state[kind==='channel'?9:kind==='actor'?3:6]=JSON.stringify(v.sourceRecord);
        return state;
    }
    if (kind === 'channel') return [v.id,v.name,v.kind,v.owner,v.seq,v.version,v.messageCount,v.job,v.sourceId,JSON.stringify(v.sourceRecord),sorted(v.members),sorted(v.guestMembers),v.kind==='dm'?sorted(v.members):[],v.retained?1:0];
    if (kind === 'actor') return [v.job,v.sourceId,v.association,JSON.stringify(v.sourceRecord)];
    if (kind === 'message') return [v.id,v.job,v.key,v.conversation,v.sourceActor,v.sourceTimestamp,JSON.stringify(v.sourceRecord),v.body,v.body.toLowerCase(),v.parent,v.sequence,v.owner,
        [...v.files].sort((a,b)=>a.position-b.position||order(a.id,b.id)).map(f=>[f.id,v.job,v.id,f.sourceId,f.id,f.position,...attachment(v,f)]),
        [...v.files].sort((a,b)=>order(a.id,b.id)).map(f=>attachment(v,f)),[[v.id,v.conversation,'imported','|'+v.conversation+'|',v.body.toLowerCase()]],[]];
    throw new Error('IMPORT_TARGET_KIND');
}

/** Erased identities remain in reviewed values but never regain native access.
 * Filtering in SQL also fences erasure racing the transaction. */
export function expectedStateSql(state: string, kind: string, raw: string): string {
    const filtered = (at: number) => `(SELECT json_group_array(value) FROM (SELECT value FROM json_each(${state},'$[${at}]') a WHERE NOT EXISTS(SELECT 1 FROM nook_erased_actors erased WHERE erased.id=a.value) ORDER BY value))`;
    return `CASE WHEN ${kind}='channel' AND NOT (${raw}) THEN json_set(${state},'$[10]',json(${filtered(10)}),'$[11]',json(${filtered(11)})) ELSE ${state} END`;
}

export function snapshotTuple(row: TargetRow) {
    return [row.targetKind,row.targetId,row.revision,valueState(row.targetKind,row.value),!!(row.value as any).nativeState];
}
