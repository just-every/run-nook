import { canonicalPath, sha256 } from './zip.mjs';

export const mattermostReject = reason => { throw Error(`MATTERMOST_INVALID: ${reason}`); };
const reject = mattermostReject;
export const sourceObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export function sourceText(value, max = 100000) {
  if (typeof value !== 'string' || !value.isWellFormed() || value.length > max || value.includes('\0')) reject('invalid source text');
  return value;
}
const name = value => {
  if (!/^[A-Za-z0-9_.-]{1,128}$/.test(sourceText(value, 128))) reject('invalid source identity');
  return value;
};
function list(value, max = 100000) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > max) reject('invalid or oversized source list');
  return value;
}
const object = value => { if (!sourceObject(value)) reject('invalid source record'); return value; };
const integer = value => { if (!Number.isSafeInteger(value) || value < 0 || value > 8640000000000000) reject('invalid source timestamp or count'); return value; };
const date = value => new Date(integer(value)).toISOString();
const key = (...parts) => JSON.stringify(parts);
const identity = (kind, value) => `${kind}-${sha256(value).slice(0,40)}`;
const pick = (row, keys) => Object.fromEntries(keys.filter(k => row[k] !== undefined && row[k] !== null).map(k => [k, sourceText(row[k], 10000)]));
function flag(row, field) { if (row[field] !== undefined && row[field] !== null && typeof row[field] !== 'boolean') reject('invalid source flag'); return row[field] === true; }
function unique(map, id, value) { if (map.has(id)) reject('duplicate source identity'); map.set(id, value); }
function ref(map, id, label) { const value = map.get(id); if (!value) reject(`missing ${label}`); return value; }
function mime(bytes) {
  const b = Buffer.from(bytes);
  if (b.length >= 8 && b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png';
  if (b.length >= 3 && b[0] === 255 && b[1] === 216 && b[2] === 255) return 'image/jpeg';
  if (b.length >= 6 && ['GIF87a','GIF89a'].includes(b.subarray(0,6).toString('ascii'))) return 'image/gif';
  if (b.length >= 12 && b.subarray(0,4).toString('ascii') === 'RIFF' && b.subarray(8,12).toString('ascii') === 'WEBP') return 'image/webp';
  try { const text = new TextDecoder('utf-8', {fatal:true}).decode(b); if (!/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text)) return 'text/plain'; } catch {}
  return 'application/octet-stream';
}

