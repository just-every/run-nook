import { importDigest } from '../../family/team-chat/import-capture.mjs';
import { jsonEntry, sha256 } from '../zip.mjs';
import { compareSourceMessages } from '../timestamps.mjs';
import { sourceFiles, suppliedFilePath } from '../slack-files.mjs';
import { actorLabel, referencedActors, missingFileInventory } from '../slack-records.mjs';
import { normalizeSlackDeltaRecords } from './normalize.mjs';
import { analyzeSlackZipCoverage } from './coverage.mjs';
import { readDeltaBaseline } from './baseline.mjs';
import { latestDeltaState, outsideDeltaOverlap, sameDeltaMessage } from './state.mjs';
import { id, invalid, object } from './validation.mjs';
import { cutoverInvitations } from '../slack-cutover.mjs';

const uniqueSorted = values => [...new Map(values.map(value => [importDigest(value), value])).values()]
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));

/** Conditional ZIP-only delta capture. The baseline is an owner-authorized
 * input, never a source-completeness attestation or an authority grant. */
export function captureSlackDeltaArchive(inspected, review, ownerId, localUsers) {
    if (!object(review) || Object.keys(review).filter(key => !['delta', 'importWithoutMissingFiles'].includes(key)).sort().join() !== 'acceptedOmissions,actors,channels,namespace'
        || !id(review.namespace) || !Array.isArray(review.channels) || review.channels.length > 50
        || !object(review.actors) || Object.entries(review.actors).some(([key, value]) => !id(key)
            || value !== null && (!id(value) || !localUsers.some(user => user.id === value && user.active)))
        || !Array.isArray(review.acceptedOmissions) || review.acceptedOmissions.length > 1
        || review.acceptedOmissions.some(value => typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value))
        || review.importWithoutMissingFiles !== undefined && typeof review.importWithoutMissingFiles !== 'boolean') invalid('review');
    const baseline = readDeltaBaseline(review.delta, review.namespace);
    const { archive, users } = inspected, userById = new Map(users.map(user => [user.id, user]));
    const omissions = [...inspected.omissions], blockers = [], channels = [], messages = [], selected = new Set();
    const actors = new Map(), usedFiles = new Set(), missingFiles = [], skippedKinds = {}, facts = [], skipped = [];
    const explicitDeletions = [], sequences = {}, baselineRoots = new Map();
    for (const user of users) if (!Object.hasOwn(review.actors, user.id)) invalid('explicit actor decision required');
    const addActor = sourceId => {
        const sourceRecord = userById.get(sourceId);
        if (sourceRecord) actors.set(sourceId, { sourceId, association: inspected.automationIds.has(sourceId) ? null : review.actors[sourceId], sourceRecord });
    };
    for (const choice of review.channels) {
        if (!object(choice) || Object.keys(choice).sort().join() !== 'members,name,sourceId' || selected.has(choice.sourceId)) invalid('channel selection');
        const source = inspected.channels.find(channel => channel.id === choice.sourceId);
        if (!source) invalid('selected source channel unavailable');
        if (['is_shared', 'is_ext_shared', 'is_org_shared'].some(key => source[key] !== undefined && source[key] !== false)) {
            selected.add(source.id); omissions.push({ kind: 'channel', key: source.id, reason: 'shared-channel-delta-excluded' }); continue;
        }
        if (typeof choice.name !== 'string' || !choice.name.trim() || choice.name.length > 80
            || !Array.isArray(choice.members) || choice.members.length > 50 || !choice.members.includes(ownerId)
            || new Set(choice.members).size !== choice.members.length
            || choice.members.some(uid => !localUsers.some(user => user.id === uid && user.active))) invalid('destination or current audience');
        selected.add(source.id);
        channels.push({ sourceId: source.id, name: choice.name, members: [...choice.members].sort(),
            guestMembers: choice.members.filter(uid => localUsers.find(user => user.id === uid)?.mode === 'guest').sort(), sourceRecord: source });
        const block = (kind, key, reason) => blockers.push({ channel: source.id, kind, key, reason });
        const days = [...archive.files.keys()].filter(path => path.startsWith(`${source.name}/`)).sort();
        const groups = new Map();
        for (const entryPath of days) {
            if (!/^\d{4}-\d{2}-\d{2}\.json$/.test(entryPath.slice(source.name.length + 1))) invalid('unsupported channel file');
            const normalized = normalizeSlackDeltaRecords(jsonEntry(archive.files, entryPath), {
                namespace: review.namespace, channel: source.id, archiveDigest: archive.archiveDigest, entryPath
            });
            facts.push(...normalized);
            for (const fact of normalized) {
                if (fact.kind === 'system') { skippedKinds[fact.subtype] = (skippedKinds[fact.subtype] ?? 0) + 1; continue; }
                if (fact.kind === 'unsupported') { block('message', `${source.id}:unsupported:${importDigest(fact.sourceRecord)}`, fact.reason); continue; }
                if (fact.kind === 'deletion') {
                    explicitDeletions.push({ key: fact.key, channel: source.id, sourceTimestamp: fact.sourceTimestamp,
                        eventTimestamp: fact.eventTimestamp, editorId: fact.editorId, provenance: fact.provenance,
                        status: 'unverified', reason: 'zip-deletion-does-not-prove-complete-range' });
                    skipped.push({ key: fact.key, reason: 'explicit-deletion-unverified' }); continue;
                }
                if (!groups.has(fact.key)) groups.set(fact.key, []);
                groups.get(fact.key).push(fact);
            }
        }
        for (const [key, observations] of groups) {
            const prior = baseline.messages.get(key), state = latestDeltaState(observations, prior, block);
            if (!state) { skipped.push({ key, reason: 'older-than-current-source-edit' }); continue; }
            if (!userById.has(state.sourceActor)) { block('message', key, 'source-actor-missing-from-export'); continue; }
            // Reuse only hash-checked baseline bytes matching the current source
            // references. No URL fetch, fabricated metadata, or source fallback.
            const fileArchive = { ...archive, files: new Map(archive.files) };
            for (const ref of state.fileRefs) {
                if (suppliedFilePath(ref, fileArchive)) continue;
                const retained = prior?.files.find(file => file.sourceId === ref.id && file.name === ref.name && file.mime === ref.mimetype
                    && (ref.size === undefined || file.size === ref.size) && (ref.sha256 === undefined || file.sha256 === ref.sha256));
                if (retained) fileArchive.files.set(`files/${ref.id}/${ref.name}`, retained.bytes);
            }
            const files = sourceFiles(state.sourceRecord, fileArchive, block, key, usedFiles, missingFiles, review.importWithoutMissingFiles === true);
            const absent = missingFiles.filter(file => file.key === key).map(({ key, ...file }) => file);
            let message = { key, channel: source.id, sourceActor: state.sourceActor, sourceTimestamp: state.sourceTimestamp,
                threadRoot: state.threadRoot, body: state.body, sourceRecord: state.sourceRecord, files,
                ...(absent.length ? { missingFiles: absent } : {}) };
            if (prior && sameDeltaMessage(prior, message)) {
                if (outsideDeltaOverlap(message.sourceTimestamp, baseline.conversations.get(source.id).watermark, review.delta.overlapDays)) {
                    skipped.push({ key, reason: 'unchanged-outside-overlap' }); continue;
                }
                message = { ...message, sourceRecord: prior.sourceRecord };
                skipped.push({ key, reason: 'unchanged-reread' });
            }
            messages.push(message); addActor(message.sourceActor);
            for (const actor of referencedActors(message.sourceRecord)) addActor(actor);
        }
    }
    if (!channels.length) invalid('select at least one supported public channel');
    for (const source of inspected.channels) if (!selected.has(source.id)) omissions.push({ kind: 'channel', key: source.id, reason: 'not-selected' });
    for (const path of archive.files.keys()) if (path.startsWith('files/') && !usedFiles.has(path)) omissions.push({ kind: 'file', key: sha256(path), reason: 'unselected-or-unreferenced-file' });
    const admitted = new Map(messages.map(message => [message.key, message]));
    for (const message of admitted.values()) if (message.threadRoot) {
        const root = admitted.get(message.threadRoot) ?? baseline.messages.get(message.threadRoot);
        if (!root || root.threadRoot) { admitted.delete(message.key); blockers.push({ channel: message.channel, kind: 'message', key: message.key, reason: 'missing-or-unsupported-thread-parent' }); }
        else if (!admitted.has(root.key)) baselineRoots.set(root.key, { key: root.key, channel: root.channel, sourceTimestamp: root.sourceTimestamp,
            parent: root.parent, sequence: root.sequence });
    }
    const sortedMessages = [...admitted.values()].sort(compareSourceMessages), nextSequence = new Map();
    for (const message of sortedMessages) {
        const prior = baseline.messages.get(message.key), conversation = baseline.conversations.get(message.channel);
        const sequence = prior?.sequence ?? (nextSequence.get(message.channel) ?? conversation?.maxSequence ?? 0) + 1;
        if (!prior) nextSequence.set(message.channel, sequence);
        sequences[message.key] = sequence;
    }
    const coverage = analyzeSlackZipCoverage({ namespace: review.namespace, records: facts,
        conversations: [...new Set([...baseline.conversations.keys(), ...channels.map(channel => channel.sourceId)])].map(channel => ({ channel })) });
    const sortedOmissions = uniqueSorted(omissions), sortedBlockers = uniqueSorted(blockers), omissionDigest = importDigest(sortedOmissions);
    const usedActors = new Set(sortedMessages.flatMap(message => [message.sourceActor, ...referencedActors(message.sourceRecord)]));
    const result = { reviewDigest: importDigest(review), skippedKinds,
        missingFiles: { count: missingFiles.length, bytes: missingFiles.reduce((sum, file) => sum + (file.size ?? 0), 0), unknownSizes: missingFiles.filter(file => file.size === null).length, accepted: review.importWithoutMissingFiles === true },
        namespace: review.namespace, archiveDigest: archive.archiveDigest, channels, actors: [...actors.values()].filter(actor => usedActors.has(actor.sourceId)),
        messages: sortedMessages, omissions: sortedOmissions, omissionDigest, omissionsAccepted: !sortedOmissions.length || review.acceptedOmissions.includes(omissionDigest),
        blockers: sortedBlockers, blocked: !!sortedBlockers.length, completeness: 'unknown', sourceAuthenticityVerified: false,
        delta: { overlapDays: review.delta.overlapDays, baselineDigest: baseline.digest,
            conversations: [...baseline.conversations.values()].map(({ sourceId, conversation, maxSequence, watermark }) => ({ sourceId, conversation, maxSequence, watermark })),
            sequences, retainedSequences: Object.fromEntries([...baseline.messages.values()].map(message => [message.key, message.sequence])),
            baselineRoots: [...baselineRoots.values()], coverage, explicitDeletions: uniqueSorted(explicitDeletions), skipped: uniqueSorted([...skipped,...sortedOmissions.map(omission=>({key:omission.kind+':'+omission.key,reason:omission.reason}))]),
            memberPreview: users.map(user => ({ sourceId: user.id, label: actorLabel(user), newToHistory:!new Set(review.delta.baseline.members??[]).has(user.id), status: user.deleted === true ? 'deactivated' : user.deleted === false ? 'active' : 'unknown', externalOnly: inspected.automationIds.has(user.id) })) }
    };
    result.delta.counts = { added: sortedMessages.filter(message => !baseline.messages.has(message.key)).length,
        revised: sortedMessages.filter(message => baseline.messages.has(message.key) && !sameDeltaMessage(baseline.messages.get(message.key), message)).length,
        tombstoned: 0, unverified: coverage.conversations.length, explicitDeletionMarkers: result.delta.explicitDeletions.length, skipped: result.delta.skipped.length };
    result.missingFileInventory = missingFileInventory(missingFiles); result.missingFileInventoryDigest = importDigest(result.missingFileInventory);
    result.externalActors = result.actors.filter(actor => inspected.automationIds.has(actor.sourceId)).map(actor => actor.sourceId).sort();
    result.counts = { channels: channels.length, actors: result.actors.length, messages: sortedMessages.length, threads: sortedMessages.filter(message => message.threadRoot).length,
        files: sortedMessages.reduce((sum, message) => sum + message.files.length, 0), bytes: sortedMessages.reduce((sum, message) => sum + message.files.reduce((n, file) => n + file.size, 0), 0), omissions: sortedOmissions.length };
    result.digest = importDigest({ ...result, messages: result.messages.map(message => ({ ...message, files: message.files.map(({ bytes, ...file }) => file) })) });
    // Member names and addresses are pass metadata for the owner's preview, never part of the retained source packet.
    result.cutover = cutoverInvitations({ users, channels, automationIds: inspected.automationIds });
    return result;
}
