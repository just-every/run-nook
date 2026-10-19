import type { Context } from '../platform/storage/context';
import { importDigest } from '../family/team-chat/import-capture.mjs';
import { decodeSlackPlan } from './archive-plan.mjs';
import { importContext } from './authorization';
import { validateReviewedPlan } from './reviewed-plan.mjs';
import { stored, boundary } from '../base/modules/import-kit/src/d1/jobs.ts';
import { atomic, guard, sql } from '../base/modules/import-kit/src/d1/database.ts';
import { custodyGuards, inventoryGuards } from '../base/modules/import-kit/src/d1/integrity.ts';
import { readOriginals } from '../base/modules/import-kit/src/d1/originals.ts';
import { requestContext } from '../base/modules/import-kit/src/d1/budget.ts';

/** Creation and its product receipt are separate commits. Recover only the
 * existing, fully validated operation under current owner read authority. */
export async function reconcileReviewed(c: Context, review: any) {
    if (!review.fingerprint) return review;
    const raw = await c.one('SELECT * FROM ik_jobs WHERE destination=? AND principal_id=? AND operation_key=?', [c.uid, c.uid, review.id]);
    if (!raw) return review;
    if (review.kit_job && review.kit_job !== raw.id) throw Error('Import custody binding changed');
    const withdrawn = !!await c.one("SELECT 1 FROM nook_import_uploads WHERE id=? AND owner=? AND state='discarded'", [review.upload, c.uid]);
    if (raw.fingerprint !== review.fingerprint || withdrawn) {
        const plan = decodeSlackPlan(raw, await c.rows('SELECT * FROM ik_d1_plan_chunks WHERE job_id=? ORDER BY ordinal', [raw.id]));
        await validateReviewedPlan(async (table: string) => {
            if (['ik_original_sets', 'ik_originals', 'ik_d1_original_chunks'].includes(table)) return c.rows(`SELECT * FROM ${table} WHERE job_id=?`, [raw.id]);
            if (['ik_d1_erased_sources', 'ik_d1_erased_targets'].includes(table)) return c.rows(`SELECT * FROM ${table} WHERE destination=?`, [raw.destination]);
            throw Error('Invalid custody table');
        }, review, raw, plan);
        // A sibling operation can keep an unchanged, fully owned plan after
        // erasure withdraws their shared ZIP. Only existing validated custody
        // permits legacy reads and reversal; unused approvals cannot apply.
        review = { ...review, currentFingerprint: raw.fingerprint, savedCustody: true };
        if (plan.erasure) {
            const actors = JSON.parse(review.summary_json).actors;
            const erasedAssociations = [...new Set<string>(actors.map((a: any) => a.association).filter((id: any): id is string => typeof id === 'string'))].filter(id => actors.filter((a: any) => a.association === id).every((a: any) => plan.entries.some((e: any) => e.erased && e.identity === importDigest([review.owner, review.namespace, 'actor', review.domain_job + ':' + a.sourceId]))));
            review = { ...review, erased: true, erasedAssociations };
        }
    }
    if (review.kit_job) return review;
    const ctx = requestContext(importContext(c, review)), { job, plan } = await stored(raw.id, ctx);
    await validateReviewedPlan(async (table: string) => {
        if (['ik_d1_erased_sources', 'ik_d1_erased_targets'].includes(table)) return c.rows(`SELECT * FROM ${table} WHERE destination=?`, [raw.destination]);
        if (!['ik_original_sets', 'ik_originals', 'ik_d1_original_chunks'].includes(table)) throw Error('Invalid custody table');
        return c.rows(`SELECT * FROM ${table} WHERE job_id=?`, [job.id]);
    }, review, raw, plan);
    await readOriginals(plan, job.id, ctx);
    const inventory = await inventoryGuards(job, plan, ctx);
    await atomic(ctx, 'read', [
        ...boundary(job, plan), ...custodyGuards(plan, job.id), ...inventory,
        guard(sql('EXISTS(SELECT 1 FROM ik_jobs WHERE id=? AND operation_key=?)', job.id, review.id)),
        guard(sql('EXISTS(SELECT 1 FROM nook_import_reviews WHERE id=? AND owner=? AND upload=? AND namespace=? AND domain_job=? AND review_json=? AND summary_json=? AND (kit_job IS NULL OR kit_job=?))', review.id, c.uid, review.upload, review.namespace, review.domain_job, review.review_json, review.summary_json, job.id)),
        sql("UPDATE nook_import_reviews SET kit_job=?,state='applying' WHERE id=? AND owner=? AND kit_job IS NULL", job.id, review.id, c.uid)
    ]);
    return { ...review, kit_job: job.id, state: 'applying' };
}
