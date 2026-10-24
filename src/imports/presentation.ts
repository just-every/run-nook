import {allowedGrant} from '../team/access';
import { actorLabel, missingFileRefs, referencedActors } from './slack-records.mjs';
import type { Context } from '../platform/storage/context';
import { slackPlainText } from './slack-text.mjs';
import type { SlackPresentation } from './SlackHistory';
async function sourceNames(c: Context, row: any, source: any) {
    const refs = referencedActors(source), people = refs.length ? await c.rows('SELECT source_id,source_record FROM nook_import_actors WHERE job=? AND source_id IN (SELECT value FROM json_each(?))', [row.job, JSON.stringify(refs)], row.conversation) : [];
    return new Map<string,string>(people.map((p: any): [string, string] => [p.source_id, actorLabel(JSON.parse(p.source_record))]));
}
// Imported records keep Slack's original text (its fidelity is checked on every
// plan and archive); the plain reading is derived here. An unlabeled reference
// to a channel that was not imported shows its Slack ID.
async function channelNames(c: Context, row: any) {
    const rows = row.body.includes('<#') ? await c.rows(`SELECT ch.source_id,ch.source_record FROM nook_import_channels ch JOIN nook_members m ON m.conversation=ch.conversation WHERE ch.job=? AND m.user=? AND ${allowedGrant('m.user','m.conversation')}`, [row.job,c.uid], row.conversation) : [];
    return new Map<string,string>(rows.map((r: any): [string, string] => [r.source_id, JSON.parse(r.source_record).name]).filter(([, name]) => typeof name === 'string'));
}
const displayText = async (c: Context, row: any, names: Map<string,string>) => slackPlainText(row.body, names, await channelNames(c, row));
export async function slackText(c: Context, row: any, source: any) { return displayText(c, row, await sourceNames(c, row, source)); }
export async function slackPresentation(c: Context, row: any, source: any, files: any[]): Promise<SlackPresentation> {
    const names = await sourceNames(c, row, source);
    const links=[];
    for (const match of row.body.matchAll(/https:\/\/[A-Za-z0-9.-]+\.slack\.com\/archives\/([A-Za-z0-9_.-]+)\/p(\d{7,18})/g)) {
        if (links.length>=50) break;
        const digits=match[2],timestamp=digits.slice(0,-6)+'.'+digits.slice(-6);
        const target=await c.one(`SELECT r.id,r.conversation FROM nook_import_records r JOIN nook_import_channels ch ON ch.conversation=r.conversation AND ch.job=r.job JOIN nook_members m ON m.conversation=r.conversation WHERE r.job=? AND ch.source_id=? AND r.source_timestamp=? AND m.user=? AND ${allowedGrant('m.user','m.conversation')}`,[row.job,match[1],timestamp,c.uid],row.conversation);
        links.push({url:match[0],href:target?`/app?conversation=${encodeURIComponent(target.conversation)}&focus=${encodeURIComponent(target.id)}`:null});
    }
    return { links, pinned:Array.isArray(source.pinned_to)&&source.pinned_to.includes(row.key.split(':')[1]), text: await displayText(c, row, names), edited: !!source.edited, missingFiles: missingFileRefs(source, files), reactions: (Array.isArray(source.reactions) ? source.reactions : []).filter((r: any) => typeof r?.name === 'string' && Number.isSafeInteger(r.count) && Array.isArray(r.users)).map((r: any) => ({ name: r.name, count: r.count, people: r.users.map((id: string) => names.get(id) ?? id) })) };
}
