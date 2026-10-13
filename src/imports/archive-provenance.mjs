import { canonicalJson, sha256 } from './kit.ts';
import { effectIdentity } from '../base/modules/import-kit/src/storage/provenance.ts';
const check = (ok, code) => { if (!ok) throw Error(code); };
const equal = (a, b) => canonicalJson(a) === canonicalJson(b);
const ordered = rows => [...rows].sort((a, b) => canonicalJson(a).localeCompare(canonicalJson(b)));

// This adapter only creates new immutable targets, never replaces or reuses an
// existing import. Admission checks the actual Base publication receipts, not
// just a plausible completed state or a copied reviewed plan.
export async function validateSlackProvenance(read, job, plan) {
    check(job.reversal_policy === 'strict' && Number.isSafeInteger(job.checkpoint) && job.checkpoint >= 0 && job.checkpoint <= job.total && (job.state !== 'completed' || job.checkpoint === job.total), 'invalid_slack_checkpoint');
    const completed = job.state === 'completed', provenance = [], claims = [], entries = [], revisions = [];
    for (let ordinal = 0; ordinal < job.checkpoint; ordinal++) {
        const entry = plan.entries[ordinal], effect = entry.effects[0], effectsHash = sha256(canonicalJson(entry.effects));
        if(entry.erased){entries.push({job_id:job.id,ordinal,source_identity:entry.identity,owner_job_id:job.id,effects_hash:effectsHash});if(completed)claims.push({identity:entry.identity,source_hash:entry.source.payloadHash,mapping_version:job.mapping_version,effects_hash:effectsHash,job_id:job.id});continue;}
        const id = effectIdentity(job.id, entry.identity, 0), revision = sha256(canonicalJson([job.id, entry.identity, 0, 'applied']));
        const record = { id, jobId: job.id, sourceIdentity: entry.identity, sourceKind: entry.source.kind, sourceId: entry.source.sourceId, sourceHash: entry.source.payloadHash, artifactHash: entry.source.artifactHash, location: entry.source.location, destination: job.destination, targetKind: effect.targetKind, targetId: effect.targetId, valueHash: sha256(canonicalJson(effect.value)), attachmentHash: null, appliedRevision: revision, before: null, reversed: !completed };
        provenance.push({ id, job_id: job.id, ordinal, effect_ordinal: 0, source_identity: entry.identity, destination: job.destination, target_kind: effect.targetKind, target_id: effect.targetId, reversed: completed ? 0 : 1, record_json: canonicalJson(record) });
        entries.push({ job_id: job.id, ordinal, source_identity: entry.identity, owner_job_id: job.id, effects_hash: effectsHash });
        if (completed) {
            claims.push({ identity: entry.identity, source_hash: entry.source.payloadHash, mapping_version: job.mapping_version, effects_hash: effectsHash, job_id: job.id });
            revisions.push({ destination: job.destination, kind: effect.targetKind, id: effect.targetId, revision });
        }
    }
    for (const [name, expected] of [['ik_provenance', provenance], ['ik_sources', claims], ['ik_d1_entries', entries], ['ik_d1_history', []]]) {
        const actual = (await read(name)).filter(r => r.job_id === job.id);
        check(equal(ordered(expected), ordered(actual)), 'slack_publication_provenance_changed');
    }
    const actualRevisions = await read('nook_import_effect_revisions');
    for (const revision of revisions) check(actualRevisions.some(r => equal(r, revision)), 'slack_effect_revision_changed');
    return revisions;
}
