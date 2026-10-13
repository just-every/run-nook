import { zipFixture } from './fixture.mjs';

// Synthetic export records, generated in memory. No authentic customer data or URLs.
const start = Date.UTC(2024, 0, 1) / 1000;
const end = Date.UTC(2025, 2, 31, 23, 59, 59) / 1000;
const names = ['general', 'engineering', 'design', 'support', 'watercooler', 'empty-channel'];
const userId = i => `U${String(i).padStart(8, '0')}`;
const channelId = i => `C${String(i).padStart(8, '0')}`;
const ts = (row, channel) => `${start + Math.floor((end - start) * row / 999)}.${String(channel + 1).padStart(6, '0')}`;
const date = timestamp => new Date(Number(timestamp.split('.')[0]) * 1000).toISOString().slice(0, 10);

export const realisticLocalUsers = [
    { id: 'owner', active: true, email: 'person-0@example.test' },
    { id: 'member', active: true, email: 'duplicate@example.test' },
    { id: 'duplicate-member', active: true, email: 'duplicate@example.test' }
];

export function realisticUsers() {
    return Array.from({ length: 40 }, (_, i) => ({
        id: userId(i), name: i >= 38 ? `app-${i}` : `person-${i}`, real_name: i >= 38 ? `Fixture bot ${i}` : `Fixture person ${i}`,
        deleted: i >= 34 && i < 38, is_bot: i >= 38, is_app_user: i === 39,
        profile: { display_name: `Person ${i}`, ...(i < 38 ? { email: i === 1 || i === 2 ? 'duplicate@example.test' : `person-${i}@example.test` } : {}) }
    }));
}

export function realisticChannels() {
    return names.map((name, i) => ({
        id: channelId(i), name, is_channel: true, is_private: false, is_archived: false,
        created: start - 86400, creator: userId(0), members: realisticUsers().map(u => u.id),
        topic: { value: `Current ${name} topic`, creator: userId(0), last_set: end },
        purpose: { value: `Discuss ${name}`, creator: userId(0), last_set: end },
        ...(i === 4 ? { previous_names: ['random'] } : {})
    }));
}

export function realisticReview({ namespace = 'realistic-workspace', ownerId = 'owner', sourceIds = names.map((_, i) => channelId(i)), members = [ownerId], actors = {}, importWithoutMissingFiles } = {}) {
    return {
        namespace, channels: realisticChannels().filter(c => sourceIds.includes(c.id)).map(c => ({ sourceId: c.id, name: `Imported ${c.name}`, members: [...members] })),
        actors: { ...Object.fromEntries(realisticUsers().map(u => [u.id, null])), B00000001: null, B00000002: null, ...actors }, acceptedOmissions: [],
        ...(importWithoutMissingFiles === undefined ? {} : { importWithoutMissingFiles })
    };
}

// Ordinary JSON Slack exports contain file links. files/<id>/<name> is Nook's
// explicitly supplied-byte companion convention, not a claimed Slack ZIP path.
export function realisticFileBytes(id = 'F00000001') {
    return Buffer.from(`Release notes (${id})\nCafé 日本語 👋\nOwner reviewed the release checklist.\n`, 'utf8');
}
function file(id, user) {
    return { id, name: `${id}.txt`, title: `Release notes ${id}`, mimetype: 'text/plain', filetype: 'text',
        user, size: realisticFileBytes(id).length, mode: 'hosted', is_external: false,
        url_private: `https://files.example.test/${id}.txt`, url_private_download: `https://files.example.test/${id}/download` };
}

function channelMessages(channel) {
    const rows = [];
    for (let i = 0; i < 1000; i++) {
        const kind = i % 20, user = userId((i + channel * 7) % 38), timestamp = ts(i, channel);
        const rootIndex = i - kind, root = rows[rootIndex];
        const message = { type: 'message', user, text: `Update ${channel}:${i}: café 日本語 👋 :sparkles:`, ts: timestamp };
        if (kind === 0) Object.assign(message, { thread_ts: timestamp, reply_count: 2 });
        if (kind === 1 || kind === 2) Object.assign(message, { text: `Thread reply ${channel}:${i}`, thread_ts: root.ts, parent_user_id: root.user });
        if (kind === 2) Object.assign(message, { subtype: 'thread_broadcast', root: { type: root.type, user: root.user, text: root.text, ts: root.ts, thread_ts: root.ts, reply_count: 2 } });
        if (kind === 3) Object.assign(message, { subtype: 'channel_join', inviter: userId(0), text: `<@${user}> joined this channel.` });
        if (kind === 4) Object.assign(message, { subtype: 'channel_leave', text: `<@${user}> left this channel.` });
        if (kind === 5) {
            delete message.user;
            Object.assign(message, { subtype: 'bot_message', bot_id: 'B00000001', username: 'release-bot', icons: {}, text: `Release bot: build ${i} completed.` });
        }
        if (kind === 6) Object.assign(message, { user: userId(39), bot_id: 'B00000002', bot_profile: { id: 'B00000002', app_id: 'A00000002', name: 'Status app', icons: {} }, text: `Status app: deployment ${i} is ready.` });
        if (kind === 7 || kind === 8) {
            const id = kind === 8 && channel === 0 && i === 8 ? 'FMISSING01' : `F${String(channel * 1000 + i).padStart(8, '0')}`;
            Object.assign(message, { subtype: 'file_share', text: `Shared release notes ${channel}:${i}`, files: [file(id, user)] });
        }
        if (kind === 9) Object.assign(message, { reactions: [{ name: 'thumbsup', count: 3, users: [userId(0), userId(1)] }, { name: 'sparkles', count: 1, users: [userId(2)] }], pinned_to: [channelId(channel)] });
        if (kind === 10) message.text = `Hello <@${userId(1)}> — see <#${channelId(1)}|engineering>, <https://example.test/releases/${i}|release notes> and :tada: 🎉.\nLiteral &amp; &lt;script&gt; text.`;
        if (kind === 11) Object.assign(message, { text: `Edited release summary ${channel}:${i}`, edited: { user, ts: `${Number(timestamp.split('.')[0]) + 60}.000001` } });
        if (kind === 12) Object.assign(message, { subtype: 'channel_topic', topic: `Release ${i}`, text: `<@${user}> updated the topic to Release ${i}.` });
        if (kind === 13) Object.assign(message, { subtype: 'channel_purpose', purpose: `Coordinate release ${i}`, text: `<@${user}> updated the channel purpose.` });
        if (kind === 14) Object.assign(message, { subtype: 'channel_name', old_name: `${names[channel]}-old`, name: names[channel], text: `<@${user}> renamed the channel to ${names[channel]}.` });
        if (kind === 15) Object.assign(message, { subtype: 'pinned_item', item_type: 'F', item: file(`F${String(channel * 1000 + rootIndex + 7).padStart(8, '0')}`, rows[rootIndex + 7].user), channel: channelId(channel), text: `<@${user}> pinned the release notes.` });
        if (kind === 16) Object.assign(message, { subtype: 'reminder_add', team: 'T00000001', text: `<@${user}> set a reminder to review the release notes tomorrow.` });
        // A bot-user message also exercises historical directory bot identity.
        if (kind === 17) message.user = userId(38);
        if (channel === 0 && i === 0) message.text += ' THREAD_ROOT_CANARY_NOOK_R1';
        if (channel === 0 && i === 5) message.text += ' BOT_CANARY_NOOK_R1';
        if (channel === 0 && i === 11) message.text += ' EDITED_CANARY_NOOK_R1';
        if (channel === 0 && i === 990) message.text += ' HISTORY_SEARCH_CANARY_NOOK_R1';
        rows.push(message);
    }
    return rows;
}

