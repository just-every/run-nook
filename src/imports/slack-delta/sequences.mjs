import { deltaNativeId } from './baseline.mjs';
import { id, invalid, object, timestamp } from './validation.mjs';

/** Recheck the capture's sequence contract before mapping. The server must
 * separately compare baselineDigest with its current authorized baseline. */
export function validatedDeltaSequences(capture) {
    const delta = capture.delta;
    if (!object(delta) || typeof delta.baselineDigest !== 'string' || !/^[a-f0-9]{64}$/.test(delta.baselineDigest)
        || !object(delta.sequences) || !object(delta.retainedSequences) || !Array.isArray(delta.conversations)
        || !Array.isArray(delta.baselineRoots) || Object.keys(delta.sequences).length !== capture.messages.length) invalid('sequence metadata');
    const conversations = new Map();
    for (const conversation of delta.conversations) {
        if (!id(conversation.sourceId) || conversations.has(conversation.sourceId)
            || conversation.conversation !== deltaNativeId(capture.namespace, 'channel', conversation.sourceId)
            || !Number.isSafeInteger(conversation.maxSequence) || conversation.maxSequence < 0
            || conversation.watermark !== null && !timestamp(conversation.watermark)) invalid('sequence conversation');
        conversations.set(conversation.sourceId, conversation);
    }
    const used = new Map();
    for (const message of capture.messages) {
        const sequence = delta.sequences[message.key], max = conversations.get(message.channel)?.maxSequence ?? 0;
        const retained = Object.hasOwn(delta.retainedSequences, message.key) ? delta.retainedSequences[message.key] : null;
        if (!Number.isSafeInteger(sequence) || sequence < 1 || retained !== null && sequence !== retained
            || retained === null && sequence <= max) invalid('message sequence');
        if (!used.has(message.channel)) used.set(message.channel, new Set());
        if (used.get(message.channel).has(sequence)) invalid('duplicate message sequence');
        used.get(message.channel).add(sequence);
    }
    for (const root of delta.baselineRoots) {
        if (!object(root) || root.parent !== null || !timestamp(root.sourceTimestamp)
            || root.key !== `${capture.namespace}:${root.channel}:${root.sourceTimestamp}`
            || root.sequence !== delta.retainedSequences[root.key]) invalid('retained thread root');
    }
    return delta.sequences;
}
