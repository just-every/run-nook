import { createHash } from 'node:crypto';
import { importDigest } from '../family/team-chat/import-capture.mjs';

export const mattermostCheck = (ok, reason) => { if (!ok) throw Error(`MATTERMOST_INVALID: ${reason}`); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const mattermostId = value => typeof value === 'string' && /^[A-Za-z0-9_.-]{1,128}$/.test(value);
const hex = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const same = (a, b) => importDigest(a) === importDigest(b);

export function assertMattermostSource(source) {
  mattermostCheck(object(source) && source.implementation === 'mattermost-server' && source.generator === 'mattermost-server' && source.format === 1 && typeof source.version === 'string' && source.version.length <= 256 && /^12\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?(?: \([^\r\n]*\))?$/.test(source.version) && typeof source.createdAt === 'string' && Number.isFinite(Date.parse(source.createdAt)) && Array.isArray(source.roleInventory) && Number.isSafeInteger(source.teamCount) && source.teamCount >= 0, 'unsupported source declaration');
  mattermostCheck(object(source.recordCounts)&&Object.values(source.recordCounts).every(n=>Number.isSafeInteger(n)&&n>=0)&&Number.isSafeInteger(source.sourceRecords)&&source.sourceRecords===1+Object.values(source.recordCounts).reduce((n,v)=>n+v,0),'source record reconciliation');
  mattermostCheck(source.roleInventory.every(mattermostId) && same(source.roleInventory, [...new Set(source.roleInventory)].sort()), 'source role inventory');
}
export function assertMattermostRoles(roles, inventory) {
  mattermostCheck(object(roles) && same(Object.keys(roles).sort(), inventory) && Object.values(roles).every(value => value === 'historical-only'), 'explicit historical-only decision for every source role');
}
export function mattermostTimestamp(value) {
  mattermostCheck(typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?Z$/.test(value), 'source timestamp');
  const seconds = Date.parse(value.slice(0, 19) + 'Z') / 1000;
  mattermostCheck(Number.isSafeInteger(seconds) && seconds >= 0 && new Date(seconds * 1000).toISOString().slice(0, 19) === value.slice(0, 19), 'source timestamp');
  return `${seconds}.${(value.match(/\.(\d+)/)?.[1] ?? '').padEnd(6, '0')}`;
}
export function assertMattermostFileSize(size) { mattermostCheck(Number.isSafeInteger(size) && size > 0 && size <= 16 * 1024 * 1024, 'original file size'); }
export function assertMattermostFileMetadata(file) {
  assertMattermostFileSize(file.size);
  mattermostCheck(typeof file.name === 'string' && file.name.trim() === file.name && file.name.length > 0 && file.name.length <= 120 && !/[\x00-\x1f\x7f\\/<>:"|?*]/.test(file.name), 'original filename');
  mattermostCheck(typeof file.mime === 'string' && file.mime.length <= 255 && /^[A-Za-z0-9!#$&^_.+-]+\/[A-Za-z0-9!#$&^_.+-]+$/.test(file.mime) && hex(file.sha256) && mattermostId(file.sourceId), 'original MIME or hash');
}
export function assertMattermostCaptureAdmitted(capture) {
  mattermostCheck(capture.sourceType === 'mattermost' && capture.blocked === false && Array.isArray(capture.blockers) && capture.blockers.length === 0 && capture.omissionsAccepted === true, 'unapproved capture');
  assertMattermostSource(capture.source);
  assertMattermostRoles(capture.roles, capture.source.roleInventory);
  mattermostCheck(capture.rolesDigest === importDigest(capture.roles), 'role decisions digest');
}
export function mattermostDurableCapture(capture) {
  const { digest, ...rest } = capture;
  return { ...rest, messages: capture.messages.map(message => ({ ...message, files: message.files.map(({ bytes, ...file }) => file) })) };
}
export const mattermostCaptureDigest = capture => importDigest(mattermostDurableCapture(capture));
const normalizedEmail = email => typeof email === 'string' ? email.trim().normalize('NFC').toLowerCase() : '';
export function publicMattermostInspection(inspected, users) {
  assertMattermostSource(inspected.source);
  const participants = new Set(inspected.rooms.flatMap(room => room.members)), saved = new Set(inspected.messages.flatMap(message => message.sourceRecord.flagged_by));
  return {
    sourceType: 'mattermost', source: inspected.source,
    channels: inspected.rooms.map(room => ({ sourceId: room.id, name: room.name, visibility: room.kind, kind: room.kind, sourceMembers: room.members, sourceCreator: room.creator })),
    actors: inspected.users.map(user => {
      const email = normalizedEmail(user.email), candidates = user.externalOnly ? [] : users.filter(local => local.active && local.mode === 'member' && email && normalizedEmail(local.email) === email).map(local => local.id);
      return { sourceId: user.id, label: user.name, email, externalOnly: user.externalOnly, active: user.active, participant: participants.has(user.id), required: participants.has(user.id) || saved.has(user.id), candidates, match: candidates.length === 1 ? 'suggested' : candidates.length > 1 ? 'ambiguous' : 'unmapped' };
    }),
    roleInventory: inspected.source.roleInventory, roles: inspected.source.roleInventory.map(sourceRole => ({ sourceRole, decision: 'historical-only' })),
    counts: inspected.counts, omissions: inspected.omissions, completeness: 'unknown', sourceAuthenticityVerified: false,
  };
}
export function mattermostCounts(capture) {
  return {
    channels: capture.channels.length, actors: capture.actors.length, messages: capture.messages.length,
    threads: capture.messages.filter(message => message.threadRoot).length,
    files: capture.messages.reduce((sum, message) => sum + message.files.length, 0),
    bytes: capture.messages.reduce((sum, message) => sum + message.files.reduce((n, file) => n + file.size, 0), 0),
    omissions: capture.omissions.length,
    teams: capture.source.teamCount,
    sourceRecords:capture.source.sourceRecords,
    deletedRecords:capture.omissions.filter(o=>o.reason==='deleted-source-post'||o.reason==='deleted-source-channel').length,
    unsupportedRecords:capture.omissions.filter(o=>o.reason==='unsupported-record-type').length,
    emoji: capture.channels.reduce((sum, channel) => sum + channel.sourceRecord.emojiCatalog.length, 0),
    reactions: capture.messages.reduce((sum, message) => sum + message.sourceRecord.reactions.length, 0),
    saved: capture.messages.reduce((sum, message) => sum + message.sourceRecord.flagged_by.length, 0),
    pinned: capture.messages.filter(message => message.sourceRecord.is_pinned).length,
  };
}
function emojiCatalog(emojis) {
  mattermostCheck(Array.isArray(emojis), 'custom emoji inventory');
  const names = new Set();
  return emojis.map(emoji => {
    mattermostCheck(typeof emoji.name === 'string' && /^[A-Za-z0-9_+-]{1,128}$/.test(emoji.name) && !names.has(emoji.name), 'custom emoji name');
    names.add(emoji.name);
    mattermostCheck(emoji.bytes instanceof Uint8Array && emoji.bytes.length === emoji.size && hex(emoji.sha256) && createHash('sha256').update(emoji.bytes).digest('hex') === emoji.sha256, 'custom emoji bytes');
    mattermostCheck(typeof emoji.mime === 'string' && /^image\/(png|jpeg|gif|webp)$/.test(emoji.mime) && typeof emoji.path === 'string', 'custom emoji metadata');
    return { name: emoji.name, mime: emoji.mime, base64: Buffer.from(emoji.bytes).toString('base64'), sha256: emoji.sha256, size: emoji.size, path: emoji.path };
  });
}
export function captureMattermostBackup(inspected, review, importer, users) {
  const check = mattermostCheck;
  assertMattermostSource(inspected.source);
  check(object(review) && Object.keys(review).sort().join() === 'acceptedOmissions,actors,namespace,roles' && mattermostId(review.namespace) && object(review.actors) && Array.isArray(review.acceptedOmissions) && review.acceptedOmissions.length <= 1 && review.acceptedOmissions.every(hex), 'review fields');
  assertMattermostRoles(review.roles, inspected.source.roleInventory);
  check(mattermostId(importer) && users.some(user => user.id === importer && user.active && user.mode === 'member'), 'current importer');
  const participants = new Set([...inspected.rooms.flatMap(room => room.members), ...inspected.messages.flatMap(message => message.sourceRecord.flagged_by)]), local = new Map(users.map(user => [user.id, user])), mapped = new Set();
  check(new Set(inspected.users.map(user => user.id)).size === inspected.users.length && same(Object.keys(review.actors).sort(), inspected.users.map(user => user.id).sort()), 'explicit decision for every source identity');
  const actors = inspected.users.map(user => {
    const association = review.actors[user.id];
    check(mattermostId(user.id) && (association === null || mattermostId(association)), 'identity mapping');
    check(!participants.has(user.id) || association !== null, 'every participant needs a full member');
    if (association !== null) {
      const person = local.get(association);
      check(person?.active && person.mode === 'member' && !mapped.has(association), 'active injective full-member mapping');
      mapped.add(association);
    }
    return { sourceId: user.id, association, sourceRecord: { ...user.sourceRecord, nookSource: 'mattermost', roleDecisions: review.roles } };
  });
  const associations = new Map(actors.map(actor => [actor.sourceId, actor.association])), catalog = emojiCatalog(inspected.emojis);
  check(inspected.rooms.length > 0 && inspected.rooms.length <= 50 && new Set(inspected.rooms.map(room => room.id)).size === inspected.rooms.length, 'room limit or identity');
  const channels = inspected.rooms.map((room, index) => {
    const members = room.members.map(id => associations.get(id)).sort(), owner = associations.get(room.creator), name = room.name;
    check(mattermostId(room.id) && ['channel', 'private', 'dm'].includes(room.kind) && members.length > 0 && members.length <= (room.kind === 'dm' ? 50 : 1000) && members.every(mattermostId) && new Set(members).size === members.length && members.includes(owner), 'faithful room audience and creator');
    check(typeof name === 'string' && name.trim() && name.length <= 80 && room.sourceRecord.creator_id === room.creator, 'destination room name or source creator');
    return { sourceId: room.id, name, kind: room.kind, owner, members, guestMembers: [], sourceRecord: { ...room.sourceRecord, membershipHistory: inspected.memberships.filter(membership => membership.room === room.id), nookSource: 'mattermost', participantIds: [...room.members], mappedMembers: members, mappedOwner: owner, sourceKind: room.kind, destinationName: name, roleDecisions: review.roles, emojiCatalog: index === 0 ? catalog : [] } };
  });
  const byMessage = new Map(), filePairs = new Set();
  for (const file of inspected.files) {
    assertMattermostFileMetadata(file);
    check(file.bytes instanceof Uint8Array && file.bytes.length === file.size && createHash('sha256').update(file.bytes).digest('hex') === file.sha256 && !filePairs.has(`${file.message}:${file.sourceId}`), 'original bytes or duplicate attachment');
    filePairs.add(`${file.message}:${file.sourceId}`);
    const list = byMessage.get(file.message) ?? []; list.push(file); byMessage.set(file.message, list);
  }
  const messages = inspected.messages.map(message => {
    const files = (byMessage.get(message.id) ?? []).map(file => ({ ...file })), sourceTimestamp = mattermostTimestamp(message.createdAt), key = `${review.namespace}:${message.room}:${message.id}`;
    const channel = channels.find(candidate => candidate.sourceId === message.room);
    check(mattermostId(message.id) && channel && associations.has(message.creator) && typeof message.body === 'string' && message.body.length <= 100000 && message.body === message.sourceRecord.message, 'message relationship or markdown');
    check(Array.isArray(message.sourceRecord.flagged_by) && Array.isArray(message.sourceRecord.reactions) && typeof message.sourceRecord.is_pinned === 'boolean', 'source reactions, saved or pin inventory');
    const mappedSavedUsers = message.sourceRecord.flagged_by.map(id => associations.get(id));
    check(mappedSavedUsers.every(mattermostId) && new Set(mappedSavedUsers).size === mappedSavedUsers.length, 'saved audience');
    for (const reaction of message.sourceRecord.reactions) check(associations.has(reaction.user), 'known reaction identity');
    return { key, channel: message.room, sourceActor: message.creator, sourceTimestamp, sourceRecord: { ...message.sourceRecord, nookSource: 'mattermost', bodyText: message.body, sourceTimestamp, sourceFiles: files.map(({ bytes, ...file }) => file), sourceParent: message.parent ?? null, mappedSavedUsers: mappedSavedUsers.sort(), customEmojiNames: catalog.map(emoji => emoji.name).sort() }, body: message.body, threadRoot: message.parent ? `${review.namespace}:${message.room}:${message.parent}` : null, files };
  });
  check(new Set(messages.map(message => message.key)).size === messages.length && inspected.files.every(file => messages.some(message => message.sourceRecord.id === file.message)), 'unique message and file relationships');
  for (const message of messages) if (message.threadRoot) check(messages.some(parent => parent.key === message.threadRoot && parent.channel === message.channel && !parent.threadRoot), 'native source parent');
  const omissions = [...inspected.omissions], omissionDigest = importDigest(omissions), omissionsAccepted = !omissions.length || same(review.acceptedOmissions, [omissionDigest]);
  const capture = { sourceType: 'mattermost', source: inspected.source, namespace: review.namespace, archiveDigest: inspected.archiveDigest, reviewDigest: importDigest(review), roles: review.roles, rolesDigest: importDigest(review.roles), channels, actors, messages, omissions, omissionDigest, omissionsAccepted, blocked: false, blockers: [], externalActors: inspected.users.filter(user => user.externalOnly).map(user => user.id), skippedKinds: {}, missingFiles: { count: 0, bytes: 0, unknownSizes: 0, accepted: false }, missingFileInventory: [], missingFileInventoryDigest: importDigest([]), completeness: 'unknown', sourceAuthenticityVerified: false };
  capture.counts = mattermostCounts(capture);
  capture.digest = mattermostCaptureDigest(capture);
  return capture;
}
export function mattermostSummary(capture) {
  return { sourceType: 'mattermost', source: capture.source, reviewDigest: capture.reviewDigest, roles: capture.roles, roleInventory: capture.source.roleInventory, rolesDigest: capture.rolesDigest, externalActors: capture.externalActors, skippedKinds: capture.skippedKinds, missingFiles: capture.missingFiles, missingFileInventoryDigest: capture.missingFileInventoryDigest, counts: capture.counts, omissions: capture.omissions, omissionDigest: capture.omissionDigest, omissionsAccepted: capture.omissionsAccepted, blockers: capture.blockers, blocked: capture.blocked, channels: capture.channels.map(({ sourceRecord, ...channel }) => channel), actors: capture.actors.map(({ sourceRecord, ...actor }) => actor), archiveDigest: capture.archiveDigest, captureDigest: capture.digest, completeness: 'unknown', sourceAuthenticityVerified: false };
}
export const mattermostFileHashes = capture => capture.messages.flatMap(message => message.files.map(file => ({ key: message.key, sourceId: file.sourceId, name: file.name, mime: file.mime, size: file.size, sha256: file.sha256 })));
