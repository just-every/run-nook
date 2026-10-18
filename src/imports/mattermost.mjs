import { readSlackZip, ZIP_LIMITS } from './zip.mjs';
import { strictJson } from './json.mjs';
import { mattermostRecords, mattermostReject as reject, sourceText, sourceObject } from './mattermost-records.mjs';

export const MATTERMOST_LIMITS = Object.freeze({...ZIP_LIMITS, records:100000, record:2*1024*1024, emojiBytes:128*1024});
const utf8 = bytes => {
  try { return new TextDecoder('utf-8', {fatal:true}).decode(bytes); }
  catch { reject('invalid UTF-8'); }
};

function declaration(line) {
  if (line.type !== 'version' || line.version !== 1 || !sourceObject(line.info)) reject('unsupported bulk export declaration');
  if (Object.keys(line).some(k => !['type','version','info'].includes(k))) reject('ambiguous version declaration');
  const info = line.info;
  // Format 1 alone is insufficient: different generators have different export
  // semantics. This reader supports the verified Mattermost 12 server schema.
  if (info.generator !== 'mattermost-server' || typeof info.version !== 'string' || !/^12\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?(?: \([^\r\n]*\))?$/.test(info.version)) reject('unsupported source version');
  sourceText(info.version, 256);
  const created = sourceText(info.created, 64);
  const match = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(?:\.\d{1,9})?(Z|[+-]\d\d:\d\d)$/.exec(created);
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 12 || Number(match[3]) < 1 || Number(match[3]) > new Date(Date.UTC(Number(match[1]), Number(match[2]), 0)).getUTCDate() || Number(match[4]) > 23 || Number(match[5]) > 59 || Number(match[6]) > 59 || !Number.isFinite(Date.parse(created)) || match[7] !== 'Z' && (Number(match[7].slice(1,3)) > 23 || Number(match[7].slice(4)) > 59)) reject('invalid export creation time');
  const source = {implementation:'mattermost-server', format:1, version:info.version, generator:info.generator, createdAt:created};
  if (info.additional !== undefined && info.additional !== null) {
    if (!sourceObject(info.additional)) reject('invalid source scope');
    const additional = {};
    for (const key of ['team_name','channel_name']) if (info.additional[key] !== undefined) additional[key] = sourceText(info.additional[key], 4096);
    if (Object.keys(info.additional).some(k => !['team_name','channel_name'].includes(k))) reject('unsupported source scope');
    source.additional = additional;
  }
  return source;
}

/** Memory-only inspection; never extracts paths, fetches URLs or retains auth. */
export function inspectMattermostArchive(input) {
  try {
    const archive = readSlackZip(input, MATTERMOST_LIMITS), bytes = archive.files.get('import.jsonl');
    if (!bytes) reject('root import.jsonl required');
    const lines = utf8(bytes).split('\n');
    if (lines.at(-1) === '') lines.pop();
    if (!lines.length || lines.length > MATTERMOST_LIMITS.records) reject('JSONL record limit');
    const records = lines.map((line, index) => {
      if (!line || Buffer.byteLength(line) > MATTERMOST_LIMITS.record) reject('empty or oversized JSONL record');
      let data;
      try { data = strictJson(line); } catch { reject('invalid or ambiguous JSONL'); }
      if (!sourceObject(data) || typeof data.type !== 'string') reject('invalid JSONL envelope');
      sourceText(data.type, 128);
      if (index && (data.type === 'version' || !Object.hasOwn(data, data.type) || !sourceObject(data[data.type]) || Object.keys(data).some(k => k !== 'type' && k !== data.type))) reject('ambiguous JSONL envelope');
      return {data, line:index + 1};
    });
    const source = declaration(records.shift().data);
    const {roleInventory, ...normalized} = mattermostRecords(records, archive.files, MATTERMOST_LIMITS);
    return {archiveDigest:archive.archiveDigest, source:{...source, roleInventory, teamCount:normalized.counts.teams, recordCounts:normalized.counts.sourceCounts, sourceRecords:records.length+1}, ...normalized};
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('MATTERMOST_INVALID:')) throw error;
    reject('unreadable or unsupported archive');
  }
}
