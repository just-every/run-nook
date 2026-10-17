import {searchMessages} from '../search/server';
import { fail } from '../family/team-chat/domain';
import type { Context } from '../platform/storage/context';
import { historicalMessage, importedSelect, sourceCreated } from './projection';
/** New private destinations present their immutable source history first, followed
 * by native sequence order. Native read/unread cursors remain wholly native. */
export async function mixedHistory(c: Context, id: string, input: Record<string, any>, native: (input: Record<string, any>) => Promise<any[]>) {
    await c.check(id);
    const limit = input.limit ?? 100, after = input.after ?? '';
    if (typeof after !== 'string' || !Number.isSafeInteger(limit) || limit < 1 || limit > 1000)
        fail(400, 'Invalid history page');
    let sourceSeq = 0, nativeAfter = after;
    if (after) {
        const sourceId = after.slice(after.indexOf('Z') + 1), cursor = await c.one(`${importedSelect} WHERE r.id=? AND r.conversation=?`, [sourceId, id], id);
        if (cursor) {
            if (sourceCreated(cursor.source_timestamp) + cursor.id !== after)
                fail(400, 'History cursor unavailable');
            sourceSeq = cursor.sequence;
            nativeAfter = '';
        }
        else
            return native(input);
    }
    const rows = await c.rows(`${importedSelect} WHERE r.conversation=? AND r.sequence>? ORDER BY r.sequence LIMIT ?`, [id, sourceSeq, limit], id), messages = [];
    for (const row of rows)
        messages.push(await historicalMessage(c, row));
    if (messages.length < limit)
        messages.push(...await native({ ...input, after: nativeAfter, limit: limit - messages.length }));
    return messages;
}
export async function mixedSearch(c: Context, input: Record<string, any>, source?:'native'|'imported') {
    return searchMessages(c,input,source);
}
