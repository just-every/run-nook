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
    const rows = row.body.includes('<#') ? await c.rows('SELECT source_id,source_record FROM nook_import_channels WHERE job=?', [row.job], row.conversation) : [];
    return new Map<string,string>(rows.map((r: any): [string, string] => [r.source_id, JSON.parse(r.source_record).name]).filter(([, name]) => typeof name === 'string'));
}
const displayText = async (c: Context, row: any, names: Map<string,string>) => slackPlainText(row.body, names, await channelNames(c, row));
export async function slackText(c: Context, row: any, source: any) { return displayText(c, row, await sourceNames(c, row, source)); }
export async function slackPresentation(c: Context, row: any, source: any, files: any[]): Promise<SlackPresentation> {
    const names = await sourceNames(c, row, source);
    return { text: await displayText(c, row, names), edited: !!source.edited, missingFiles: missingFileRefs(source, files), reactions: (Array.isArray(source.reactions) ? source.reactions : []).filter((r: any) => typeof r?.name === 'string' && Number.isSafeInteger(r.count) && Array.isArray(r.users)).map((r: any) => ({ name: r.name, count: r.count, people: r.users.map((id: string) => names.get(id) ?? id) })) };
}
