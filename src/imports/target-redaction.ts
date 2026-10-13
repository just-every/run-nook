import type { D1Database, D1FieldRedaction, D1RedactionScope, D1Sql, TargetRow } from './kit.ts';
import { fileColumns, messageValue, readTarget, targetMatchParts, sql } from './target-snapshot.ts';

// Every import target keeps its Slack source record in a source_record column.
// Field redaction (a person's id in other people's reactions) rewrites only that.
const sources: Record<string, { table: string; key(alias: string): string }> = {
    message: { table: 'nook_import_records', key: t => `${t}.id` },
    actor: { table: 'nook_import_actors', key: t => `${t}.job||':'||${t}.source_id` },
    channel: { table: 'nook_import_channels', key: t => `${t}.conversation` }
};
const CHUNK_BYTES = 500000;
const recordColumns = ['job', 'key', 'conversation', 'source_actor', 'source_timestamp', 'source_record', 'body', 'body_lower', 'parent', 'sequence'];
/** A message target's record row as nook_import_records stores it. */
function record(row: TargetRow) {
    const v = row.value as any;
    return { id: row.targetId, revision: row.revision, job: v.job, key: v.key, conversation: v.conversation, source_actor: v.sourceActor, source_timestamp: v.sourceTimestamp, source_record: JSON.stringify(v.sourceRecord), body: v.body, body_lower: v.body.toLowerCase(), parent: v.parent, sequence: v.sequence };
}

/** True when the JSON column holds the field's exact text value at its path below
 * sourceRecord. Like the kit's redaction, `*` visits array items only. Paths are
 * built from the column's own fullkey, so malformed items never become JSON. */
function holds(column: string, field: D1FieldRedaction, n: number): D1Sql {
    const [root, ...path] = field.path;
    if (root !== 'sourceRecord' || !path.length)
        throw new Error('IMPORT_REDACTION_PATH_UNSUPPORTED');
    let at = "'$'";
    const from: string[] = [], where: string[] = [];
    for (const [i, segment] of path.entries()) {
        if (segment === '*') {
            const each = `w${n}_${i}`;
            where.push(`json_type(${column},${at})='array'`);
            from.push(`json_each(${column},${at}) ${each}`);
            at = `${each}.fullkey`;
        }
        else if (typeof segment === 'number' || /^[A-Za-z0-9_]+$/.test(segment))
            at = `${at}||'${typeof segment === 'number' ? `[${segment}]` : `.${segment}`}'`;
        else
            throw new Error('IMPORT_REDACTION_PATH_UNSUPPORTED');
    }
    where.push(`json_type(${column},${at})='text'`, `json_extract(${column},${at})=?`);
    return sql(from.length ? `EXISTS(SELECT 1 FROM ${from.join(',')} WHERE ${where.join(' AND ')})` : where.join(' AND '), field.value);
}
/** Effect revision rows (alias e) whose native source record holds any field. */
export function holding(fields: readonly D1FieldRedaction[]): D1Sql {
    const kinds = Object.entries(sources).map(([kind, { table, key }]) => {
        const parts = fields.map((field, n) => holds('s.source_record', field, n));
        return sql(`(e.kind='${kind}' AND EXISTS(SELECT 1 FROM ${table} s WHERE ${key('s')}=e.id AND (${parts.map(p => p.sql).join(' OR ')})))`, ...parts.flatMap(p => p.params ?? []));
    });
    return sql(kinds.map(k => k.sql).join(' OR '), ...kinds.flatMap(k => k.params ?? []));
}
function chunks<T>(rows: T[]): string[] {
    const result: string[] = [];
    let part: string[] = [], size = 2;
    for (const row of rows) {
        const value = JSON.stringify(row), bytes = Buffer.byteLength(value) + 1;
        if (part.length && size + bytes > CHUNK_BYTES) { result.push(`[${part.join(',')}]`); part = []; size = 2; }
        part.push(value); size += bytes;
    }
    if (part.length)
        result.push(`[${part.join(',')}]`);
    return result;
}

/** Read and fence only the destination's targets whose Slack source record names
 * a redacted value, so erasing a person's id from other people's reactions costs
 * what the affected rows cost, not every imported message. */
