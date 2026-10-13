import { fail } from '../family/team-chat/domain';
import type { Context } from '../platform/storage/context';
import { firstUnreadMessage, historyPage, historyWindow } from '../platform/storage/history';
import { historicalMessage, importedSelect } from './projection';

/** Imported display positions end at -1. They never enter native event, unread
 * or read-barrier calculations. Each destination has one immutable import. */
export async function mixedWindow(c: Context, id: string, input: Record<string, any>) {
    await c.check(id);
    const last = await c.one(`${importedSelect} WHERE r.conversation=? ORDER BY r.sequence DESC LIMIT 1`, [id], id);
    if (!last) return historyWindow(c, id, input);
    const limit = input.limit ?? 50, before = input.before == null || input.before === '' ? null : Number(input.before);
    const thread = input.thread || null, around = input.around || null, firstUnread = input.firstUnread === true;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000 ||
        before !== null && !Number.isSafeInteger(before) ||
        around && before !== null || thread && typeof thread !== 'string' || around && typeof around !== 'string' ||
        firstUnread && (before !== null || thread || around))
        fail(400, 'Invalid history window');
    const snapshot = await c.one('SELECT c.seq AS frontier,COALESCE(r.seq,0) AS readSeq FROM nook_conversations c LEFT JOIN nook_reads r ON r.conversation=c.id AND r.user=? WHERE c.id=?', [c.uid, id], id);
    const offset = (last?.sequence ?? 0) + 1;
    async function lookup(messageId: string, focus = false) {
        const native = (await historyPage(c, id, 'm.id=?' + (focus ? ' AND (m.deleted=0 OR (m.parent IS NULL AND EXISTS(SELECT 1 FROM nook_message_history reply WHERE reply.conversation=m.conversation AND reply.parent=m.id AND reply.deleted=0)))' : ''), [messageId], 1))[0];
        if (native) return native;
        const row = await c.one(`${importedSelect} WHERE r.conversation=? AND r.id=?`, [id, messageId], id);
        return row ? historicalMessage(c, { ...row, display_sequence: row.sequence - offset }) : null;
    }
    const unread = firstUnread ? await firstUnreadMessage(c, id, snapshot.readSeq) : null;
    const targetId = around ?? unread?.id ?? null;
    const target = targetId ? await lookup(targetId, true) : null;
    if (around && !target) fail(404, 'Message unavailable');
    const effectiveThread = thread ?? target?.parent ?? null, rootId = effectiveThread ?? target?.id ?? null;
    const root = rootId ? await lookup(rootId) : null;
    if (rootId && (!root || root.parent)) fail(404, 'Thread root unavailable');
    if (thread && target && target.id !== thread && target.parent !== thread) fail(404, 'Message unavailable in this thread');
    const nativeFilter = effectiveThread ? 'm.parent=?' : 'm.parent IS NULL';
    const sourceFilter = effectiveThread ? 'r.parent=?' : 'r.parent IS NULL';
    const params = effectiveThread ? [effectiveThread] : [];
    async function page(bound: number | null, comparison: '<' | '>=' | '>', count: number, descending = false) {
        if (!count) return [];
        const natives = await historyPage(c, id, nativeFilter + (bound === null ? '' : ` AND m.sequence${comparison}?`), bound === null ? params : [...params, bound], count, descending);
        const rows = await c.rows(`${importedSelect} WHERE r.conversation=? AND ${sourceFilter}${bound === null ? '' : ` AND r.sequence${comparison}?`} ORDER BY r.sequence ${descending ? 'DESC' : 'ASC'} LIMIT ?`, [id, ...params, ...(bound === null ? [] : [bound + offset]), count], id);
        const sources = [];
        for (const row of rows) sources.push(await historicalMessage(c, { ...row, display_sequence: row.sequence - offset }));
        return [...natives, ...sources].sort((a, b) => (a.sequence - b.sequence) * (descending ? -1 : 1)).slice(0, count);
    }
    let items: any[];
    if (target && (!effectiveThread || target.id !== effectiveThread)) {
        const prior = await page(target.sequence, '<', Math.floor(limit / 2), true);
        items = [...prior.reverse(), ...await page(target.sequence, '>=', limit - prior.length)];
    } else items = (await page(before, '<', limit, true)).reverse();
    const cursor = items[0]?.sequence ?? before;
    const earlier = cursor == null ? [] : await page(cursor, '<', 1, true);
    const later = items.length ? await page(items.at(-1).sequence, '>', 1) : [];
    const visible = [...items, ...(root ? [root] : [])].filter(m => !m.immutable||m.retainedSource==='native');
    const barrier = await c.one(`SELECT MIN(sequence) AS sequence FROM (SELECT (SELECT m.sequence FROM nook_message_history m WHERE m.conversation=a.conversation AND m.author=a.user AND m.deleted=0 AND m.sequence>? AND m.id NOT IN (SELECT value FROM json_each(?)) ORDER BY m.sequence LIMIT 1) AS sequence FROM nook_author_counts a WHERE a.conversation=? AND a.user<>?)`, [snapshot.readSeq, JSON.stringify(visible.map(m => m.id)), id, c.uid], id);
    const renderedThrough = Math.max(snapshot.readSeq, ...visible.map(m => m.sequence));
    const readBarrierSeq = barrier?.sequence ?? null;
    const readThrough = Math.max(snapshot.readSeq, Math.min(renderedThrough, readBarrierSeq === null ? renderedThrough : readBarrierSeq - 1));
    return { items, root, target: target ? { id: target.id, parent: target.parent, root: rootId } : null, cursor: cursor == null ? null : String(cursor), freezeCursor: items.length ? String(items.at(-1).sequence + 1) : null, hasMore: !!earlier.length, hasNewer: !!later.length, frontier: snapshot.frontier, readSeq: snapshot.readSeq, readBarrierSeq, readThrough };
}
