// Explicit format policy. Unknown subtypes never become ordinary messages.
export const systemSubtypes = new Set(['channel_join', 'channel_leave', 'channel_topic', 'channel_purpose', 'channel_name', 'pinned_item', 'unpinned_item']);
export const contentSubtypes = new Set(['bot_message', 'file_share', 'thread_broadcast', 'reminder_add']);
export const isAutomation = actor => actor?.is_bot === true || actor?.is_app_user === true;
export const actorLabel = actor => [actor?.real_name, actor?.profile?.display_name, actor?.profile?.real_name, actor?.name, actor?.id].find(value => typeof value === 'string' && value.length > 0);
export const messageAuthorLabel = (actor, source) => (isAutomation(actor) || source?.bot_id || source?.subtype === 'bot_message') ? [source?.username, source?.bot_profile?.name, actorLabel(actor)].find(value => typeof value === 'string' && value.length > 0) : actorLabel(actor);
export const sourceActorId = message => message.bot_id ?? message.user;
export function sourceFileRefs(source) {
    if (source.files !== undefined && !Array.isArray(source.files)) throw Error('SLACK_INVALID: file metadata');
    if (source.file !== undefined && (!source.file || typeof source.file !== 'object' || Array.isArray(source.file))) throw Error('SLACK_INVALID: file metadata');
    return [...(source.files ?? []), ...(source.file === undefined ? [] : [source.file])];
}
export const missingFileRefs = (source, supplied) => sourceFileRefs(source).filter(f => !supplied.some(s => s.sourceId === f.id)).map(f => ({ sourceId: f.id, name: f.name, size: f.size ?? null }));
export function referencedActors(message) {
    return [...new Set([...message.text.matchAll(/<@([A-Za-z0-9_.-]+)(?:\|[^>]+)?>/g)].map(m => m[1]).concat((Array.isArray(message.reactions) ? message.reactions : []).flatMap(r => Array.isArray(r?.users) ? r.users.filter(u => typeof u === 'string') : [])))];
}
export function validateMessageMetadata(message) {
    if (message.edited !== undefined && (!message.edited || typeof message.edited !== 'object' || typeof message.edited.ts !== 'string' || !/^\d{1,12}\.\d{6}$/.test(message.edited.ts))) throw Error('SLACK_INVALID: edited metadata');
    if (message.reactions !== undefined && (!Array.isArray(message.reactions) || message.reactions.some(r => !r || typeof r.name !== 'string' || !r.name || !Number.isSafeInteger(r.count) || r.count < 0 || !Array.isArray(r.users) || r.users.some(u => typeof u !== 'string')))) throw Error('SLACK_INVALID: reaction metadata');
}

export const missingFileInventory = files => files.map(f => ({ channel: f.key.split(':')[1], ...f })).sort((a, b) => { const x = `${a.key}:${a.sourceId}`, y = `${b.key}:${b.sourceId}`; return x < y ? -1 : x > y ? 1 : 0; });