export async function redactionScope(db: D1Database, destination: string, fields: readonly D1FieldRedaction[]): Promise<D1RedactionScope> {
    const held = holding(fields), rows: TargetRow[] = [];
    const records = (await db.prepare(`SELECT s.*,j.owner,e.revision FROM nook_import_effect_revisions e JOIN nook_import_records s ON s.id=e.id JOIN nook_imports j ON j.id=s.job WHERE e.destination=? AND e.kind='message' AND (${held.sql}) ORDER BY e.id`).bind(destination, ...held.params!).all<any>()).results;
    const files = new Map<string, any[]>();
    for (const ids of chunks(records.map(r => r.id)))
        for (const f of (await db.prepare(`SELECT ${fileColumns} FROM nook_import_files f JOIN nook_attachments a ON a.id=f.attachment WHERE f.message IN (SELECT value FROM json_each(?)) ORDER BY f.message,f.position`).bind(ids).all<any>()).results)
            files.set(f.message, [...files.get(f.message) ?? [], f]);
    for (const r of records)
        rows.push({ destination, targetKind: 'message', targetId: r.id, revision: r.revision, value: messageValue(r, files.get(r.id) ?? []) });
    // Actor and channel records do not carry reactions; read any that match one by one.
    for (const { kind, id } of (await db.prepare(`SELECT e.kind,e.id FROM nook_import_effect_revisions e WHERE e.destination=? AND e.kind<>'message' AND (${held.sql}) ORDER BY e.kind,e.id`).bind(destination, ...held.params!).all<{ kind: string; id: string }>()).results)
        rows.push((await readTarget(db, destination, kind, id))!);
    return {
        rows,
        // The count, and each listed row still holding a value, prove the exact set.
        holding: listed => [sql(`(SELECT COUNT(*) FROM nook_import_effect_revisions e WHERE e.destination=? AND (${held.sql}))=?`, destination, ...held.params!, listed.length),
            ...chunks(listed.map(row => [row.targetKind, row.targetId])).map(keys => sql(`NOT EXISTS(SELECT 1 FROM json_each(?) k WHERE NOT EXISTS(SELECT 1 FROM nook_import_effect_revisions e WHERE e.destination=? AND e.kind=json_extract(k.value,'$[0]') AND e.id=json_extract(k.value,'$[1]') AND (${held.sql})))`, keys, destination, ...held.params!))],
        // write rewrites only the record row (imported records are replaced, never
        // updated), so its columns and revision are a message's whole fence; its
        // files and search row are never touched.
        matches: listed => [...chunks(listed.filter(row => row.targetKind === 'message').map(record)).map(set => sql(`NOT EXISTS(SELECT 1 FROM json_each(?) k WHERE NOT EXISTS(SELECT 1 FROM nook_import_effect_revisions e JOIN nook_import_records r ON r.id=e.id WHERE e.destination=? AND e.kind='message' AND e.id=json_extract(k.value,'$.id') AND e.revision IS json_extract(k.value,'$.revision') AND ${recordColumns.map(c => `r.${c} IS json_extract(k.value,'$.${c}')`).join(' AND ')}))`, set, destination)),
            ...listed.filter(row => row.targetKind !== 'message').flatMap(row => targetMatchParts(row, destination, row.targetKind, row.targetId))],
        write: next => [...chunks(next.filter(row => row.targetKind === 'message').map(record)).flatMap(set => [sql("DELETE FROM nook_import_records WHERE id IN (SELECT json_extract(value,'$.id') FROM json_each(?))", set),
                sql(`INSERT INTO nook_import_records(id,${recordColumns.join(',')}) SELECT ${['id', ...recordColumns].map(c => `json_extract(value,'$.${c}')`).join(',')} FROM json_each(?)`, set)]),
            ...['actor', 'channel'].flatMap(kind => chunks(next.filter(row => row.targetKind === kind).map(row => ({ id: row.targetId, source_record: JSON.stringify((row.value as any).sourceRecord) })))
                .map(set => sql(`UPDATE ${sources[kind].table} SET source_record=(SELECT json_extract(value,'$.source_record') FROM json_each(?) WHERE json_extract(value,'$.id')=${sources[kind].key(sources[kind].table)}) WHERE ${sources[kind].key(sources[kind].table)} IN (SELECT json_extract(value,'$.id') FROM json_each(?))`, set, set)))]
    };
}
