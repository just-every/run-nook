import { slackText } from './presentation';
import { messageAuthorLabel } from './slack-records.mjs';
import {allowedGrant} from '../team/access';
import { fail, text } from '../family/team-chat/domain';
import type { Context } from '../platform/storage/context';
import { historicalMessage, importedSelect, publishedImport, sourceCreated } from './projection';
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
export async function mixedSearch(c: Context, input: Record<string, any>, source?:string) {
    const q = text(input.q, 128).toLowerCase();
    if (Array.from(q).length < 3)
        fail(400, 'Substring search requires at least three characters');
    const after = input.after ? Number(input.after) : 0;
    if (!Number.isSafeInteger(after) || after < 0)
        fail(400, 'Invalid search cursor');
    const scopes = await c.rows(`SELECT m.conversation FROM nook_members m WHERE m.user=? AND ${allowedGrant('m.user','m.conversation')} AND NOT EXISTS(SELECT 1 FROM nook_import_channels ch JOIN nook_imports j ON j.id=ch.job WHERE ch.conversation=m.conversation AND (j.state<>'complete' OR NOT (${publishedImport}))) ORDER BY m.conversation LIMIT 1000`, [c.uid]);
    if (!scopes.length) return { items: [], cursor: String(after), hasMore: false, examined: 0, semantics: 'case-insensitive exact substring; minimum three characters' };
    const quote = (value: string) => '"' + value.replaceAll('"', '""') + '"';
    // Imported Slack text stores a literal &, < or > in Slack's escaped form; the
    // reader sees and searches the plain character (see slack-text.mjs).
    const escaped = q.replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[ch]!);
    const body = escaped === q ? 'body_lower:' + quote(q) : '(body_lower:' + quote(q) + ' OR (source:"imported" AND body_lower:' + quote(escaped) + '))';
    const phrase = (source?'source:'+quote(source)+' AND ':'')+body + ' AND (' + scopes.map(s => 'scope:' + quote('|' + s.conversation + '|')).join(' OR ') + ')';
    const candidates = await c.rows(`WITH candidates AS MATERIALIZED (SELECT rowid AS position,message,conversation,source FROM nook_search WHERE nook_search MATCH ? AND rowid>? ORDER BY rowid LIMIT 101) SELECT p.*,m.body AS native_body,m.parent AS native_parent,m.retained_body AS native_retained,CASE WHEN m.retained_body=1 THEN 'Former member' ELSE o.display_name END AS display_name,r.body AS import_body,r.retained_body AS import_retained,r.parent AS import_parent,r.source_actor,r.source_timestamp,r.key,r.job AS import_job,r.source_record AS message_source_record,a.source_record AS actor_record,a.association,j.namespace FROM candidates p LEFT JOIN nook_message_history m ON p.source='native' AND m.id=p.message LEFT JOIN oa_operators o ON o.id=m.author LEFT JOIN nook_import_history r ON p.source='imported' AND r.id=p.message LEFT JOIN nook_imports j ON j.id=r.job LEFT JOIN nook_import_actors a ON a.job=r.job AND a.source_id=r.source_actor WHERE EXISTS(SELECT 1 FROM nook_members audience WHERE audience.conversation=p.conversation AND audience.user=? AND ${allowedGrant('audience.user','audience.conversation')}) AND ((p.source='native' AND m.deleted=0) OR (p.source='imported' AND j.state='complete' AND ${publishedImport})) ORDER BY p.position`, [phrase, after, c.uid]);
    const items = await Promise.all(candidates.slice(0, 100).map(async r => r.source === 'native' ? { id: r.message, conversation: r.conversation, body: r.native_body, parent: r.native_parent, authorName: r.display_name,...(r.native_retained?{immutable:true,retainedSource:'native'}:{}) } : r.import_retained?{id:r.message,conversation:r.conversation,body:r.import_body,parent:r.import_parent,author:null,authorName:'Former member',immutable:true,retainedSource:'imported'} : { id: r.message, conversation: r.conversation, body: r.import_body, displayBody: await slackText(c, {...r, job: r.import_job, body: r.import_body}, JSON.parse(r.message_source_record)), parent: r.import_parent, author: null, authorName: messageAuthorLabel(JSON.parse(r.actor_record), JSON.parse(r.message_source_record)) ?? r.source_actor, immutable: true, provenance: { namespace: r.namespace, key: r.key, actor: r.source_actor, label: messageAuthorLabel(JSON.parse(r.actor_record), JSON.parse(r.message_source_record)) ?? r.source_actor, association: r.association, timestamp: r.source_timestamp } }));
    return { items, cursor: String(candidates[Math.min(candidates.length, 100) - 1]?.position ?? after), hasMore: candidates.length > 100, examined: candidates.length, semantics: 'case-insensitive exact substring across native and immutable imported history; minimum three characters; continuation required' };
}
