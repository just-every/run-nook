import { fail } from '../family/team-chat/domain';
import type { Context } from '../platform/storage/context';
import { owner, ownerBatch } from './owner';
import { budgeted, left } from './request-budget';
export type CustodyObject = { key: string; bytes: Uint8Array; mime: string; sha256: string };
/** Share the native durable late-writer exclusion. One attempt per object is
 * claimed and released in a single batch each, so a whole chunk costs the same
 * few statements as one object. An uncertain put keeps its attempt until the
 * paused maintenance reconciler can safely retire it. */
export async function putCustodyObjects(c: Context, objects: CustodyObject[], complete: D1PreparedStatement[], condition: string, params: any[]) {
    const attempts = objects.map(o => ({ id: crypto.randomUUID(), key: o.key })), ids = (list: { id: string }[]) => JSON.stringify(list.map(a => a.id));
    await ownerBatch(c, [c.sql("INSERT INTO nook_upload_attempts SELECT json_extract(value,'$.id'),json_extract(value,'$.key'),? FROM json_each(?)", Date.now(), JSON.stringify(attempts))], condition, params);
    let uncertain: string | null = null;
    try {
        for (const [i, object] of objects.entries()) {
            const existing = await c.env.FILES.head(object.key);
            if (existing && (existing.size !== object.bytes.length || existing.customMetadata?.sha256 !== object.sha256)) fail(409, 'Custody object changed');
            if (!existing) {
                uncertain = attempts[i].id;
                await c.env.FILES.put(object.key, object.bytes, { customMetadata: { sha256: object.sha256 }, httpMetadata: { contentType: object.mime } });
                uncertain = null;
            }
        }
        await ownerBatch(c, [...complete, c.sql('DELETE FROM nook_upload_attempts WHERE id IN (SELECT value FROM json_each(?))', ids(attempts))], condition, params);
    } catch (error) {
        // Removing durable or never-started attempts cannot publish or authorize
        // a file. A revoked owner leaves them for paused reconciliation instead.
        try { await ownerBatch(c, [c.sql('DELETE FROM nook_upload_attempts WHERE id IN (SELECT value FROM json_each(?))', ids(attempts.filter(a => a.id !== uncertain)))]); await cleanupImportObjects(c); } catch { }
        throw error;
    }
}
/** Durable shared queue, confined here to this owner's custody. Native recovery
 * can drain the same queue with identical attempt exclusion and state updates. */
export async function cleanupImportObjects(c: Context) {
    // The owner check and the queue read take 5 statements and each object 11;
    // take what this request's budget leaves. The hub alarm drains the rest.
    c = budgeted(c);
    const room = Math.min(25, Math.floor((left(c) - 5) / 11));
    if (room < 1) return 0;
    await owner(c);
    const rows = await c.rows(`SELECT d.object_key FROM nook_object_deletes d WHERE
        (EXISTS(SELECT 1 FROM nook_import_objects o WHERE o.object_key=d.object_key AND o.owner=?) OR EXISTS(SELECT 1 FROM nook_import_uploads u WHERE u.object_key=d.object_key AND u.owner=? AND u.state='discarded'))
        AND NOT EXISTS(SELECT 1 FROM nook_attachments a WHERE a.object_key=d.object_key)
        AND NOT EXISTS(SELECT 1 FROM nook_upload_attempts p WHERE p.object_key=d.object_key) ORDER BY d.created LIMIT ?`, [c.uid, c.uid, room]);
    for (const row of rows) {
        const condition = 'NOT EXISTS(SELECT 1 FROM nook_attachments WHERE object_key=?) AND NOT EXISTS(SELECT 1 FROM nook_upload_attempts WHERE object_key=?)';
        await ownerBatch(c, [c.sql("UPDATE nook_import_objects SET state='deleting' WHERE object_key=? AND owner=?", row.object_key, c.uid)], condition, [row.object_key, row.object_key]);
        await c.env.FILES.delete(row.object_key);
        await ownerBatch(c, [c.sql("UPDATE nook_import_objects SET state='deleted' WHERE object_key=? AND owner=?", row.object_key, c.uid), c.sql('DELETE FROM nook_object_deletes WHERE object_key=?', row.object_key)], condition, [row.object_key, row.object_key]);
    }
    return rows.length;
}
