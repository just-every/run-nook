#!/usr/bin/env node
import {randomBytes, createHash} from 'node:crypto';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {parseArgs} from 'node:util';

// Run once against an empty, disposable, real Mattermost server. Never log API bodies.
const {values} = parseArgs({options: {output: {type: 'string'}}});
if (!values.output) throw new Error('Usage: node populate.mjs --output DIRECTORY');
const origin = new URL(process.env.MATTERMOST_ORIGIN || 'http://127.0.0.1:8065');
if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password) {
  throw new Error('MATTERMOST_ORIGIN must be an HTTP origin without credentials');
}
const output = resolve(values.output);
const actors = {};
const expected = {format: 1, generator: 'Mattermost REST API fixture population', users: [], teams: [], channels: [], posts: [], files: [], emoji: []};
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

async function request(path, {actor, method = 'GET', body, raw = false} = {}) {
  const headers = {};
  if (actor) headers.Authorization = `Bearer ${actors[actor].token}`;
  if (body !== undefined && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  let response;
  try {
    response = await fetch(new URL(`/api/v4${path}`, origin), {
      method, headers, body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    throw new Error(`Mattermost request failed: ${method} ${path}`);
  }
  if (!response.ok) throw new Error(`Mattermost HTTP ${response.status}: ${method} ${path}`);
  if (raw) return {response, bytes: Buffer.from(await response.arrayBuffer())};
  const text = await response.text();
  return {response, data: text ? JSON.parse(text) : null};
}

async function createUser(username, firstName) {
  const password = `Aa1!${randomBytes(24).toString('base64url')}`;
  const {data: user} = await request('/users', {actor: actors.maya ? 'maya' : undefined, method: 'POST', body: {
    username, first_name: firstName, last_name: 'Fixture', email: `${username}@fixture.example`, password,
  }});
  const {response} = await request('/users/login', {method: 'POST', body: {login_id: username, password}});
  const token = response.headers.get('Token');
  if (!token) throw new Error(`Missing login token for fixture user ${username}`);
  actors[username] = {id: user.id, token};
  expected.users.push({id: user.id, username, email: user.email, first_name: user.first_name, last_name: user.last_name, roles: user.roles});
}

async function createTeam(name, members) {
  const {data: team} = await request('/teams', {actor: 'maya', method: 'POST', body: {name, display_name: name === 'launch' ? 'Launch' : 'Support', type: 'O'}});
  await Promise.all(members.filter(name => name !== 'maya').map(username => request(`/teams/${team.id}/members`, {
    actor: 'maya', method: 'POST', body: {team_id: team.id, user_id: actors[username].id},
  })));
  expected.teams.push({id: team.id, name, display_name: team.display_name, type: team.type, members});
  return team;
}

async function createChannel(team, name, type, members) {
  const {data: channel} = await request('/channels', {actor: 'maya', method: 'POST', body: {
    team_id: team.id, name, display_name: name.replaceAll('-', ' '), type,
    header: `Genuine Mattermost fixture: ${name}`, purpose: 'Migration acceptance evidence',
  }});
  await Promise.all(members.filter(name => name !== 'maya').map(username => request(`/channels/${channel.id}/members`, {
    actor: 'maya', method: 'POST', body: {user_id: actors[username].id},
  })));
  const entry = {id: channel.id, key: `${team.name}/${name}`, team: team.name, name, type, members};
  expected.channels.push(entry);
  return entry;
}

async function directChannel(members) {
  const group = members.length > 2;
  const {data: channel} = await request(group ? '/channels/group' : '/channels/direct', {
    actor: members[0], method: 'POST', body: members.map(name => actors[name].id),
  });
  const entry = {id: channel.id, key: members.join(','), type: channel.type, members};
  expected.channels.push(entry);
  return entry;
}

async function post(key, channel, actor, message, {root, file} = {}) {
  const fileIds = [];
  if (file) {
    const bytes = Buffer.from(file.text);
    const form = new FormData();
    form.append('channel_id', channel.id);
    form.append('files', new Blob([bytes], {type: 'text/plain'}), file.name);
    const {data} = await request('/files', {actor, method: 'POST', body: form});
    const uploaded = data.file_infos[0];
    fileIds.push(uploaded.id);
    const {bytes: downloaded} = await request(`/files/${uploaded.id}`, {actor, raw: true});
    if (sha256(downloaded) !== sha256(bytes)) throw new Error(`Uploaded file bytes differ: ${key}`);
    expected.files.push({id: uploaded.id, post: key, name: uploaded.name, size: downloaded.length, sha256: sha256(downloaded)});
  }
  const {data} = await request('/posts', {actor, method: 'POST', body: {
    channel_id: channel.id, message, ...(root ? {root_id: root.id} : {}), ...(fileIds.length ? {file_ids: fileIds} : {}),
  }});
  const entry = {key, id: data.id, channel: channel.key, author: actor, message: data.message, create_at: data.create_at, edit_at: data.edit_at, root: root?.key || null, file_ids: fileIds, saved_by: [], is_pinned: false, reactions: []};
  expected.posts.push(entry);
  return entry;
}

async function save(post, username) {
  await request(`/users/${actors[username].id}/preferences`, {actor: username, method: 'PUT', body: [{
    user_id: actors[username].id, category: 'flagged_post', name: post.id, value: 'true',
  }]});
  post.saved_by.push(username);
}

async function pin(post, username) {
  await request(`/posts/${post.id}/pin`, {actor: username, method: 'POST'});
  post.is_pinned = true;
}

async function react(post, username, emoji) {
  const {data} = await request('/reactions', {actor: username, method: 'POST', body: {user_id: actors[username].id, post_id: post.id, emoji_name: emoji}});
  post.reactions.push({user: username, emoji_name: emoji, create_at: data.create_at});
}

await createUser('maya', 'Maya');
// This is a disposable instance; enable only the features the real API fixture needs.
await request('/config/patch', {actor: 'maya', method: 'PUT', body: {
  TeamSettings: {EnableOpenServer: true, EnableCustomEmoji: true},
  EmailSettings: {RequireEmailVerification: false},
}});
await Promise.all([createUser('leo', 'Leo'), createUser('aisha', 'Aisha'), createUser('sam', 'Sam')]);
const [launch, support] = await Promise.all([
  createTeam('launch', ['maya', 'leo', 'aisha', 'sam']),
  createTeam('support', ['maya', 'leo', 'sam']),
]);
const [publicChannel, privateChannel, supportChannel, dm, group] = await Promise.all([
  createChannel(launch, 'release-room', 'O', ['maya', 'leo', 'aisha', 'sam']),
  createChannel(launch, 'private-plans', 'P', ['maya', 'aisha']),
  createChannel(support, 'customer-care', 'O', ['maya', 'leo', 'sam']),
  directChannel(['maya', 'leo']),
  directChannel(['leo', 'aisha', 'sam']),
]);
await request(`/teams/${launch.id}/members/${actors.leo.id}/roles`, {actor: 'maya', method: 'PUT', body: {roles: 'team_user team_admin'}});
await request(`/channels/${publicChannel.id}/members/${actors.leo.id}/roles`, {actor: 'maya', method: 'PUT', body: {roles: 'channel_user channel_admin'}});
expected.teams.find(team => team.name === 'launch').member_roles = {maya: 'team_user team_admin', leo: 'team_user team_admin', aisha: 'team_user', sam: 'team_user'};
publicChannel.member_roles = {maya: 'channel_user channel_admin', leo: 'channel_user channel_admin', aisha: 'channel_user', sam: 'channel_user'};

const emojiBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgaPj/HwAEggJ/59habAAAAABJRU5ErkJggg==', 'base64');
const emojiForm = new FormData();
emojiForm.append('emoji', JSON.stringify({name: 'launch_spark', creator_id: actors.maya.id}));
emojiForm.append('image', new Blob([emojiBytes], {type: 'image/png'}), 'launch-spark.png');
const {data: emoji} = await request('/emoji', {actor: 'maya', method: 'POST', body: emojiForm});
const {bytes: emojiDownload} = await request(`/emoji/${emoji.id}/image`, {actor: 'maya', raw: true});
expected.emoji.push({id: emoji.id, name: emoji.name, size: emojiDownload.length, sha256: sha256(emojiDownload)});

const root = await post('public-root', publicChannel, 'maya', 'Launch checklist is ready. @leo please review :launch_spark:', {file: {name: 'launch-checklist.txt', text: 'Launch checklist\n1. Review access\n2. Ship calmly\n'}});
const reply = await post('public-reply', publicChannel, 'leo', 'Reviewed the checklist; ready for the next step.', {root});
await post('public-update', publicChannel, 'sam', 'The release notes include café and 日本語 examples.');
const privateRoot = await post('private-root', privateChannel, 'aisha', 'Private launch budget for Maya and Aisha only.', {file: {name: 'private-budget.txt', text: 'Private launch budget\nReserve: 1200 USD\n'}});
await post('private-reply', privateChannel, 'maya', 'I have reviewed this private budget.', {root: privateRoot});
await post('support-root', supportChannel, 'sam', 'Customer support handover starts at 09:00.');
await post('support-update', supportChannel, 'leo', 'The support queue has a new triage guide.');
const dmRoot = await post('dm-root', dm, 'leo', 'Maya, here is the private handover note.', {file: {name: 'handover.txt', text: 'Direct handover\nKeep this between Maya and Leo.\n'}});
await post('dm-reply', dm, 'maya', 'Received the handover note.', {root: dmRoot});
const groupRoot = await post('group-root', group, 'aisha', 'Leo, Aisha and Sam group: Maya is not a participant.');
await Promise.all([
  save(root, 'leo'), save(root, 'aisha'), save(reply, 'maya'), save(dmRoot, 'maya'),
  pin(root, 'maya'), pin(reply, 'leo'), react(root, 'leo', 'thumbsup'), react(root, 'aisha', 'launch_spark'), react(reply, 'maya', 'eyes'), react(groupRoot, 'sam', 'thumbsup'),
]);

// Read back through the real API, so expected.json records measured server state.
const saved = {};
await Promise.all(Object.keys(actors).map(async username => {
  const {data} = await request(`/users/${actors[username].id}/preferences`, {actor: username});
  saved[username] = new Set(data.filter(pref => pref.category === 'flagged_post' && pref.value === 'true').map(pref => pref.name));
}));
await Promise.all(expected.posts.map(async entry => {
  const {data: actual} = await request(`/posts/${entry.id}`, {actor: entry.author});
  if (actual.message !== entry.message || actual.is_pinned !== entry.is_pinned) throw new Error(`Post readback differs: ${entry.key}`);
  const actualSavedBy = Object.keys(actors).filter(name => saved[name].has(entry.id)).sort();
  if (JSON.stringify(actualSavedBy) !== JSON.stringify([...entry.saved_by].sort())) throw new Error(`Saved state differs: ${entry.key}`);
  const {data: reactions} = await request(`/posts/${entry.id}/reactions`, {actor: entry.author});
  const reactionKey = reaction => `${reaction.user || Object.keys(actors).find(name => actors[name].id === reaction.user_id)}:${reaction.emoji_name}`;
  if (JSON.stringify((reactions ?? []).map(reactionKey).sort()) !== JSON.stringify(entry.reactions.map(reactionKey).sort())) throw new Error(`Reaction state differs: ${entry.key}`);
  entry.create_at = actual.create_at;
  entry.edit_at = actual.edit_at;
  entry.saved_by.sort();
}));
expected.users.sort((a, b) => a.username.localeCompare(b.username));
await mkdir(output, {recursive: true});
await writeFile(resolve(output, 'expected.json'), `${JSON.stringify(expected, null, 2)}\n`);
console.log(`Populated real Mattermost: ${expected.users.length} users, ${expected.teams.length} teams, ${expected.channels.length} conversations, ${expected.posts.length} posts, ${expected.files.length} files.`);