/** Explicit allowlists keep passwords, auth_data and arbitrary props out of provenance. */
export function mattermostRecords(lines, archive, limits) {
  const omissions = [], teams = new Map(), channels = new Map(), directs = new Map(), userMap = new Map(), roles = new Set(), seen = new Map();
  const users = [], rooms = [], memberships = [], messages = [], files = [], emojis = [], usedPaths = new Set(['import.jsonl']);
  const sourceCounts = Object.create(null), kinds = new Map();
  let nestedItems = 0;
  const sourceList = value => {
    const result = list(value, limits.records);
    if ((nestedItems += result.length) > limits.records) reject('nested record limit');
    return result;
  };
  const omit = (kind, id, reason, extra = {}) => { if (omissions.length >= limits.records) reject('omission limit'); omissions.push({kind, key:id, reason, ...extra}); };
  const roleText = value => {
    const text = value === undefined || value === null ? '' : sourceText(value, 4096);
    for (const token of text.split(/\s+/).filter(Boolean)) roles.add(name(token));
    if (roles.size > 4096) reject('role inventory limit');
    return text;
  };
  const sourceNames = values => sourceList(values).map(name);
  const requireUsers = values => { for (const username of values) ref(userMap, username, 'source user'); return values; };
  function members(values) {
    const raw = sourceNames(values), result = [...new Set(raw)].sort();
    // Mattermost exports a self-DM as the same member twice.
    if (!raw.length || result.length !== raw.length && !(raw.length === 2 && result.length === 1)) reject('ambiguous direct audience');
    return requireUsers(result);
  }
  function pathBytes(path) {
    canonicalPath(sourceText(path, 1024));
    const target = `data/${path}`, bytes = archive.get(target);
    if (!bytes) reject('missing referenced file bytes');
    usedPaths.add(target);
    return bytes;
  }
  for (const {data, line} of lines) {
    const type = data.type, row = object(data[type]);
    sourceCounts[type] = (sourceCounts[type] ?? 0) + 1;
    if (!kinds.has(type)) kinds.set(type, []);
    kinds.get(type).push({row, line});
    if (['team','channel','user','bot','emoji','role','scheme'].includes(type)) {
      const id = type === 'channel' ? key(name(row.team), name(row.name)) : name(row[type === 'user' || type === 'bot' ? 'username' : 'name']);
      if (!seen.has(type)) seen.set(type, new Map());
      unique(seen.get(type), id, row);
    } else if (!['post','direct_channel','direct_post'].includes(type)) omit('source-record', `line-${line}`, 'unsupported-record-type', {type});
  }
  for (const type of ['role','scheme']) for (const {row} of kinds.get(type) ?? []) {
    const id = name(row.name), sourceRecord = {...pick(row, ['name','display_name','description','scope'])};
    if (type === 'role') {
      roles.add(id); sourceRecord.permissions = sourceNames(row.permissions); sourceRecord.scheme_managed = flag(row, 'scheme_managed');
    } else for (const field of ['default_team_admin_role','default_team_user_role','default_channel_admin_role','default_channel_user_role','default_team_guest_role','default_channel_guest_role']) if (row[field] !== undefined && row[field] !== null) {
      const role = object(row[field]); roles.add(name(role.name));
      sourceRecord[field] = {...pick(role, ['name','display_name','description']), permissions:sourceNames(role.permissions), scheme_managed:flag(role, 'scheme_managed')};
    }
    omit(type, id, 'source-permissions-not-applied', {sourceRecord});
  }
  for (const {row} of kinds.get('team') ?? []) {
    const id = name(row.name), type = sourceText(row.type, 16);
    unique(teams, id, {...pick(row, ['name','display_name','type','description','scheme']), allow_open_invite:flag(row, 'allow_open_invite')});
    if (!['O','I'].includes(type)) omit('team', id, 'unsupported-team-type', {type});
  }
  for (const type of ['user','bot']) for (const {row} of kinds.get(type) ?? []) {
    const id = name(row.username), deleted = integer(row.delete_at ?? 0), systemRoles = roleText(row.roles);
    const safeTeams = sourceList(row.teams).map(t => {
      object(t); const team = name(t.name); ref(teams, team, 'membership team');
      return {name:team, roles:roleText(t.roles), channels:sourceList(t.channels).map(c => { object(c); return {name:name(c.name), roles:roleText(c.roles)}; })};
    });
    const safe = {id, username:id, ...pick(row, ['email','nickname','first_name','last_name','position','locale','display_name','description','owner']), roles:systemRoles, teams:safeTeams, delete_at:deleted};
    const display = type === 'bot' ? safe.display_name : [safe.first_name, safe.last_name].filter(Boolean).join(' ') || safe.nickname;
    const user = {id, sourceId:id, name:display || id, email:safe.email ?? null, active:!deleted, externalOnly:type === 'bot' || systemRoles.split(/\s+/).includes('system_guest'), sourceRecord:{...safe, name:display || id, source_kind:type}};
    unique(userMap, id, user); users.push(user);
    if (deleted) omit(type, id, 'source-user-deactivated', {retained:true});
    if (row.profile_image) { const path = sourceText(row.profile_image, 1024); pathBytes(path); omit('file', path, 'profile-image-not-imported'); }
  }
  for (const user of users) if (user.sourceRecord.source_kind === 'bot' && user.sourceRecord.owner && !userMap.has(name(user.sourceRecord.owner))) omit('bot-owner', user.id, 'source-owner-not-exported');
  function roomName(original, id) {
    if (original.length <= 80) return original;
    const alias = `${original.slice(0,60).replace(/[\uD800-\uDBFF]$/, '')}-${sha256(id).slice(0,12)}`;
    omit('room-name', id, 'destination-name-shortened', {sourceName:original, destinationName:alias});
    return alias;
  }
  for (const {row} of kinds.get('channel') ?? []) {
    const team = name(row.team), channel = name(row.name), id = identity('channel', key(team, channel)), type = sourceText(row.type, 16), deleted = integer(row.deleted_at ?? 0);
    ref(teams, team, 'channel team');
    const sourceRecord = {id, ...pick(row, ['name','display_name','type','team','header','purpose','scheme']), team_record:teams.get(team), deleted_at:deleted};
    const room = {id, sourceId:id, name:roomName(`${team}/${sourceRecord.display_name || channel}`, id), kind:type === 'O' ? 'channel' : 'private', members:[], creator:null, sourceRecord};
    const excluded = deleted ? 'deleted-source-channel' : !['O','P'].includes(type) ? 'unsupported-channel-type' : !['O','I'].includes(teams.get(team).type) ? 'unsupported-source-team' : null;
    unique(channels, key(team, channel), {room, excluded});
    if (excluded) omit('channel', id, excluded, {sourceRecord}); else rooms.push(room);
  }
  for (const user of users) {
    const teamSeen = new Set();
    for (const team of user.sourceRecord.teams) {
      if (teamSeen.has(team.name)) reject('duplicate team membership'); teamSeen.add(team.name);
      const channelSeen = new Set();
      for (const channel of team.channels) {
        if (channelSeen.has(channel.name)) reject('duplicate channel membership'); channelSeen.add(channel.name);
        const {room, excluded} = ref(channels, key(team.name, channel.name), 'membership channel');
        if (excluded) { omit('membership', key(room.id, user.id), excluded); continue; }
        room.members.push(user.id);
        memberships.push({id:identity('membership', key(room.id, user.id)), room:room.id, user:user.id, sourceRecord:{team:team.name, channel:channel.name, roles:channel.roles, team_roles:team.roles}});
      }
    }
  }
  for (const {row} of kinds.get('direct_channel') ?? []) {
    const participants = sourceList(row.participants).map(p => {
      object(p); const result = {username:name(p.username)};
      for (const field of ['scheme_user','scheme_admin','scheme_guest']) if (p[field] !== undefined && p[field] !== null) { result[field] = flag(p, field); if (result[field]) roles.add(`channel_${field.slice(7)}`); }
      return result;
    });
    const audience = members(participants.length ? participants.map(p => p.username) : row.members);
    if (participants.length && row.members !== undefined && row.members !== null && key(...members(row.members)) !== key(...audience)) reject('conflicting direct audience');
    const signature = key(...audience), id = identity('direct', signature);
    const sourceRecord = {id, name:audience.join(', '), type:audience.length > 2 ? 'G' : 'D', members:audience, participants, ...pick(row, ['header']), favorited_by:requireUsers(sourceNames(row.favorited_by)), shown_by:requireUsers(sourceNames(row.shown_by))};
    const room = {id, sourceId:id, name:roomName(audience.join(', '), id), kind:'dm', members:audience, creator:audience[0], sourceRecord:{...sourceRecord, creator_id:audience[0]}};
    unique(directs, signature, room); rooms.push(room);
    for (const username of audience) memberships.push({id:identity('membership', key(id, username)), room:id, user:username});
  }
  for (const room of rooms) {
    room.members.sort();
    if (!room.members.length) reject('unknown channel audience');
    room.creator ??= room.members[0]; room.sourceRecord.creator_id = room.creator;
  }
  const messageOrdinals = new Map(); let postCount = 0, attachmentCount = 0;
  function post(row, room, parent = null, excluded = null) {
    object(row);
    if (++postCount > limits.records) reject('message limit');
    const creator = name(row.user); ref(userMap, creator, 'message author');
    const createdAt = date(row.create_at), edit = integer(row.edit_at ?? 0), updatedAt = edit ? date(edit) : createdAt;
    const body = sourceText(row.message), type = row.type == null ? '' : sourceText(row.type, 256);
    if (edit && edit < row.create_at) reject('message edited before creation');
    const attachments = sourceList(row.attachments).map(a => { object(a); const path = sourceText(a.path, 1024); pathBytes(path); return {path}; });
    if (attachments.length > 5) reject('more than five source attachments on one message');
    if (new Set(attachments.map(a => a.path)).size !== attachments.length) reject('duplicate attachment relationship');
    if ((attachmentCount += attachments.length) > limits.records) reject('attachment limit');
    const reactions = sourceList(row.reactions).map(r => { object(r); ref(userMap, name(r.user), 'reaction user'); return {user:r.user, emoji_name:name(r.emoji_name), create_at:integer(r.create_at)}; });
    const flagged_by = requireUsers(sourceNames(row.flagged_by)), is_pinned = flag(row, 'is_pinned');
    const thread_followers = sourceList(row.thread_followers).map(f => { object(f); const user = name(f.user); ref(userMap, user, 'thread follower'); return {user, ...Object.fromEntries(['last_viewed','unread_mentions'].filter(k => f[k] != null).map(k => [k, integer(f[k])]))}; });
    const semantic = {room_id:room.id, creator_id:creator, create_at:row.create_at, edit_at:edit, type, message:body, parent, attachments, reactions, flagged_by, is_pinned, thread_followers};
    const digest = sha256(JSON.stringify(semantic)), ordinal = messageOrdinals.get(digest) ?? 0; messageOrdinals.set(digest, ordinal + 1);
    const id = identity('post', `${digest}:${ordinal}`), deleted = integer(row.delete_at ?? row.deleted_at ?? 0), reason = excluded || (deleted ? 'deleted-source-post' : null);
    if (reason) {
      omit('message', id, reason, {room:room.id, creator, createdAt});
      for (const {path} of attachments) omit('file', identity('attachment', key(id, path)), reason, {message:id, path});
    }
    else {
      messages.push({id, sourceId:id, room:room.id, creator, createdAt, updatedAt, body, parent, sourceRecord:{id, ...semantic, user:creator, created_at:createdAt, updated_at:updatedAt}});
      for (const {path} of attachments) {
        const bytes = pathBytes(path), sourceId = identity('file', path), fileId = identity('attachment', key(id, path)), filename = path.split('/').at(-1), contentType = mime(bytes);
        files.push({id:fileId, sourceId, message:id, bytes, sha256:sha256(bytes), name:filename, mime:contentType, size:bytes.length, sourceRecord:{id:fileId, record_id:id, blob_id:sourceId, record_type:'Message', name:'attachment', path, filename, content_type:contentType, byte_size:bytes.length}});
      }
    }
    if (row.props !== undefined && row.props !== null) { object(row.props); if (Object.keys(row.props).length) omit('message-properties', id, 'unsupported-message-properties'); }
    if (type) omit('message-type', id, 'source-post-type-preserved-as-history', {type, retained:!reason});
    if (room.kind === 'dm' && parent === null && row.reactions == null) omit('direct-reactions', id, 'source-direct-reactions-not-exported', {room:room.id, createdAt, detail:'Mattermost 12 omits reactions on direct/group root posts. Their source total is unknown; supplied reply reactions are preserved.'});
    if (thread_followers.length) omit('thread-followers', id, 'source-thread-follows-not-activated');
    const replies = sourceList(row.replies);
    if (parent && replies.length) reject('unsupported nested reply depth');
    for (const reply of replies) post(reply, room, id, reason);
    if (messages.length > limits.records || files.length > limits.records) reject('record limit');
  }
  for (const {data} of lines) if (data.type === 'post') {
    const row = data.post, {room, excluded} = ref(channels, key(name(row.team), name(row.channel)), 'post channel'); post(row, room, null, excluded);
  } else if (data.type === 'direct_post') {
    const row = data.direct_post, audience = members(row.channel_members), room = ref(directs, key(...audience), 'direct post channel'); post(row, room);
  }
  let emojiBytes = 0;
  for (const {row} of kinds.get('emoji') ?? []) {
    const emojiName = name(row.name), path = sourceText(row.image, 1024), bytes = pathBytes(path), contentType = mime(bytes);
    if (!contentType.startsWith('image/')) reject('unsupported emoji image');
    if ((emojiBytes += bytes.length) > limits.emojiBytes) reject('emoji catalog byte limit');
    emojis.push({name:emojiName, path, bytes, mime:contentType, sha256:sha256(bytes), size:bytes.length});
  }
  for (const [path] of archive) if (!usedPaths.has(path)) omit('file', path, path === 'warnings.txt' ? 'source-export-warnings' : 'unreferenced-archive-entry');
  if (users.length + rooms.length + memberships.length + messages.length + files.length > limits.records) reject('aggregate record limit');
  if (roles.size > 4096) reject('role inventory limit');
  return {users, rooms, memberships, messages, files, emojis, omissions, roleInventory:[...roles].sort(), counts:{users:users.length, rooms:rooms.length, memberships:memberships.length, messages:messages.length, files:files.length, bytes:files.reduce((n,f) => n + f.size, 0), teams:teams.size, emoji:emojis.length, emojiBytes, roles:sourceCounts.role ?? 0, schemes:sourceCounts.scheme ?? 0, bots:sourceCounts.bot ?? 0, sourceMessages:postCount, sourceAttachments:attachmentCount, sourceRecords:lines.length, sourceCounts, omissions:omissions.length}};
}