/** Each call returns fresh entries; callers may deliberately change a test variant. */
export function realisticSlackEntries({ supplyMissingFile = false, includeFileBytes = true, includeUnknown = false } = {}) {
    const entries = [['users.json', realisticUsers()], ['channels.json', realisticChannels()]], bytes = new Map();
    for (let channel = 0; channel < 5; channel++) {
        const days = new Map(), rows = channelMessages(channel);
        if (includeUnknown && channel === 0) rows[999] = { ...rows[999], subtype: 'future_unknown_record', unknown_payload: { mode: 'uninterpreted' } };
        for (const row of rows) {
            const day = date(row.ts);
            if (!days.has(day)) days.set(day, []);
            days.get(day).push(row);
            for (const f of row.files ?? []) if (includeFileBytes && (f.id !== 'FMISSING01' || supplyMissingFile)) bytes.set(`files/${f.id}/${f.name}`, realisticFileBytes(f.id));
        }
        entries.push(...[...days].map(([day, records]) => [`${names[channel]}/${day}.json`, records]));
    }
    entries.push(...bytes);
    return entries;
}

export function realisticSlackFixture(options = {}) {
    return zipFixture(realisticSlackEntries(options), { deflate: true, descriptor: true });
}

/** Pilot-facing archive, reference metadata and exact source markers. */
export function realisticFixture(options = {}) {
    const entries = realisticSlackEntries(options), rows = entries.filter(([path]) => path.startsWith('general/')).flatMap(([, records]) => records);
    const record = index => rows[index];
    return {
        zip: zipFixture(entries, { deflate: true, descriptor: true }), channels: realisticChannels(),
        missingFile: { ...record(8).files[0], sourceId: channelId(0), ts: record(8).ts },
        suppliedFiles: entries.filter(([path]) => path.startsWith('files/')).map(([path, bytes]) => ({ path, bytes: Buffer.from(bytes) })),
        markers: { channel: channelId(0), threadRoot: record(0), threadReply: record(1), broadcast: record(2),
            bot: record(5), app: record(6), suppliedFile: record(7), missingFile: record(8), edited: record(11),
            historySearch: record(990), unknown: options.includeUnknown ? record(999) : null }
    };
}

/** Source counts describe the corpus, never a claim of importer admission. */
export function realisticSlackManifest(options = {}) {
    const entries = realisticSlackEntries(options), messages = entries.filter(([path]) => /^[^/]+\/\d{4}-\d{2}-\d{2}\.json$/.test(path)).flatMap(([, rows]) => rows);
    const kinds = {};
    for (const m of messages) kinds[m.subtype ?? (m.bot_id ? 'app_message' : 'message')] = (kinds[m.subtype ?? (m.bot_id ? 'app_message' : 'message')] ?? 0) + 1;
    return { channels: 6, emptyChannels: [channelId(5)], users: 40, deletedUsers: 4, botUsers: 2,
        duplicateEmailSourceIds: [userId(1), userId(2)], messages: messages.length, threadReplies: messages.filter(m => m.thread_ts && m.thread_ts !== m.ts).length,
        firstTimestamp: ts(0, 0), lastTimestamp: ts(999, 4), calendarMonths: 15,
        kinds, filesReferenced: messages.reduce((n, m) => n + (m.files?.length ?? 0), 0),
        suppliedFiles: entries.filter(([path]) => path.startsWith('files/')).length,
        suppliedBytes: entries.filter(([path]) => path.startsWith('files/')).reduce((n, [, value]) => n + value.length, 0),
        missingFileId: options.supplyMissingFile && options.includeFileBytes !== false ? null : 'FMISSING01',
        unknownVariant: options.includeUnknown === true };
}
