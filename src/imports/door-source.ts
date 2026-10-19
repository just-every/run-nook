import { canonicalJson, sha256, type ImportMapping, type ParsedRecord, type Json } from './kit';
import { kitSource } from './source';
import { decodeRoleCapture, encodeRoleEffect } from './role-decisions';
import { assertImportEffect } from './formats.mjs';
import { assertLocalCredentials } from './browser-runtime/credentials';

export const vendors = { slack: 'Slack', campfire: 'Campfire', mattermost: 'Mattermost' } as const;
export type ImportVendor = keyof typeof vendors;
export const doorKey = 'nook-history-imports-v1';
export function sourceName(name: string) {
  const [kind, ...rest] = name.split(':');
  if (!Object.hasOwn(vendors, kind) || rest.length > 1 || rest.length && !/^[A-Za-z0-9_.-]{1,128}$/.test(rest[0])) return null;
  return {kind: kind as ImportVendor, workspace: rest[0] ?? null};
}
export const stableDoorId = (kind: string, namespace: string) => 'door-' + sha256(canonicalJson([kind, namespace])).slice(0, 40);
export const doorDomainJob = (kind: string, namespace: string) => kind + '-' + sha256(canonicalJson([kind, namespace])).slice(0, 40);

/** The owner uploads the normalized capture, never the source database or ZIP.
 * The server independently validates the reader's native effects and authority. */
export function decodeDoorPacket(input: any, kind: ImportVendor, workspace: string | null, owner: string, users: any[]) {
  if (!input || input.version !== 1 || input.sourceType !== kind || typeof input.namespace !== 'string'
    || !/^[A-Za-z0-9_.-]{1,128}$/.test(input.namespace) || workspace && input.namespace !== workspace
    || !input.capture || input.capture.namespace !== input.namespace || input.capture.archiveDigest !== input.archiveDigest
    || !/^[a-f0-9]{64}$/.test(input.archiveDigest)) throw Error('Invalid reviewed source bundle');
  assertLocalCredentials(input);
  const capture = structuredClone(input.capture);
  decodeRoleCapture(capture);
  for (const message of capture.messages ?? []) for (const file of message.files ?? []) {
    if (typeof file.base64 !== 'string') throw Error('Original file bytes required');
    file.bytes = Buffer.from(file.base64, 'base64');
    if (file.bytes.toString('base64') !== file.base64 || file.bytes.length !== file.size || sha256(file.bytes) !== file.sha256) throw Error('Original file checksum changed');
    delete file.base64;
  }
  const stable = stableDoorId(kind, input.namespace), domainJob = doorDomainJob(kind, input.namespace);
  const generated = kitSource(capture, owner, stable, stable);
  const effects = generated.source.records.map(record => {
    const value = structuredClone(record.payload) as any;
    value.job = domainJob;
    encodeRoleEffect(record.kind,value);
    if (record.kind === 'message') for (const file of value.files) file.objectKey = file.objectKey.replace('/' + generated.domainJob + '/', '/' + domainJob + '/');
    assertImportEffect(record.kind, value);
    if (record.kind === 'channel' && (!value.members.every((id: string) => users.some(u => u.id === id && u.active))
      || value.members.some((id: string) => !value.guestMembers.includes(id) && users.find(u => u.id === id)?.mode !== 'member'))) throw Error('Reviewed audience is no longer active');
    if (record.kind === 'actor' && value.association !== null && !users.some(u => u.id === value.association && u.active)) throw Error('Reviewed identity is no longer active');
    return {kind: record.kind, sourceId: record.kind === 'actor' ? domainJob + ':' + value.sourceId : record.sourceId, payload: value as Json};
  });
  if (!effects.length) throw Error('No selected source records');
  const ids = new Set([owner, ...effects.flatMap(e => e.kind === 'channel' ? (e.payload as any).members : e.kind === 'actor' && (e.payload as any).association ? [(e.payload as any).association] : [])]);
  const authority = users.filter(u => ids.has(u.id)).map(({id, version, mode, generation}) => ({id, version, mode, generation})).sort((a,b) => a.id.localeCompare(b.id));
  return {packet: input, capture, effects, domainJob, stable, authority};
}
export type DoorCapture = ReturnType<typeof decodeDoorPacket>;
export function importSource(name: string, owner: string, users: any[]) {
  const listed = sourceName(name);
  if (!listed) return null;
  let decoded: DoorCapture | undefined;
  const mapping: ImportMapping = {version: 'nook-' + listed.kind + '-door-v1', map(record) {
    assertImportEffect(record.kind, record.payload);
    const value = record.payload as any;
    return {effects: [{targetKind: record.kind, targetId: record.kind === 'actor' ? record.sourceId : value.id, value}]};
  }};
  return {mapping, ownerPrincipalId: owner, parse(value: Json, index: number): ParsedRecord[] {
    if (index !== 0 || Array.isArray(value)) throw Error('One reviewed source bundle required');
    decoded = decodeDoorPacket(value, listed.kind, listed.workspace, owner, users);
    return decoded.effects;
  }, get capture() { return decoded; }, ...listed};
}
