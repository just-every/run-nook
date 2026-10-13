import type { Context } from '../platform/storage/context';
import { owner } from './custody.ts';
import { budgeted } from './request-budget.ts';
import { statusView } from './status.ts';
import { MAPPING_VERSION } from './ids.mjs';
import { reconcileReviewed } from './reconcile';
import { decode } from '../base/modules/import-kit/src/d1/jobs.ts';

// The list reads each import's job row and binding without re-verifying its
// stored plan and custody. Those guards cost about 22 statements per
// 3,500-entry import, so about 41 imports spent the request's 900. Opening one
// import (importStatus) and every action still run the kit's full guards.
// Erased plans or withdrawn uploads need reconciliation before advertising
// that their saved custody still allows continuation or reversal.
const JOB_COLUMNS = 'id,fingerprint,destination,namespace,mapping_version,principal_id,operation_key,state,checkpoint,total,fence,error';
export async function listImports(c: Context) {
    c = budgeted(c);
    await owner(c);
    const reviews = await c.rows("SELECT r.*,u.state AS upload_state FROM nook_import_reviews r LEFT JOIN nook_import_uploads u ON u.id=r.upload AND u.owner=r.owner WHERE r.owner=? AND r.state<>'discarded' ORDER BY r.created DESC LIMIT 50", [c.uid]);
    // A lost create acknowledgement leaves kit_job empty; its job is found by
    // operation key here, and resume records it under full guards.
    const rows = reviews.length ? await c.rows(`SELECT ${JOB_COLUMNS} FROM ik_jobs WHERE destination=? AND principal_id=? AND mapping_version=? AND operation_key IN (SELECT value FROM json_each(?))`, [c.uid, c.uid, MAPPING_VERSION, JSON.stringify(reviews.map(r => r.id))]) : [];
    const jobs = [];
    for (let review of reviews) {
        const candidate = rows.find(j => j.operation_key === review.id);
        if (candidate && (candidate.fingerprint !== review.fingerprint || review.upload_state === 'discarded')) review = await reconcileReviewed(c, review);
        const row = rows.find(j => j.operation_key === review.id && j.namespace === review.namespace && j.fingerprint === (review.currentFingerprint ?? review.fingerprint) && (!review.kit_job || j.id === review.kit_job));
        jobs.push(await statusView(c, review, row ? decode(row) : null, review.upload_state === 'ready'));
    }
    return { jobs };
}
