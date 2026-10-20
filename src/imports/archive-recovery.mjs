import { canonicalJson } from './kit.ts';
import { EMPTY_REVERSAL_HASH, policyHash } from '../base/modules/import-kit/src/d1/undo-state.ts';
import { planIndex } from '../base/modules/import-kit/src/d1/erasure-index.ts';
import { archiveTableNames } from '../platform/storage/archive-inventory.mjs';
const check = (ok, code) => { if (!ok) throw Error(code); };
const equal = (a, b) => canonicalJson(a) === canonicalJson(b);
const ordered = rows => [...rows].sort((a, b) => canonicalJson(a).localeCompare(canonicalJson(b)));
const integer = n => Number.isSafeInteger(n) && n >= 0;

// Slack uses strictly reversible jobs without reuse, streaming or native staging.
// Explicit kit erasure states keep their source and target replay fences. Validate the entire retained recovery graph,
// including rows that are not needed just to display completed history.
export async function validateSlackRecoveryGraph(read, proofs, manifest) {
    const jobs = new Map([...proofs.values()].map(p => [p.job.id, p]));
    check(equal(ordered(await read('nook_import_effect_revisions')), ordered([...jobs.values()].flatMap(p => p.revisions))), 'slack_effect_revision_changed');
    const owned = ['ik_d1_plan_chunks', 'ik_original_sets', 'ik_originals', 'ik_d1_original_chunks', 'ik_provenance', 'ik_sources', 'ik_d1_entries', 'ik_batches', 'ik_d1_plan_index', 'ik_d1_indexed_jobs', 'ik_d1_custody_revisions', 'ik_d1_custody_states'];
    const data = {};
    for (const table of owned) {
        data[table] = await read(table);
        check(data[table].every(row => jobs.has(row.job_id)), 'orphan_slack_recovery_row');
    }
    const unsupported = new Set(['ik_d1_reversal_reports', 'ik_d1_creation_plans', 'ik_stages', 'ik_targets', 'ik_d1_streams', 'ik_d1_stream_pages', 'ik_d1_stream_origins', 'ik_d1_stream_revisions', 'ik_d1_publication_fences', 'ik_d1_staging', 'ik_d1_staging_pages', 'ik_d1_staging_chunks', 'ik_d1_staging_index', 'ik_d1_staging_originals', 'ik_d1_native_staging', 'ik_d1_native_staging_index', 'ik_d1_native_staging_values', 'ik_d1_preparation_receipts', 'ik_d1_staging_headers']);
    for (const table of manifest ? archiveTableNames(manifest) : unsupported) {
        if (!unsupported.has(table)) continue;
        check((await read(table)).length === 0, 'unsupported_slack_recovery_state');
    }
    check((await read('ik_d1_history')).every(row=>jobs.get(row.job_id)?.door),'unsupported_slack_recovery_state');
    const erasedSources=await read('ik_d1_erased_sources'),erasedTargets=await read('ik_d1_erased_targets');
    check(erasedSources.every(row=>[...jobs.values()].some(({job,plan})=>job.destination===row.destination&&plan.entries.some(e=>e.erased&&e.identity===row.identity)))&&erasedTargets.every(row=>[...jobs.values()].some(({job,plan})=>job.destination===row.destination&&plan.entries.some(e=>e.erased&&e.erasedTargetIdentity===row.identity))),'orphan_slack_erasure_fence');
    for (const { job, plan } of jobs.values()) {
        check(job.reversal_policy === 'strict' && job.reversal_cursor === 0 && job.reversal_hash === EMPTY_REVERSAL_HASH && (job.reversal_policy_hash === null || job.reversal_policy_hash === policyHash(job.id, job.fingerprint, 'strict')), 'slack_reversal_integrity');
        check(integer(job.fence) && integer(job.checkpoint) && integer(job.total) && job.checkpoint <= job.total && job.error === null && job.lease_token === null && job.lease_expires === null, 'invalid_slack_recovery_job');
        const rows = table => data[table].filter(r => r.job_id === job.id);
        check(equal(ordered(rows('ik_d1_plan_index')), ordered(planIndex(plan, job.id))) && equal(rows('ik_d1_indexed_jobs'), [{job_id: job.id, fingerprint: job.fingerprint}]), 'slack_plan_index_changed');
        for (const table of ['ik_d1_custody_revisions', 'ik_d1_custody_states']) {
            const state = rows(table);
            check(state.length === 1 && integer(state[0].revision) && (table !== 'ik_d1_custody_revisions' || state[0].seal === null), 'slack_custody_state_changed');
        }
        const batches = rows('ik_batches'), apply = batches.filter(r => r.action === 'apply').sort((a, b) => a.position - b.position);
        let checkpoint = 0, fence = 0;
        for (const batch of apply) {
            check(integer(batch.position) && integer(batch.end_position) && batch.position === checkpoint && batch.end_position >= batch.position && batch.end_position <= job.total && batch.fence === fence + 1, 'slack_journal_mismatch');
            checkpoint = batch.end_position; fence = batch.fence;
        }
        check(checkpoint === job.checkpoint, 'slack_journal_mismatch');
        const reversed = batches.filter(r => r.action !== 'apply').sort((a, b) => a.position - b.position);
        if (job.state === 'completed') check(reversed.length === 0 && fence === job.fence, 'slack_journal_mismatch');
        else {
            check(job.state === 'undone' || job.state === 'rolled_back', 'invalid_slack_recovery_job');
            if (job.state === 'undone') check(checkpoint === job.total, 'slack_journal_mismatch');
            fence++; // Base commits reversal intent separately from its batches.
            check(reversed.length > 0, 'slack_journal_mismatch');
            for (const batch of reversed) {
                check(batch.action === (job.state === 'undone' ? 'undo' : 'rollback') && batch.position === fence && batch.end_position === fence + 1 && batch.fence === fence + 1, 'slack_journal_mismatch');
                fence++;
            }
            check(fence === job.fence, 'slack_journal_mismatch');
        }
    }
}
