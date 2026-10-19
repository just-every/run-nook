/** Source role names are data, never JSON member names at the shared door.
 * The existing reader's hashed capture keeps its original decision map; this
 * lossless wire codec restores it only for local validation/normalization. */
type Decision = {sourceRole: string; decision: 'historical-only'};
const validRole = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_.-]{1,128}$/.test(value);
export function decisionEntries(map: Record<string, unknown>): Decision[] {
  if (!map || typeof map !== 'object' || Array.isArray(map) || !Object.keys(map).every(validRole) || !Object.values(map).every(value => value === 'historical-only')) throw Error('Invalid historical role decisions');
  return Object.entries(map).sort(([a],[b]) => a.localeCompare(b)).map(([sourceRole]) => ({sourceRole,decision:'historical-only'}));
}
export function decisionMap(entries: unknown, inventory?: string[]): Record<string, 'historical-only'> {
  if (!Array.isArray(entries) || !entries.every(entry => entry && typeof entry === 'object' && Object.keys(entry).sort().join() === 'decision,sourceRole' && validRole(entry.sourceRole) && entry.decision === 'historical-only') || new Set(entries.map(entry => entry.sourceRole)).size !== entries.length) throw Error('Invalid historical role decisions');
  const map = Object.fromEntries(entries.map(entry => [entry.sourceRole,'historical-only' as const]));
  if (inventory && JSON.stringify(Object.keys(map).sort()) !== JSON.stringify([...inventory].sort())) throw Error('Historical role inventory changed');
  return map;
}
export function encodeRolePacket(packet: any): void {
  if (packet.sourceType !== 'mattermost') return;
  packet.review.roles = decisionEntries(packet.review.roles);
  const capture = packet.capture;
  capture.roles = decisionEntries(capture.roles);
  for (const item of [...capture.channels,...capture.actors]) item.sourceRecord.roleDecisions = decisionEntries(item.sourceRecord.roleDecisions);
}
export function decodeRoleCapture(capture: any): void {
  if (capture.sourceType !== 'mattermost') return;
  capture.roles = decisionMap(capture.roles,capture.source.roleInventory);
  for (const item of [...capture.channels,...capture.actors]) item.sourceRecord.roleDecisions = decisionMap(item.sourceRecord.roleDecisions,capture.source.roleInventory);
}
export function encodeRoleEffect(kind: string, value: any): void {
  if (value.sourceRecord?.nookSource === 'mattermost' && ['channel','actor'].includes(kind)) value.sourceRecord.roleDecisions = decisionEntries(value.sourceRecord.roleDecisions);
}
