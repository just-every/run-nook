import {slackIntegrations} from './slack-integrations.mjs';
import { compareSourceMessages } from './timestamps.mjs';
import { readSlackZip, jsonEntry, sha256, canonicalPath } from './zip.mjs';
import { importDigest } from '../family/team-chat/import-capture.mjs';
import { sourceFiles } from './slack-files.mjs';
import { systemSubtypes, contentSubtypes, isAutomation, actorLabel, sourceActorId, referencedActors, validateMessageMetadata, missingFileInventory } from './slack-records.mjs';
import { captureSlackDeltaArchive } from './slack-delta/capture.mjs';
import { cutoverInvitations } from './slack-cutover.mjs';
const bad = reason => { throw new Error(`SLACK_INVALID: ${reason}`); };
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const id = x => typeof x === 'string' && /^[A-Za-z0-9_.-]{1,128}$/.test(x);
const timestamp = x => typeof x === 'string' && /^\d{1,12}\.\d{6}$/.test(x);
export const normalizedEmail = value => typeof value === 'string' ? value.trim().normalize('NFC').toLowerCase() : '';
function records(value, label, max = 100000) { if (!Array.isArray(value) || value.length > max || value.some(x => !object(x)))
    bad(label); return value; }
function registry(files, path) { return files.has(path) ? records(jsonEntry(files, path), path) : []; }
function identityRows(rows, label) { const seen = new Set(); for (const row of rows) {
    if (!id(row.id) || seen.has(row.id))
        bad(`${label} identity`);
    seen.add(row.id);
} return rows; }
/** All details returned by this function are custodian-only, including omissions. */
export function inspectSlackArchive(bytes, localUsers = []) {
    const archive = readSlackZip(bytes), { files } = archive;
    const users = identityRows(records(jsonEntry(files, 'users.json'), 'users'), 'user');
    for (const user of users)
        if (user.name !== undefined && typeof user.name !== 'string' || user.profile !== undefined && !object(user.profile) || user.profile?.email !== undefined && typeof user.profile.email !== 'string' || ['is_bot', 'is_app_user'].some(key => user[key] !== undefined && typeof user[key] !== 'boolean'))
            bad('user fields');
    const channels = identityRows(records(jsonEntry(files, 'channels.json'), 'channels'), 'channel');
    const excluded = [['groups.json','private'],['dms.json','dm'],['mpims.json','group-dm']].flatMap(([path,visibility]) => registry(files,path).map(c=>({...c,visibility})));
    identityRows([...channels, ...excluded], 'channel export');
    const names = new Set(), omissions = [], candidates = [];
    for (const c of [...channels, ...excluded]) {
        if (typeof c.name === 'string') {
            canonicalPath(c.name);
            if (c.name.includes('/') || c.name === 'files') bad('channel folder');
            const alias = c.name.normalize('NFKC').toLowerCase();
            if (names.has(alias))
                bad('channel folder alias');
            names.add(alias);
        }
    }
    for (const c of channels) {
        if (typeof c.name !== 'string' || !c.name || ['is_private', 'is_im', 'is_mpim'].some(k => c[k] !== undefined && c[k] !== false)) {
            omissions.push({ kind: 'channel', key: c.id, reason: 'private-or-unknown-visibility' });
            continue;
        }
        candidates.push({ ...c });
    }
    for (const c of excluded) {
        if (!Array.isArray(c.members) || c.members.length < (c.visibility === 'private' ? 1 : 2) || c.members.length > 50 || c.members.some(m=>!id(m)) || new Set(c.members).size!==c.members.length) {
            omissions.push({kind:'channel',key:c.id,reason:'private-membership-not-supplied'});
            continue;
        }
        candidates.push({...c,name:c.name ?? c.id});
    }
    for (const c of [...candidates]) if (c.is_shared || c.is_ext_shared || c.is_org_shared) {
        candidates.splice(candidates.indexOf(c),1);
        omissions.push({kind:'channel',key:c.id,reason:'shared-channel-history-not-supported'});
    }
    const recognized = new Set(['users.json', 'channels.json', 'groups.json', 'dms.json', 'mpims.json', 'integration_logs.json']), folders = new Set([...channels, ...excluded].map(c => c.name ?? c.id).filter(x => typeof x === 'string'));
    for (const path of files.keys())
        if (!recognized.has(path) && !path.startsWith('files/') && !folders.has(path.split('/')[0]))
            omissions.push({ kind: 'entry', key: sha256(path), reason: 'unsupported-export-entry' });
    // A bot profile in an actual public-channel post is source identity evidence.
    // An absent human user is never synthesized from a message's user ID.
    const botRows = new Map(), automationIds = new Set(users.filter(isAutomation).map(u => u.id));
    for (const channel of candidates) for (const [path] of files) {
        if (!path.startsWith(`${channel.name}/`) || !/\/\d{4}-\d{2}-\d{2}\.json$/.test(path)) continue;
        for (const message of records(jsonEntry(files, path), 'messages')) {
            if (message.type === 'message' && (message.subtype === 'bot_message' || message.bot_id) && id(sourceActorId(message))) automationIds.add(sourceActorId(message));
            if (message.type !== 'message' || !id(message.bot_id)) continue;
            const profile = message.bot_profile;
            if (message.username !== undefined && typeof message.username !== 'string' || profile !== undefined && (!object(profile) || profile.id !== undefined && profile.id !== message.bot_id || profile.name !== undefined && typeof profile.name !== 'string' || profile.app_id !== undefined && !id(profile.app_id) || profile.icons !== undefined && (!object(profile.icons) || Object.values(profile.icons).some(value => typeof value !== 'string')))) bad('bot profile identity');
            const name = profile?.name ?? message.username;
            if (typeof name === 'string' && name.trim()) {
                const row = { id: message.bot_id, name, is_bot: true, ...(profile ? { bot_profile: profile } : {}) };
                const prior = botRows.get(row.id);
                if (!prior) botRows.set(row.id, row);
            }
        }
    }
    for (const row of botRows.values()) {
        const existing = users.find(u => u.id === row.id);
        if (existing && !isAutomation(existing)) bad('bot identity conflicts with human');
        if (!existing) users.push(row);
    }
    const actors = users.map(u => { const externalOnly = automationIds.has(u.id), email = normalizedEmail(u.profile?.email), matches = !externalOnly && email ? localUsers.filter(x => x.active && normalizedEmail(x.email) === email).map(x => x.id) : []; return { sourceId: u.id, label: actorLabel(u), email, externalOnly, candidates: matches, match: externalOnly ? 'bot/app · external only' : matches.length === 1 ? 'suggested' : matches.length > 1 ? 'ambiguous' : email ? 'unmapped' : 'unknown' }; });
    return { integrations:slackIntegrations(files,users,botRows.values()), archive, users, automationIds, channels: candidates, actors, omissions, completeness: 'unknown', sourceAuthenticityVerified: false };
}
export function captureSlackArchive(inspected, review, ownerId, localUsers) {
    if (review?.delta !== undefined) return captureSlackDeltaArchive({...inspected,channels:inspected.channels.filter(c=>!c.visibility),omissions:[...inspected.omissions,...inspected.channels.filter(c=>c.visibility).map(c=>({kind:'channel',key:c.id,reason:'private-or-direct-export-excluded'}))]}, review, ownerId, localUsers);
    if (!object(review) || Object.keys(review).filter(k => k !== 'importWithoutMissingFiles').sort().join() !== 'acceptedOmissions,actors,channels,namespace' || review.importWithoutMissingFiles !== undefined && typeof review.importWithoutMissingFiles !== 'boolean' || !id(review.namespace) || !Array.isArray(review.channels) || review.channels.length > 50 || !object(review.actors) || Object.entries(review.actors).some(([key, value]) => !id(key) || value !== null && (!id(value) || !localUsers.some(u => u.id === value && u.active))) || !Array.isArray(review.acceptedOmissions) || review.acceptedOmissions.length > 1 || review.acceptedOmissions.some(v => typeof v !== 'string' || !/^[a-f0-9]{64}$/.test(v)))
        bad('review required');
    const { archive, users } = inspected, userById = new Map(users.map(u => [u.id, u])), omissions = [...inspected.omissions], blockers = [], channels = [], messages = [], actors = new Map(), seen = new Set(), selected = new Set(), usedFiles = new Set(), missingFiles = [], skippedKinds = {};
    for (const actor of users) if (!Object.hasOwn(review.actors, actor.id)) bad(`explicit actor decision required: ${actor.id}`);
    const mappedParticipants=new Map(),collisions=new Set();
    for(const choice of review.channels){const source=inspected.channels.find(c=>c.id===choice.sourceId);for(const uid of source?.visibility?source.members:[]){const local=review.actors[uid];if(!local)continue;const previous=mappedParticipants.get(local);if(previous&&previous!==uid){collisions.add(previous);collisions.add(uid)}mappedParticipants.set(local,uid);}}
    for (const choice of review.channels) {
        if (!object(choice) || Object.keys(choice).sort().join() !== 'members,name,sourceId' || selected.has(choice.sourceId))
            bad('channel selection');
        selected.add(choice.sourceId);
        const source = inspected.channels.find(c => c.id === choice.sourceId);
        if (!source)
            bad('selected source channel unavailable');
        const block = (kind, key, reason) => blockers.push({ channel: source.id, kind, key, reason });
        if (typeof choice.name !== 'string' || !choice.name.trim() || choice.name.length > 80 || !Array.isArray(choice.members) || choice.members.length > 50 || (!source.visibility && !choice.members.includes(ownerId)) || new Set(choice.members).size !== choice.members.length || choice.members.some(uid => !localUsers.some(u => u.id === uid && u.active)))
            bad('destination or current audience');
        if (source.visibility) {
            const mapped=source.members.map(uid=>review.actors[uid]);
            if (source.members.some(uid=>collisions.has(uid)) || mapped.some(uid=>!uid) || new Set(mapped).size!==mapped.length || importDigest([...mapped].sort())!==importDigest([...choice.members].sort())) {
                omissions.push({kind:'channel',key:source.id,reason:'private-membership-not-exactly-mapped'});
                continue;
            }
        }
        channels.push({ sourceId: source.id, name: choice.name, members: [...choice.members].sort(), guestMembers: choice.members.filter(uid => localUsers.find(u => u.id === uid)?.mode === 'guest').sort(), sourceRecord: source });
        const days = [...archive.files.keys()].filter(p => p.startsWith(`${source.name}/`));
        if (days.some(p => !new RegExp(`^${source.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/\\d{4}-\\d{2}-\\d{2}\\.json$`).test(p)))
            bad('unsupported channel file');
        const raw = days.sort().flatMap(p => records(jsonEntry(archive.files, p), 'messages')), suppressed = new Set();
        for (const r of raw)
            if (['message_changed', 'message_deleted'].includes(r.subtype)) {
                const targets = [r.deleted_ts, r.message?.ts, r.previous_message?.ts].filter(x => x !== undefined), target = targets[0];
                if (!targets.length || targets.some(x => !timestamp(x)) || new Set(targets).size !== 1)
                    bad('mutation target unavailable or conflicting');
                suppressed.add(target);
                block('message', `${source.id}:${target}`, 'source-change-or-deletion-not-reconstructed');
            }
        for (const r of raw) {
            if (['message_changed', 'message_deleted'].includes(r.subtype))
                continue;
            if (r.type === 'message' && systemSubtypes.has(r.subtype)) {
                skippedKinds[r.subtype] = (skippedKinds[r.subtype] ?? 0) + 1;
                continue;
            }
            if (r.type !== 'message' || r.subtype !== undefined && !contentSubtypes.has(r.subtype)) {
                block('message', timestamp(r.ts) ? `${source.id}:${r.ts}` : `${source.id}:unsupported:${importDigest(r)}`, `unsupported-message-type:${String(r.type)}:subtype:${String(r.subtype ?? '(none)')}`);
                continue;
            }
            if (!timestamp(r.ts))
                bad('message timestamp');
            const key = `${review.namespace}:${source.id}:${r.ts}`;
            if (seen.has(key))
                bad('duplicate source message');
            seen.add(key);
            if (suppressed.has(r.ts)) {
                block('message', `${source.id}:${r.ts}`, 'source-change-or-deletion-not-reconstructed');
                continue;
            }
            if (!id(sourceActorId(r)) || typeof r.text !== 'string' || !r.text.isWellFormed() || r.text.length > 100000 || r.thread_ts !== undefined && !timestamp(r.thread_ts))
                bad('message fields');
            validateMessageMetadata(r);
            if (r.root !== undefined && (!object(r.root) || !timestamp(r.root.ts) || r.root.ts !== r.thread_ts)) bad('broadcast root metadata');
            // The parent record is authoritative. Keeping a second copy of its body
            // inside a broadcast reply would survive erasure of that parent.
            const sourceRecord = r.root ? { ...r, root: { ts: r.root.ts } } : r;
            const actorId = sourceActorId(r), sourceActor = userById.get(actorId);
            if (!sourceActor) {
                block('message', key, 'source-actor-missing-from-export');
                continue;
            }
            const association = inspected.automationIds.has(actorId) ? null : review.actors[actorId];
            actors.set(actorId, { sourceId: actorId, association, sourceRecord: sourceActor });
            for (const ref of referencedActors(r)) if (userById.has(ref) && !actors.has(ref)) {
                const person = userById.get(ref);
                actors.set(ref, { sourceId: ref, association: inspected.automationIds.has(ref) ? null : review.actors[ref], sourceRecord: person });
            }
            const files = sourceFiles(r, archive, block, key, usedFiles, missingFiles, review.importWithoutMissingFiles === true);
            const absent = missingFiles.filter(f => f.key === key).map(({key, ...f}) => f);
            messages.push({ key, channel: source.id, sourceActor: actorId, sourceTimestamp: r.ts, threadRoot: r.thread_ts && r.thread_ts !== r.ts ? `${review.namespace}:${source.id}:${r.thread_ts}` : null, body: r.text, sourceRecord, files, ...(absent.length ? { missingFiles: absent } : {}) });
        }
    }
    if (!channels.length) blockers.push({kind:'channel',key:'selection',reason:'no-publishable-selected-channel'});
    for (const c of inspected.channels)
        if (!selected.has(c.id))
            omissions.push({ kind: 'channel', key: c.id, reason: 'not-selected' });
    for (const path of archive.files.keys())
        if (path.startsWith('files/') && !usedFiles.has(path))
            omissions.push({ kind: 'file', key: sha256(path), reason: 'unselected-or-unreferenced-file' });
    const admitted = new Map(messages.map(m => [m.key, m]));
    let changed = true;
    while (changed) {
        changed = false;
        for (const m of admitted.values())
            if (m.threadRoot && (!admitted.has(m.threadRoot) || admitted.get(m.threadRoot).threadRoot)) {
                admitted.delete(m.key);
                blockers.push({ channel: m.channel, kind: 'message', key: m.key, reason: 'missing-or-unsupported-thread-parent' });
                changed = true;
            }
    }
    const sortedOmissions = [...new Map(omissions.map(x => [`${x.kind}:${x.key}:${x.reason}`, x])).values()].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    const sortedBlockers = [...new Map(blockers.map(x => [`${x.channel}:${x.kind}:${x.key}:${x.reason}`, x])).values()].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    const omissionDigest = importDigest(sortedOmissions), accepted = review.acceptedOmissions.includes(omissionDigest);
    for (const c of channels) for (const uid of c.sourceRecord.visibility ? c.sourceRecord.members : []) {
        const sourceRecord=userById.get(uid);
        if (!sourceRecord || inspected.automationIds.has(uid)) bad('private participant identity unavailable');
        actors.set(uid,{sourceId:uid,association:review.actors[uid],sourceRecord});
    }
    const usedActors = new Set([...channels.flatMap(c=>c.sourceRecord.visibility?c.sourceRecord.members:[]), ...[...admitted.values()].flatMap(m => [m.sourceActor, ...referencedActors(m.sourceRecord)])]);
    const result = { integrations:inspected.integrations, reviewDigest: importDigest(review), skippedKinds, missingFiles: { count: missingFiles.length, bytes: missingFiles.reduce((sum, f) => sum + (f.size ?? 0), 0), unknownSizes: missingFiles.filter(f => f.size === null).length, accepted: review.importWithoutMissingFiles === true }, namespace: review.namespace, archiveDigest: archive.archiveDigest, channels, actors: [...actors.values()].filter(a => usedActors.has(a.sourceId)), messages: [...admitted.values()].sort(compareSourceMessages), omissions: sortedOmissions, omissionDigest, omissionsAccepted: accepted || !sortedOmissions.length, blockers: sortedBlockers, blocked: sortedBlockers.length > 0, completeness: 'unknown', sourceAuthenticityVerified: false };
    result.missingFileInventory = missingFileInventory(missingFiles);
    result.missingFileInventoryDigest = importDigest(result.missingFileInventory);
    result.externalActors = result.actors.filter(a => inspected.automationIds.has(a.sourceId)).map(a => a.sourceId).sort();
    result.counts = { channels: channels.length, actors: result.actors.length, messages: result.messages.length, threads: result.messages.filter(m => m.threadRoot).length, files: result.messages.reduce((n, m) => n + m.files.length, 0), bytes: result.messages.reduce((n, m) => n + m.files.reduce((n, f) => n + f.size, 0), 0), omissions: sortedOmissions.length };
    result.digest = importDigest({ ...result, messages: result.messages.map(m => ({ ...m, files: m.files.map(({ bytes, ...f }) => f) })) });
    // Member names and addresses are pass metadata for the owner's preview, never part of the retained source packet.
    result.cutover = cutoverInvitations({ users, channels, automationIds: inspected.automationIds });
    return result;
}
