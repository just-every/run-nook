import { importDigest } from '../../family/team-chat/import-capture.mjs';
import { sourceFileRefs } from '../slack-records.mjs';
import { compareSourceTimestamps } from '../timestamps.mjs';

const observationTime = fact => fact.kind === 'snapshot' ? fact.editedAt ?? fact.sourceTimestamp : fact.eventTimestamp;
const semanticRecord = source => ({
    edited: source.edited ? { ts: source.edited.ts, user: source.edited.user ?? null } : null,
    reactions: (source.reactions ?? []).map(reaction => ({ name: reaction.name, count: reaction.count, users: [...reaction.users].sort() }))
        .sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0),
    pinnedTo: [...(source.pinned_to ?? [])].sort()
});
export function sameDeltaMessage(left, right) {
    return left.sourceActor === right.sourceActor && left.sourceTimestamp === right.sourceTimestamp
        && left.body === right.body && left.threadRoot === right.threadRoot
        && importDigest(semanticRecord(left.sourceRecord)) === importDigest(semanticRecord(right.sourceRecord))
        && importDigest(left.files.map(({ sourceId, name, mime, size, sha256 }) => ({ sourceId, name, mime, size, sha256 })))
            === importDigest(right.files.map(({ sourceId, name, mime, size, sha256 }) => ({ sourceId, name, mime, size, sha256 })));
}

/** Collapse one key's supplied observations, rejecting equal-time conflicting
 * bodies. Baseline edit time prevents an older export undoing a newer edit. */
export function latestDeltaState(facts, prior, block) {
    let source = prior?.sourceRecord ?? null;
    let time = prior ? source.edited?.ts ?? prior.sourceTimestamp : null;
    let actor = prior?.sourceActor ?? null;
    let chosen = null, inheritFiles = !!prior;
    const ordered = [...facts].sort((a, b) => compareSourceTimestamps(observationTime(a), observationTime(b))
        || (a.kind === b.kind ? 0 : a.kind === 'snapshot' ? 1 : -1));
    for (const fact of ordered) {
        const nextTime = observationTime(fact);
        if (time !== null && compareSourceTimestamps(nextTime, time) < 0) continue;
        if (actor !== null && fact.sourceActor !== actor) { block('message', fact.key, 'source-author-changed'); return null; }
        if (chosen && compareSourceTimestamps(nextTime, time) === 0 && fact.body !== source.text) {
            block('message', fact.key, 'conflicting-source-state-at-same-time'); return null;
        }
        if (fact.kind === 'edit') {
            const raw = fact.sourceRecord;
            const { subtype, original_ts, previous, editor_id, ...current } = raw;
            const merged = { ...(source ?? {}), ...current, type: 'message', ts: fact.sourceTimestamp,
                text: fact.body, edited: { user: fact.editorId, ts: fact.eventTimestamp } };
            if (!source && raw.bot_id) merged.subtype = 'bot_message';
            inheritFiles = fact.files === null && !!source;
            source = merged;
        } else {
            source = { ...fact.sourceRecord };
            inheritFiles = false;
        }
        if (source.root) source.root = { ts: source.root.ts };
        actor = fact.sourceActor; chosen = fact; time = nextTime;
    }
    if (!chosen) return null;
    // Exact raw log and its original archive location remain separate from the
    // conventional current-message projection required by the existing target.
    source = { ...source, slackDelta: { record: chosen.sourceRecord, provenance: chosen.provenance,
        mutations: ordered.filter(fact => fact.kind === 'edit').map(fact => ({ record: fact.sourceRecord, provenance: fact.provenance })) } };
    return { key: chosen.key, channel: chosen.channel, sourceActor: actor, sourceTimestamp: chosen.sourceTimestamp,
        body: source.text, sourceRecord: source, threadRoot: source.thread_ts && source.thread_ts !== chosen.sourceTimestamp
            ? `${chosen.namespace}:${chosen.channel}:${source.thread_ts}` : null,
        inheritFiles, fact: chosen, fileRefs: sourceFileRefs(source) };
}

export function outsideDeltaOverlap(sourceTimestamp, watermark, overlapDays) {
    if (watermark === null) return false;
    // Beyond the maximum admitted Slack timestamp the whole history is read.
    const overlapMicros = BigInt(Math.round(Math.min(overlapDays, 12000000) * 86400 * 1000000));
    return BigInt(sourceTimestamp.replace('.', '')) < BigInt(watermark.replace('.', '')) - overlapMicros;
}
