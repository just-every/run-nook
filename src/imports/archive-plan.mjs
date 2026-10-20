import {doorArchivePlans} from './archive-door.mjs';
import {mappingVersion} from './formats.mjs';
import { canonicalJson, sha256 } from './kit.ts';
import { planFingerprint } from '../base/modules/import-kit/src/plan/index.ts';
import { MAPPING_VERSION } from './ids.mjs';
import { validateReviewedPlan } from './reviewed-plan.mjs';
import { encodePlan } from '../base/modules/import-kit/src/d1/plans.ts';
import { validateSlackRecoveryGraph } from './archive-recovery.mjs';
import { validateSlackProvenance } from './archive-provenance.mjs';
const check = (ok, code) => { if (!ok) throw Error(code); };
export function decodeSlackPlan(job, chunks) {
    const header = JSON.parse(job.plan_json), parts = chunks.filter(c => c.job_id === job.id).sort((a, b) => a.ordinal - b.ordinal);
    let plan = header;
    if (header.d1Plan === 1) {
        const body = parts.map(c => c.body).join('');
        check(parts.length === header.chunks && parts.every((c, i) => c.ordinal === i) && Buffer.byteLength(body) === header.size && sha256(body) === header.sha256, 'slack_plan_chunks_changed');
        plan = JSON.parse(body);
        check(canonicalJson(plan) === body, 'slack_plan_encoding_changed');
    } else check(parts.length === 0 && canonicalJson(plan) === job.plan_json, 'slack_plan_encoding_changed');
    check(plan.version === 1 && plan.fingerprint === job.fingerprint && planFingerprint(plan) === job.fingerprint, 'slack_plan_changed');
    const encoded = encodePlan(plan, job.id);
    check(encoded.body === job.plan_json && canonicalJson(encoded.chunks) === canonicalJson(parts), 'slack_plan_encoding_changed');
    return plan;
}
/** Validate this product's immutable plan encoding directly; no alternate D1
 * facade and no writes are involved in offline archive graph admission. */
export async function slackArchivePlans(read, reviews, db, manifest) {
    const names = ['ik_jobs', 'ik_d1_plan_chunks', 'nook_imports'];
    const data = Object.fromEntries(await Promise.all(names.map(async name => [name, await read(name)])));
    const jobs = new Map(data.ik_jobs.map(j => [j.id, j])), result = new Map();
    for (const review of reviews) {
        if (!review.kit_job) {
            // Draft/discarded approvals never published a Base job. Completed
            // and reversed approvals always retain their immutable job binding.
            check(['reviewed', 'discarded'].includes(review.state), 'slack_review_requires_job');
            check(!data.nook_imports.some(j => j.intent === review.id), 'inactive_slack_review_has_history');
            continue;
        }
        const job = jobs.get(review.kit_job);
        check(job,'invalid_slack_job_binding');const plan = decodeSlackPlan(job,data.ik_d1_plan_chunks);
        check(job && job.mapping_version === mappingVersion(review) && job.destination === review.owner && job.principal_id === review.owner && job.operation_key === review.id && job.namespace === review.namespace && (plan.erasure?.reviewedFingerprint??job.fingerprint) === review.fingerprint && ['completed', 'undone', 'rolled_back'].includes(job.state), 'invalid_slack_job_binding');
        check(review.state === (job.state === 'completed' ? 'completed' : 'undone'), 'invalid_slack_review_state');
        const summary = JSON.parse(review.summary_json);
        const { effects } = await validateReviewedPlan(read, review, job, plan);
        check(!result.has(review.id), 'duplicate_slack_review');
        const revisions = await validateSlackProvenance(read, job, plan);
        result.set(review.id, { review, job, plan, summary, effects, revisions });
    }
    const doors=await doorArchivePlans(read,decodeSlackPlan,db);
    for(const [id,proof] of doors){check(!result.has(id),'duplicate_import_binding');result.set(id,proof);}
    check(data.ik_jobs.every(j => [...result.values()].some(p=>p.job.id===j.id)), 'orphan_slack_kit_job');
    await validateSlackRecoveryGraph(read, result, manifest);
    return result;
}
