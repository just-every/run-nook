import type { Context } from '../platform/storage/context';
import { owner, ownerBatch } from './owner';
import { budgeted, left } from './request-budget';
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
