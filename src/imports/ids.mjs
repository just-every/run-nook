import {mattermostNativeId,mattermostCaptureJobId} from './mattermost-effects.mjs';
import {campfireNativeId,campfireCaptureJobId} from './campfire-effects.mjs';
import { isAutomation } from './slack-records.mjs';
import { compareSourceMessages } from './timestamps.mjs';
import { importDigest } from '../family/team-chat/import-capture.mjs';
import { assertSlackCaptureAdmitted, assertSlackEffect } from './policy.mjs';
import { validatedDeltaSequences } from './slack-delta/sequences.mjs';
export const nativeId = (namespace, kind, key) => 'slack-' + importDigest([namespace, kind, key]).slice(0, 40);
export const captureJobId = (capture, uploadId) => capture.sourceType==='mattermost'?mattermostCaptureJobId(capture,uploadId):capture.sourceType==='campfire'?campfireCaptureJobId(capture,uploadId):nativeId(capture.namespace, 'capture', capture.digest + ':' + uploadId);
export const captureNativeId=(capture,kind,key)=>capture.sourceType==='mattermost'?mattermostNativeId(capture.namespace,kind,key):capture.sourceType==='campfire'?campfireNativeId(capture.namespace,kind,key):nativeId(capture.namespace,kind,key);
export function fileObjectKey(owner, upload, job, review, file) {
    if (typeof review !== 'string' || !/^[A-Za-z0-9_.-]{1,128}$/.test(review)) throw Error('SLACK_INVALID: review identity required');
    return `private/imports/${owner}/${upload}/files/${job}/${review}/${file}`;
}
export const MAPPING_VERSION = 'nook-slack-immutable-v1';
export function effectInputs(capture, owner, uploadId, reviewId) {
    assertSlackCaptureAdmitted(capture);
    const deltaSequences = capture.delta ? validatedDeltaSequences(capture) : null;
    const domainJob = captureJobId(capture, uploadId), effects = [];
    for (const c of capture.channels)
        effects.push({ kind: 'channel', key: c.sourceId, value: { id: nativeId(capture.namespace, 'channel', c.sourceId), job: domainJob, owner, name: c.name, sourceId: c.sourceId, sourceRecord: c.sourceRecord, members: c.members, guestMembers: c.guestMembers, seq: 0, version: 1, messageCount: 0, kind: 'private' } });
    for (const a of capture.actors) {
        if (capture.reviewDigest && isAutomation(a.sourceRecord) && a.association !== null) throw Error('SLACK_INVALID: bot/app identity must remain external');
        effects.push({ kind: 'actor', key: `${domainJob}:${a.sourceId}`, value: { job: domainJob, ...a } });
    }
    const seq = new Map();
    for (const m of [...capture.messages].sort(compareSourceMessages)) {
        const conversation = nativeId(capture.namespace, 'channel', m.channel), sequence = deltaSequences ? deltaSequences[m.key] : (seq.get(conversation) ?? 0) + 1;
        seq.set(conversation, sequence);
        effects.push({ kind: 'message', key: m.key, value: { id: nativeId(capture.namespace, 'message', m.key), job: domainJob, owner, conversation, key: m.key, sourceActor: m.sourceActor, sourceTimestamp: m.sourceTimestamp, sourceRecord: m.sourceRecord, body: m.body, parent: m.threadRoot ? nativeId(capture.namespace, 'message', m.threadRoot) : null, sequence, ...(m.missingFiles?.length ? { missingFiles: m.missingFiles } : {}), files: m.files.map((f, position) => ({ id: nativeId(capture.namespace, 'file', `${m.key}:${f.sourceId}`), sourceId: f.sourceId, name: f.name, mime: f.mime, size: f.size, sha256: f.sha256, position, objectKey: fileObjectKey(owner, uploadId, domainJob, reviewId, nativeId(capture.namespace, 'file', `${m.key}:${f.sourceId}`)), state: 'attached', author: owner, expires: 0, created: '1970-01-01T00:00:00.000Z', intent: 'slack:' + nativeId(capture.namespace, 'file', `${m.key}:${f.sourceId}`) })) } });
    }
    for (const effect of effects) assertSlackEffect(effect.kind, effect.value);
    return { domainJob, effects };
}
