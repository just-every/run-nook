import {validateMattermostReviewed} from './mattermost-reviewed.mjs';
import {validateCampfireReviewed} from './campfire-reviewed.mjs';
import { missingFileInventory } from './slack-records.mjs';
import { reviewMetadata, captureArtifactName, validateReviewDecisions, actorChoiceMatches } from './review-binding.mjs';
import {validateErasedReviewedPlan} from './archive-erasure.mjs';
import { canonicalJson, sha256 } from './kit.ts';
import { buildImportPlan, planFingerprint } from '../base/modules/import-kit/src/plan/index.ts';
import { originalStorage } from '../base/modules/import-kit/src/d1/original-storage.ts';
import { MAPPING_VERSION, captureJobId } from './ids.mjs';
import { importDigest } from '../family/team-chat/import-capture.mjs';
import { slackMapping } from './source.ts';
import { assertSlackCaptureAdmitted, assertSlackEffect } from './policy.mjs';
const check = (ok, code) => { if (!ok) throw Error(code); };
const equal = (a, b) => canonicalJson(a) === canonicalJson(b);

// Shared immutable binding validation for offline archives and lost-ack recovery.
// It never replans with a changed audience or grants forward authority.
export async function validateReviewedPlan(read, review, job, plan) {
    if(JSON.parse(review.summary_json).sourceType==='mattermost')return validateMattermostReviewed(read,review,job,plan);
    if(JSON.parse(review.summary_json).sourceType==='campfire')return validateCampfireReviewed(read,review,job,plan);
    check(job.mapping_version === MAPPING_VERSION && job.destination === review.owner && job.principal_id === review.owner && job.operation_key === review.id && job.namespace === review.namespace && (plan.erasure?.reviewedFingerprint??job.fingerprint) === review.fingerprint, 'invalid_slack_job_binding');
    check(plan.version === 1 && plan.fingerprint === job.fingerprint && planFingerprint(plan) === job.fingerprint, 'slack_plan_changed');
    if(plan.erasure)return validateErasedReviewedPlan(read,review,job,plan);
    const summary = JSON.parse(review.summary_json);
    const rebuilt = buildImportPlan(plan.source, slackMapping(), { destination: job.destination, namespace: job.namespace, mappingVersion: job.mapping_version, authorization: { principalId: job.principal_id } });
    check(equal(plan, rebuilt), 'slack_canonical_plan_changed');
    assertSlackCaptureAdmitted(summary);
    check(plan.destination === job.destination && plan.principalId === job.principal_id && plan.namespace === job.namespace && plan.mappingVersion === job.mapping_version && plan.entries.length === job.total && (job.state !== 'completed' || job.checkpoint === job.total) && review.domain_job === captureJobId({namespace: review.namespace, digest: summary.captureDigest}, review.upload), 'invalid_slack_plan_binding');
    const version = (await read('ik_original_sets')).filter(r => r.job_id === job.id);
    check(version.length === 1 && version[0].version === 3, 'invalid_slack_original_version');
    const original = originalStorage(plan, job.id, 3), ordered = rows => [...rows].sort((a, b) => canonicalJson(a).localeCompare(canonicalJson(b)));
    check(equal(ordered(original.rows), ordered((await read('ik_originals')).filter(r => r.job_id === job.id))) && equal(ordered(original.chunks), ordered((await read('ik_d1_original_chunks')).filter(r => r.job_id === job.id))), 'slack_original_custody_changed');
    const artifact = plan.source.artifacts[0], bytes = Buffer.from(artifact?.original?.base64 ?? '', 'base64');
    check(plan.source.artifacts.length === 1 && artifact.original.status === 'available' && bytes.length === artifact.size && sha256(bytes) === artifact.sha256, 'slack_reviewed_source_changed');
    const normalized = { ...reviewMetadata(summary), namespace: review.namespace, archiveDigest: summary.archiveDigest, digest: summary.captureDigest, omissions: summary.omissions, effects: plan.source.records.map(r => ({ kind: r.kind, key: r.sourceId, value: r.payload })) };
    check(canonicalJson(normalized) === bytes.toString('utf8') && artifact.name === captureArtifactName(summary), 'slack_reviewed_capture_changed');
    const source = { artifacts: [{ name: artifact.name, sha256: sha256(bytes), size: bytes.length, original: { status: 'available', base64: bytes.toString('base64') } }], diagnostics: [], records: normalized.effects.map((e, row) => ({ namespace: review.namespace, kind: e.kind, sourceId: e.key, payload: e.value, payloadHash: sha256(canonicalJson(e.value)), artifactHash: artifact.sha256, location: { artifact: artifact.name, row } })) };
    check(equal(plan.source, source), 'slack_reviewed_source_changed');
    check(review.id === importDigest([review.owner, review.upload, summary.captureDigest, JSON.parse(review.authority_json)]), 'slack_review_binding_changed');
    check(equal(JSON.parse(review.channels_json), normalized.effects.filter(e => e.kind === 'channel').map(e => ({ sourceId: e.value.sourceId, members: e.value.members }))), 'slack_review_audience_changed');
    const choices = JSON.parse(review.review_json), channels = normalized.effects.filter(e => e.kind === 'channel').map(e => e.value), actors = normalized.effects.filter(e => e.kind === 'actor').map(e => e.value), messages = normalized.effects.filter(e => e.kind === 'message').map(e => e.value);
    validateReviewDecisions(summary, choices, plan);
    check(messages.every(m => !m.missingFiles?.length || choices.importWithoutMissingFiles === true), 'slack_review_choices_changed');
    if (summary.reviewDigest) {
        const missing = messages.flatMap(m => (m.missingFiles ?? []).map(f => ({ key: m.key, ...f })));
        check(importDigest(missingFileInventory(missing)) === summary.missingFileInventoryDigest, 'slack_review_summary_changed');
        check(equal(summary.missingFiles, { count: missing.length, bytes: missing.reduce((sum, f) => sum + (f.size ?? 0), 0), unknownSizes: missing.filter(f => f.size === null).length, accepted: choices.importWithoutMissingFiles === true }), 'slack_review_summary_changed');
    }
    check(choices.namespace === review.namespace && Array.isArray(choices.channels) && equal(choices.channels.map(c => ({...c, members: [...c.members].sort()})), channels.map(c => ({sourceId: c.sourceId, name: c.name, members: c.members}))) && actors.every(a => summary.reviewDigest ? actorChoiceMatches(a, choices, messages, summary.externalActors) : choices.actors?.[a.sourceId] === a.association), 'slack_review_choices_changed');
    check(Array.isArray(choices.acceptedOmissions) && choices.acceptedOmissions.length <= 1 && choices.acceptedOmissions.every(d => typeof d === 'string' && /^[a-f0-9]{64}$/.test(d)) && (summary.omissions.length === 0 || equal(choices.acceptedOmissions, [summary.omissionDigest])) && summary.omissionDigest === importDigest(summary.omissions), 'slack_review_choices_changed');
    check(summary.completeness === 'unknown' && summary.sourceAuthenticityVerified === false && equal(summary.channels, channels.map(c => ({sourceId: c.sourceId, name: c.name, members: c.members, guestMembers: c.guestMembers}))) && equal(summary.actors, actors.map(a => ({sourceId: a.sourceId, association: a.association}))), 'slack_review_summary_changed');
    check(equal(summary.counts, {channels: channels.length, actors: actors.length, messages: messages.length, threads: messages.filter(m => m.parent).length, files: messages.reduce((n, m) => n + m.files.length, 0), bytes: messages.reduce((n, m) => n + m.files.reduce((n, f) => n + f.size, 0), 0), omissions: summary.omissions.length}), 'slack_review_summary_changed');
    const effects = new Map();
    for (const entry of plan.entries) {
        check(!entry.rejection && !entry.erased && entry.effects.length === 1, 'invalid_slack_effect');
        const effect = entry.effects[0];
        assertSlackEffect(effect.targetKind, effect.value);
        check(['channel', 'actor', 'message'].includes(effect.targetKind) && effect.value.job === review.domain_job && equal(effect.value, entry.source.payload), 'invalid_slack_effect');
        const key = effect.targetKind + ':' + effect.targetId;
        check(!effects.has(key), 'duplicate_slack_effect'); effects.set(key, effect.value);
    }
    return { plan, summary, effects };
}
