import { compareSourceTimestamps } from '../timestamps.mjs';
import { id, invalid, object, timestamp } from './validation.mjs';

const order = (left, right) => left < right ? -1 : left > right ? 1 : 0;

/** Inventory observed ZIP facts, including imported conversations with no rows.
 * Slack ZIP folders/date ranges do not prove a complete re-read: retention and
 * export scope may omit messages, edits, deletions, or replies to older threads.
 * An explicit deletion log proves only that the supplied export reports that
 * one deletion. This API never returns absence-based deletion candidates or a
 * newly verified frontier. Last verification is retained from caller state. */
export function analyzeSlackZipCoverage({ namespace, records, conversations = [] }) {
    if (!id(namespace) || !Array.isArray(records) || !Array.isArray(conversations)) invalid('coverage inputs');
    const channels = new Map();
    const channel = sourceId => {
        if (!id(sourceId)) invalid('coverage conversation');
        if (!channels.has(sourceId)) channels.set(sourceId, {
            channel: sourceId, status: 'unverified', completeness: 'unknown',
            sourceAuthenticityVerified: false, reason: 'zip-does-not-prove-complete-source-range',
            lastVerifiedAt: null, observedFirstTimestamp: null, observedThroughTimestamp: null,
            snapshots: 0, edits: 0, deletionMarkers: 0, replies: 0,
            reactionSnapshots: 0, systemRecords: 0, unsupportedRecords: 0,
            observedEntries: new Set(), explicitDeletionKeys: new Set()
        });
        return channels.get(sourceId);
    };
    const seen = new Set();
    for (const conversation of conversations) {
        if (!object(conversation) || seen.has(conversation.channel)
            || conversation.lastVerifiedAt !== undefined && conversation.lastVerifiedAt !== null
            && !timestamp(conversation.lastVerifiedAt)) invalid('prior verification');
        seen.add(conversation.channel);
        channel(conversation.channel).lastVerifiedAt = conversation.lastVerifiedAt ?? null;
    }
    for (const record of records) {
        if (!object(record) || record.namespace !== namespace || !object(record.provenance)
            || record.provenance.namespace !== namespace || record.provenance.channel !== record.channel
            || typeof record.provenance.entryPath !== 'string') invalid('coverage source record');
        const row = channel(record.channel);
        row.observedEntries.add(record.provenance.entryPath);
        if (record.kind === 'system') { row.systemRecords++; continue; }
        if (record.kind === 'unsupported') { row.unsupportedRecords++; continue; }
        if (!['snapshot', 'edit', 'deletion'].includes(record.kind)
            || !timestamp(record.sourceTimestamp) || !timestamp(record.eventTimestamp)
            || record.key !== `${namespace}:${record.channel}:${record.sourceTimestamp}`) invalid('coverage normalized record');
        const first = record.sourceTimestamp;
        const through = record.kind === 'snapshot' ? record.editedAt ?? record.eventTimestamp : record.eventTimestamp;
        if (!timestamp(through)) invalid('coverage observation timestamp');
        if (row.observedFirstTimestamp === null || compareSourceTimestamps(first, row.observedFirstTimestamp) < 0) row.observedFirstTimestamp = first;
        if (row.observedThroughTimestamp === null || compareSourceTimestamps(through, row.observedThroughTimestamp) > 0) row.observedThroughTimestamp = through;
        if (record.kind === 'deletion') {
            row.deletionMarkers++;
            row.explicitDeletionKeys.add(record.key);
        } else {
            if (record.kind === 'edit' || record.editedAt !== null) row.edits++;
            if (record.kind === 'snapshot') row.snapshots++;
            if (record.threadRoot !== null) row.replies++;
            if (record.reactions !== null) row.reactionSnapshots++;
        }
    }
    return {
        namespace, completeness: 'unknown', sourceAuthenticityVerified: false,
        conversations: [...channels.values()].sort((a, b) => order(a.channel, b.channel)).map(row => ({
            ...row, observedEntries: [...row.observedEntries].sort(order),
            explicitDeletionKeys: [...row.explicitDeletionKeys].sort(order)
        }))
    };
}
