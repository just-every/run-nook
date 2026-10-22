import { importDigest } from '../../family/team-chat/import-capture.mjs';
import { sha256 } from '../zip.mjs';
import { sourceActorId, sourceFileRefs } from '../slack-records.mjs';
import { SLACK_FILE_LIMIT } from '../policy.mjs';
import { id, invalid, object, text, timestamp } from './validation.mjs';

export const deltaNativeId = (namespace, kind, key) => 'slack-' + importDigest([namespace, kind, key]).slice(0, 40);

/** Structural/byte admission only. The server must independently re-read this
 * baseline under current owner ACL and compare its digest at plan creation. */
export function readDeltaBaseline(delta, namespace) {
    if (!object(delta) || Object.keys(delta).sort().join() !== 'baseline,overlapDays'
        || !Number.isFinite(delta.overlapDays) || delta.overlapDays < 0
        || !object(delta.baseline) || delta.baseline.namespace !== namespace
        || !Array.isArray(delta.baseline.conversations) || delta.baseline.conversations.length > 50) invalid('baseline');
    const conversations = new Map(), messages = new Map();
    let totalBytes = 0;
    for (const conversation of delta.baseline.conversations) {
        if (!object(conversation) || !id(conversation.sourceId) || conversations.has(conversation.sourceId)
            || conversation.conversation !== deltaNativeId(namespace, 'channel', conversation.sourceId)
            || !Number.isSafeInteger(conversation.maxSequence) || conversation.maxSequence < 0
            || conversation.watermark !== null && !timestamp(conversation.watermark)
            || !Array.isArray(conversation.messages)) invalid('baseline conversation');
        const rows = new Map(), sequences = new Set();
        for (const message of conversation.messages) {
            if (!object(message) || !timestamp(message.sourceTimestamp)
                || message.key !== `${namespace}:${conversation.sourceId}:${message.sourceTimestamp}` || messages.has(message.key)
                || !Number.isSafeInteger(message.sequence) || message.sequence < 1 || message.sequence > conversation.maxSequence
                || sequences.has(message.sequence) || !id(message.sourceActor) || !text(message.body)
                || message.parent !== null && typeof message.parent !== 'string'
                || !object(message.sourceRecord) || message.sourceRecord.type !== 'message'
                || message.sourceRecord.ts !== message.sourceTimestamp || sourceActorId(message.sourceRecord) !== message.sourceActor
                || message.sourceRecord.text !== message.body || !Array.isArray(message.files)) invalid('baseline message');
            const refs = sourceFileRefs(message.sourceRecord), files = [], seenFiles = new Set();
            for (const file of message.files) {
                if (!object(file) || !id(file.sourceId) || seenFiles.has(file.sourceId) || typeof file.name !== 'string'
                    || typeof file.mime !== 'string' || !Number.isSafeInteger(file.size) || file.size < 1 || file.size > SLACK_FILE_LIMIT
                    || typeof file.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(file.sha256)
                    || typeof file.base64 !== 'string' || file.base64.length > Math.ceil(SLACK_FILE_LIMIT / 3) * 4) invalid('baseline file');
                const bytes = Buffer.from(file.base64, 'base64');
                if (bytes.toString('base64') !== file.base64 || bytes.length !== file.size || sha256(bytes) !== file.sha256) invalid('baseline file integrity');
                totalBytes += bytes.length;
                if (totalBytes > 16 * 1024 * 1024) invalid('baseline byte limit');
                const ref = refs.find(ref => ref.id === file.sourceId);
                if (!ref || ref.name !== file.name || ref.mimetype !== file.mime
                    || ref.size !== undefined && ref.size !== file.size || ref.sha256 !== undefined && ref.sha256 !== file.sha256) invalid('baseline file provenance');
                seenFiles.add(file.sourceId);
                files.push({ sourceId: file.sourceId, name: file.name, mime: file.mime, size: file.size, sha256: file.sha256, bytes, sourceRecord: ref });
            }
            const row = { ...message, files, channel: conversation.sourceId };
            rows.set(message.key, row); messages.set(message.key, row); sequences.add(message.sequence);
        }
        conversations.set(conversation.sourceId, { ...conversation, messages: rows });
    }
    const nativeToKey = new Map([...messages.keys()].map(key => [deltaNativeId(namespace, 'message', key), key]));
    for (const message of messages.values()) {
        message.threadRoot = message.parent === null ? null : nativeToKey.get(message.parent);
        if (message.threadRoot === undefined || message.threadRoot && (messages.get(message.threadRoot)?.channel !== message.channel
            || messages.get(message.threadRoot)?.parent !== null)) invalid('baseline thread root');
        const exportedRoot = message.sourceRecord.thread_ts;
        if (exportedRoot !== undefined && !timestamp(exportedRoot)
            || message.threadRoot !== (exportedRoot && exportedRoot !== message.sourceTimestamp
                ? `${namespace}:${message.channel}:${exportedRoot}` : null)) invalid('baseline thread provenance');
    }
    return { conversations, messages, digest: importDigest(delta.baseline) };
}
