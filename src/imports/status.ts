import type { Context } from '../platform/storage/context';
import { importPredicate } from './authorization.ts';

async function allowed(c: Context, review: any, action: 'apply' | 'undo') {
    const p = importPredicate(c, review, action);
    return !!await c.one(`SELECT 1 AS ok WHERE ${p.sql}`, p.params ?? []);
}
/** One reviewed import as the imports page shows it: its kit job (or null) and
 * whether forward work and guarded reversal are allowed right now. */
export async function statusView(c: Context, review: any, job: any, uploadReady: boolean) {
    const forwardAuthority = !!review.fingerprint && await allowed(c, review, 'apply');
    const summary=JSON.parse(review.summary_json),destinations=['campfire','mattermost'].includes(summary.sourceType)?await c.rows('SELECT source_id AS sourceId,conversation AS id FROM nook_import_channels WHERE job=?',[review.domain_job]):undefined;
    return {destinations, review: review.id, upload: review.upload, state: review.fingerprint ? review.state : 'draft', fingerprint: review.currentFingerprint ?? review.fingerprint, job, forwardAuthority, reversalSafe: await allowed(c, review, 'undo'), canReviewAgain: review.state === 'undone' && uploadReady && !forwardAuthority, summary: JSON.parse(review.summary_json) };
}
