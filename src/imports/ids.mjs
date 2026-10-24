import {mattermostNativeId,mattermostCaptureJobId} from './mattermost-effects.mjs';
import {campfireNativeId,campfireCaptureJobId} from './campfire-effects.mjs';
import { isAutomation } from './slack-records.mjs';
import { compareSourceMessages } from './timestamps.mjs';
import { importDigest } from '../family/team-chat/import-capture.mjs';
import { assertSlackCaptureAdmitted, assertSlackEffect } from './policy.mjs';
import { validatedDeltaSequences } from './slack-delta/sequences.mjs';
export const nativeId = (namespace, kind, key) => 'slack-' + importDigest([namespace, kind, key]).slice(0, 40);
export const captureJobId = (capture, uploadId) => capture.sourceType==='gchat'?'gchat-'+importDigest([capture.namespace,'capture',capture.digest+':'+uploadId]).slice(0,40): capture.sourceType==='mattermost'?mattermostCaptureJobId(capture,uploadId):capture.sourceType==='campfire'?campfireCaptureJobId(capture,uploadId):nativeId(capture.namespace, 'capture', capture.digest + ':' + uploadId);
export const captureNativeId=(capture,kind,key)=>capture.sourceType==='mattermost'?mattermostNativeId(capture.namespace,kind,key):capture.sourceType==='campfire'?campfireNativeId(capture.namespace,kind,key):nativeId(capture.namespace,kind,key);
export function fileObjectKey(owner, upload, job, review, file) {
    if (typeof review !== 'string' || !/^[A-Za-z0-9_.-]{1,128}$/.test(review)) throw Error('SLACK_INVALID: review identity required');
    return `private/imports/${owner}/${upload}/files/${job}/${review}/${file}`;
}
export const MAPPING_VERSION = 'nook-slack-immutable-v1';
export function effectInputs(capture, owner, uploadId, reviewId) {
    assertSlackCaptureAdmitted(capture);
    const targetId=(namespace,kind,key)=>capture.sourceType==='gchat'?'gchat-'+importDigest([namespace,kind,key]).slice(0,40):nativeId(namespace,kind,key);
    const deltaSequences = capture.delta ? validatedDeltaSequences(capture) : null;
    const privateMappings=new Map();
    for (const c of capture.channels) if (c.sourceRecord.visibility) {
        const roster=c.sourceRecord.members;
        const mapped=Array.isArray(roster)?roster.map(id=>capture.actors.find(a=>a.sourceId===id)?.association):[];
        for(const uid of roster??[]){const local=capture.actors.find(a=>a.sourceId===uid)?.association,prior=privateMappings.get(local);if(local&&prior&&prior!==uid)throw Error('SLACK_INVALID: injective private identity mapping required');if(local)privateMappings.set(local,uid);}
        if (!mapped.length || mapped.some(id=>!id) || new Set(mapped).size!==mapped.length || importDigest([...mapped].sort())!==importDigest([...c.members].sort())) throw Error('SLACK_INVALID: exact private audience required');
    }
    const domainJob = captureJobId(capture, uploadId), effects = [];
    for (const c of capture.channels)
        effects.push({ kind: 'channel', key: c.sourceId, value: { id: targetId(capture.namespace, 'channel', c.sourceId), job: domainJob, owner: c.sourceRecord.visibility ? c.members[0] : owner, name: c.name, sourceId: c.sourceId, sourceRecord: {...c.sourceRecord,...(c.sourceRecord.visibility?{mappedOwner:c.members[0],mappedMembers:c.members,sourceKind:['dm','group-dm'].includes(c.sourceRecord.visibility)?'dm':'private'}:{})}, members: c.members, guestMembers: c.guestMembers, seq: 0, version: 1, messageCount: 0, kind: ['dm','group-dm'].includes(c.sourceRecord.visibility) ? 'dm' : 'private' } });
    for (const a of capture.actors) {
        if (capture.reviewDigest && isAutomation(a.sourceRecord) && a.association !== null) throw Error('SLACK_INVALID: bot/app identity must remain external');
        effects.push({ kind: 'actor', key: `${domainJob}:${a.sourceId}`, value: { job: domainJob, ...a } });
    }
    const seq = new Map();
    for (const m of [...capture.messages].sort(compareSourceMessages)) {
        const conversation = targetId(capture.namespace, 'channel', m.channel), sequence = deltaSequences ? deltaSequences[m.key] : (seq.get(conversation) ?? 0) + 1;
        seq.set(conversation, sequence);
        const channel=capture.channels.find(c=>c.sourceId===m.channel),fileOwner=channel?.sourceRecord.visibility?channel.members[0]:owner;
        effects.push({ kind: 'message', key: m.key, value: { id: targetId(capture.namespace, 'message', m.key), job: domainJob, owner, conversation, key: m.key, sourceActor: m.sourceActor, sourceTimestamp: m.sourceTimestamp, sourceRecord: m.sourceRecord, body: m.body, parent: m.threadRoot ? targetId(capture.namespace, 'message', m.threadRoot) : null, sequence, ...(m.missingFiles?.length ? { missingFiles: m.missingFiles } : {}), files: m.files.map((f, position) => ({ id: targetId(capture.namespace, 'file', `${m.key}:${f.sourceId}`), sourceId: f.sourceId, name: f.name, mime: f.mime, size: f.size, sha256: f.sha256, position, objectKey: fileObjectKey(owner, uploadId, domainJob, reviewId, targetId(capture.namespace, 'file', `${m.key}:${f.sourceId}`)), state: 'attached', author: fileOwner, expires: 0, created: '1970-01-01T00:00:00.000Z', intent: 'slack:' + targetId(capture.namespace, 'file', `${m.key}:${f.sourceId}`) })) } });
    }
    for (const effect of effects) assertSlackEffect(effect.kind, effect.value);
    return { domainJob, effects };
}
