import { sourceFileRefs } from './slack-records.mjs';
import { assertSlackEffect } from './policy.mjs';
import { canonicalJson, sha256 } from './kit.ts';
const check = (ok, code) => { if (!ok) throw Error(code); };
const equal = (a, b) => canonicalJson(a) === canonicalJson(b);
/** Source fields and complete file bindings are admitted only against the retained,
 * reviewed Base effects. Original capture imports keep their existing checks. */
export function validateSlackArchiveRecords(proofs, tables) {
    const rows = name => tables['nook_' + name], validated = new Set();
    const groups = name => { const map = new Map(); for (const row of rows(name)) { if (!map.has(row.job)) map.set(row.job, []); map.get(row.job).push(row); } return map; };
    const channelGroups = groups('import_channels'), actorGroups = groups('import_actors'), messageGroups = groups('import_records');
    const envelopes = new Map(rows('imports').map(j => [j.id, j])), attachments = new Map(rows('attachments').map(f => [f.id, f])), fileGroups = new Map();
    for (const file of rows('import_files')) { if (!fileGroups.has(file.message)) fileGroups.set(file.message, []); fileGroups.get(file.message).push(file); }
    for (const proof of proofs.values()) {
        const { job, review, effects, summary } = proof, domain = review.domain_job;
        const envelope = envelopes.get(domain);
        if (['undone', 'rolled_back'].includes(job.state)) { check(!envelope || envelope.intent !== review.id, 'undone_slack_history_retained'); continue; }
        check(envelope && envelope.state === 'complete' && envelope.intent === review.id && envelope.owner === review.owner && envelope.namespace === review.namespace && envelope.plan_digest === review.fingerprint && envelope.capture_digest === summary.captureDigest && envelope.preview_digest === summary.captureDigest, 'slack_history_envelope_changed');
        const channels = channelGroups.get(domain) ?? [], actors = actorGroups.get(domain) ?? [], messages = (messageGroups.get(domain) ?? []).filter(m=>!m.erased);
        check(channels.length + actors.length + messages.length === effects.size, 'slack_history_count_changed');
        for (const channel of channels) {
            const v = effects.get('channel:' + channel.conversation);
            check(v && channel.source_id === v.sourceId && equal(JSON.parse(channel.source_record), v.sourceRecord), 'slack_channel_provenance_changed');
        }
        for (const actor of actors) {
            const v = effects.get('actor:' + domain + ':' + actor.source_id);
            check(v && actor.association === v.association && equal(JSON.parse(actor.source_record), v.sourceRecord), 'slack_actor_provenance_changed');
        }
        for (const message of messages) {
            const v = effects.get('message:' + message.id);
            check(v && message.conversation === v.conversation && message.key === v.key && message.source_actor === v.sourceActor && message.source_timestamp === v.sourceTimestamp && equal(JSON.parse(message.source_record), v.sourceRecord) && message.body === v.body && message.parent === v.parent && message.sequence === v.sequence, 'slack_message_provenance_changed');
            const bindings = fileGroups.get(message.id) ?? [];
            check(bindings.length === v.files.length, 'slack_file_count_changed');
            for (const expected of v.files) {
                const binding = bindings.find(f => f.id === expected.id), file = attachments.get(expected.id);
                check(binding && file && binding.source_id === expected.sourceId && binding.attachment === file.id && binding.position === expected.position && file.object_key === expected.objectKey && file.size === expected.size && file.sha256 === expected.sha256 && file.mime === expected.mime && file.name === expected.name && file.author === expected.author && file.expires === expected.expires && file.created === expected.created && file.intent === expected.intent, 'slack_file_provenance_changed');
                const source = sourceFileRefs(v.sourceRecord).find(f => f.id === expected.sourceId);
                check(source && source.name === file.name && source.mimetype === file.mime && (source.size === undefined || source.size === file.size), 'slack_source_file_changed');
            }
            assertSlackEffect('message', v);
        }
        check(Array.isArray(summary.omissions) && sha256(canonicalJson(summary.omissions)) === summary.omissionDigest, 'slack_omission_digest_changed');
        check(!validated.has(domain), 'duplicate_slack_domain_job');
        validated.add(domain);
    }
    // Slack destinations are stable IDs; removing review/job custody must not
    // downgrade their rows into the older source-capture import path.
    for (const envelope of envelopes.values()) if (envelope.id.startsWith('slack-')) check(validated.has(envelope.id), 'slack_history_without_completed_job');
    return validated;
}
