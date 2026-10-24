import { importDigest } from '../family/team-chat/import-capture.mjs';
import { contentSubtypes, sourceActorId, sourceFileRefs, missingFileRefs } from './slack-records.mjs';
// Slack's bounded source policy is independent of the native upload limit.
export const SLACK_FILE_LIMIT = 1024 * 1024;
const reject = reason => { throw new Error(`SLACK_INVALID: ${reason}`); };
export function assertSlackFileSize(size) {
    if (!Number.isSafeInteger(size) || size < 1 || size > SLACK_FILE_LIMIT)
        reject('supplied file exceeds the Slack 1 MiB limit or has no bytes');
}
export function assertSlackCaptureAdmitted(capture) {
    if (capture.blocked !== false || !Array.isArray(capture.blockers) || capture.blockers.length)
        reject('selected source history has blocking fidelity failures');
    if (!capture.omissionsAccepted)
        reject('explicit exclusion review required');
    if (capture.missingFiles?.count && capture.missingFiles.accepted !== true) reject('explicit missing-file choice required');
}
/** Check again at mapping and actual D1 target admission. No per-record
 * omission can turn an incomplete selected history into an applied plan. */
export function assertSlackEffect(kind, value) {
    if (kind === 'channel') {
        if (!['private','dm'].includes(value.kind) || !value.members.includes(value.owner))
            reject('new private destination required');
        if (value.sourceRecord?.visibility && (value.sourceRecord.sourceKind!==value.kind || value.sourceRecord.mappedOwner!==value.owner || importDigest(value.sourceRecord.mappedMembers)!==importDigest(value.members))) reject('private source audience binding changed');
    } else if (kind === 'actor') {
        if (value.sourceRecord?.id !== value.sourceId || value.sourceRecord.missingFromExport === true)
            reject('source actor missing from export');
    } else if (kind === 'message') {
        const source = value.sourceRecord, files = sourceFileRefs(source ?? {});
        // Already-applied v1 ordinary records may carry bot_id metadata while
        // retaining their exported user attribution. Do not rewrite old plans.
        // New captures resolve automation before mapping; reviewed choices
        // enforce their external-only association during recovery.
        if (source?.type !== 'message' || source.subtype !== undefined && !contentSubtypes.has(source.subtype) || (sourceActorId(source) !== value.sourceActor && !(source.subtype === undefined && source.user === value.sourceActor)) || source.ts !== value.sourceTimestamp || source.text !== value.body)
            reject('source message fidelity required');
        if (!Array.isArray(files) || !Array.isArray(value.files) || files.length > 5 || new Set(files.map(f => f.id)).size !== files.length)
            reject('all referenced file bytes required');
        const missing = missingFileRefs(source, value.files);
        if (importDigest(missing) !== importDigest(value.missingFiles ?? [])) reject('all referenced file bytes or explicit missing-file declarations required');
        const supplied = files.filter(f => !missing.some(m => m.sourceId === f.id));
        if (supplied.length !== value.files.length) reject('duplicate supplied file identity');
        for (const [position, file] of value.files.entries()) {
            const original = supplied[position];
            assertSlackFileSize(file.size);
            if (!original || original.id !== file.sourceId || original.name !== file.name || original.mimetype !== file.mime || original.size !== undefined && original.size !== file.size || original.sha256 !== undefined && original.sha256 !== file.sha256)
                reject('supplied file provenance mismatch');
        }
    } else reject('unsupported target kind');
}
