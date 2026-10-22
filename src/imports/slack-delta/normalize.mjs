import { contentSubtypes, systemSubtypes, sourceActorId, sourceFileRefs, validateMessageMetadata } from '../slack-records.mjs';
import { compareSourceTimestamps } from '../timestamps.mjs';
import { id, invalid, object, sourceContext, text, timestamp } from './validation.mjs';

/** Source facts only. This never reconciles state, chooses a revision, or applies
 * deletion. The original JSON record is retained separately and never rewritten.
 * Its previous/root fields can contain historical bodies: keep this output under
 * raw-upload custody, rather than persisting it as a live/erased projection.
 * Format: https://slack.com/help/articles/220556107-How-to-read-Slack-data-exports */
export function normalizeSlackDeltaRecord(sourceRecord, context) {
    const provenance = sourceContext(context);
    if (!object(sourceRecord)) invalid('record');
    const base = { namespace: provenance.namespace, channel: provenance.channel, sourceRecord, provenance };
    if (sourceRecord.type !== 'message') return { ...base, kind: 'unsupported', reason: 'unsupported-record-type' };
    const mutation = ['message_changed', 'message_deleted'].includes(sourceRecord.subtype);
    if (!mutation && systemSubtypes.has(sourceRecord.subtype)) return { ...base, kind: 'system', subtype: sourceRecord.subtype };
    if (!mutation && sourceRecord.subtype !== undefined && !contentSubtypes.has(sourceRecord.subtype)) {
        return { ...base, kind: 'unsupported', reason: 'unsupported-message-subtype' };
    }
    if (!timestamp(sourceRecord.ts)) invalid('message timestamp');
    const sourceTimestamp = mutation ? sourceRecord.original_ts : sourceRecord.ts;
    // Events API wrappers have different semantics. Do not reinterpret one as an
    // official ZIP log or guess its target from nested previous/message fields.
    if (!timestamp(sourceTimestamp)) invalid('mutation original timestamp');
    if (!text(sourceRecord.text)) invalid('message text');
    if (sourceRecord.user !== undefined && !id(sourceRecord.user)
        || sourceRecord.bot_id !== undefined && !id(sourceRecord.bot_id)) invalid('source actor');
    if (mutation && (!object(sourceRecord.previous) || !text(sourceRecord.previous.text)
        || !id(sourceRecord.editor_id)
        || compareSourceTimestamps(sourceRecord.ts, sourceTimestamp) < 0)) invalid('mutation metadata');
    if (mutation && (sourceRecord.message !== undefined || sourceRecord.previous_message !== undefined
        || sourceRecord.deleted_ts !== undefined)) invalid('mixed mutation formats');
    validateMessageMetadata(sourceRecord);
    if (sourceRecord.edited?.user !== undefined && !id(sourceRecord.edited.user)) invalid('edit actor');
    if (sourceRecord.edited && compareSourceTimestamps(sourceRecord.edited.ts, sourceTimestamp) < 0) invalid('edit timestamp');
    if (sourceRecord.thread_ts !== undefined && !timestamp(sourceRecord.thread_ts)) invalid('thread timestamp');
    if (sourceRecord.latest_reply !== undefined && !timestamp(sourceRecord.latest_reply)) invalid('latest reply timestamp');
    if (sourceRecord.root !== undefined && (!object(sourceRecord.root) || !timestamp(sourceRecord.root.ts)
        || sourceRecord.root.ts !== sourceRecord.thread_ts)) invalid('broadcast root');
    if (sourceRecord.pinned_to !== undefined && (!Array.isArray(sourceRecord.pinned_to)
        || sourceRecord.pinned_to.some(value => !id(value)))) invalid('pins');
    const key = `${provenance.namespace}:${provenance.channel}:${sourceTimestamp}`;
    const identity = { ...base, key, sourceTimestamp, eventTimestamp: sourceRecord.ts };
    if (sourceRecord.subtype === 'message_deleted') {
        if (sourceRecord.text !== '') invalid('deletion text');
        return { ...identity, kind: 'deletion', editorId: sourceRecord.editor_id };
    }
    const sourceActor = sourceActorId(sourceRecord);
    // An editor is not evidence of original authorship.
    if (!id(sourceActor)) invalid('message author');
    const editedAt = mutation ? sourceRecord.ts : sourceRecord.edited?.ts ?? null;
    return {
        ...identity, kind: mutation ? 'edit' : 'snapshot', sourceActor,
        body: sourceRecord.text, editedAt,
        editorId: mutation ? sourceRecord.editor_id : sourceRecord.edited?.user ?? null,
        threadRoot: sourceRecord.thread_ts && sourceRecord.thread_ts !== sourceTimestamp
            ? `${provenance.namespace}:${provenance.channel}:${sourceRecord.thread_ts}` : null,
        latestReplyTimestamp: sourceRecord.latest_reply ?? null,
        // Missing metadata is unknown; it is not an instruction to erase a set.
        reactions: sourceRecord.reactions ?? null, pinnedTo: sourceRecord.pinned_to ?? null,
        files: sourceRecord.files === undefined && sourceRecord.file === undefined ? null : sourceFileRefs(sourceRecord)
    };
}

/** Normalize one admitted conversation day file. Multiple facts for one source
 * key are expected (snapshot, successive edits, deletion) and remain distinct.
 * Array order is provenance, never an assertion of complete source history. */
export function normalizeSlackDeltaRecords(records, context) {
    const entry = sourceContext(context, false);
    if (!Array.isArray(records) || records.length > 100000) invalid('record array');
    return records.map((record, recordIndex) => normalizeSlackDeltaRecord(record, { ...entry, recordIndex }));
}
