import { fail } from '../family/team-chat/domain';
import type { Context } from '../platform/storage/context';
import { owner, ownerBatch } from './owner';
import { cleanupImportObjects } from './object-store';
import { budgeted } from './request-budget';
import { reconcileReviewed } from './reconcile';
import { importContext, importPredicate } from './authorization';
import { readD1ImportJob, undoD1Import, rollbackD1Import } from './kit';
const FINISH = 7;
export async function undoLegacy(c: Context, id: string) {
    c = budgeted(c);
    await owner(c); const saved = await c.one('SELECT * FROM nook_import_reviews WHERE id=? AND owner=?', [id,c.uid]); if(!saved?.kit_job) fail(404, 'Historical import unavailable'); const review = await reconcileReviewed(c,saved);
    if (!review.kit_job) fail(409, 'Import has no applied job');
    const guard = importPredicate(c,review,'undo');
    if (!await c.one('SELECT 1 WHERE '+guard.sql,guard.params ?? [])) fail(409,'History or audience changed since this import; guarded Undo refused');
    const current = await readD1ImportJob(review.kit_job, importContext(c, review));
    const undo = ['completed', 'undoing', 'undone'].includes(current.state);
    const job = await (undo ? undoD1Import : rollbackD1Import)(review.kit_job, importContext(c, review, FINISH)).catch(error => {
        if (error instanceof Error && ['NATIVE_EDIT_CONFLICT','IMPORT_SUPERSEDED'].includes(error.message)) fail(409,'History changed since this import; guarded Undo refused');
        throw error;
    });
    if (['undone', 'rolled_back'].includes(job.state)) await finishReversal(c, review);
    return { review: id, job };
}
async function finishReversal(c: Context, review: any) {
    const prefix = `private/imports/${c.uid}/${review.upload}/files/${review.domain_job}/`;
    await ownerBatch(c, [
        c.sql('DELETE FROM nook_imports WHERE id=? AND owner=? AND intent=?', review.domain_job, c.uid, review.id),
        c.sql("INSERT OR IGNORE INTO nook_object_deletes(object_key,created) SELECT object_key,? FROM nook_import_objects WHERE owner=? AND state<>'deleted' AND substr(object_key,1,length(?))=? AND NOT EXISTS(SELECT 1 FROM nook_attachments a WHERE a.object_key=nook_import_objects.object_key) AND EXISTS(SELECT 1 FROM nook_import_reviews WHERE id=? AND owner=? AND state<>'undone')", Date.now(), c.uid, prefix, prefix, review.id, c.uid),
        c.sql("UPDATE nook_import_reviews SET state='undone' WHERE id=? AND owner=?", review.id, c.uid)
    ]);
    await cleanupImportObjects(c);
    // Wake the hub so its alarm drains the rest of the queued object deletes.
    await c.hint();
}
