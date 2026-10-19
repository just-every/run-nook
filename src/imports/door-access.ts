import { authBindings } from '../platform/operator-auth.server';
import { authority, authFence, context, type Context, type StorageBindings } from '../platform/storage/context';
import { owner } from './owner';
import { doorKey, sourceName } from './door-source';
import { verifyImportGrant } from '../base/modules/import-kit/src/door/grants';
import { writeImportDoorSettings, enableDoorAtFirstClaim } from '../base/modules/import-kit/src/door/authority';
import { sql, transact } from '../base/modules/import-kit/src/door/store';
import type { D1Sql } from './kit';
import { fail, Fault } from '../family/team-chat/domain';

export type DoorBindings = StorageBindings & {RER_OWNER_CLAIM_ISSUER?: string; RER_OWNER_CLAIM_INSTALLATION_ID?: string; RER_OWNER_CLAIM_PUBLIC_KEYS?: string; RER_IMPORT_DOOR?: string};
export function ownerPredicate(c: Context): D1Sql {
  return sql(`${authority} AND ${authFence} AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND status='active' AND role='owner')`, ...c.credentials, c.uid);
}
export const people = async (db: D1Database) => (await db.prepare("SELECT o.id,o.email,o.display_name AS name,o.version,a.mode,a.generation FROM oa_operators o JOIN nook_access a ON a.user=o.id AND a.active=1 WHERE o.status='active' ORDER BY o.id").all<any>()).results.map(u => ({...u, active: true}));
export function claimConfig(bindings: DoorBindings) {
  const env = authBindings(bindings) as DoorBindings;
  if (!env.RER_OWNER_CLAIM_ISSUER || !env.RER_OWNER_CLAIM_INSTALLATION_ID || !env.RER_OWNER_CLAIM_PUBLIC_KEYS) return null;
  return {issuer: env.RER_OWNER_CLAIM_ISSUER, installationId: env.RER_OWNER_CLAIM_INSTALLATION_ID, appOrigin: env.AUTH_ORIGIN, expectedEmail: env.OWNER_EMAIL, publicKeys: JSON.parse(env.RER_OWNER_CLAIM_PUBLIC_KEYS)};
}
export async function ownerAccess(env: DoorBindings, request: Request) {
  const c = await context(env, request.headers); await owner(c);
  const predicate = ownerPredicate(c);
  if (env.RER_IMPORT_DOOR === 'on' && claimConfig(env)) await enableDoorAtFirstClaim(c.db, doorKey, predicate);
  if (!await c.db.prepare('SELECT 1 FROM ik_door_settings WHERE installation_id=?').bind(doorKey).first()) await writeImportDoorSettings(c.db, doorKey, {enabled: false}, predicate);
  return {c, predicate};
}
export async function access(env: DoorBindings, request: Request, input: any, selectedSource?: (namespace: string) => void) {
  const path = new URL(request.url).pathname;
  const ownerRow = await env.DB.prepare("SELECT id,email FROM oa_operators WHERE role='owner' AND status='active' AND lower(email)=lower(?)").bind(authBindings(env).OWNER_EMAIL).first<{id: string; email: string}>();
  if (!ownerRow) throw new Fault(503, 'Workspace owner unavailable');
  if (path.startsWith('/api/rer/import/')) {
    const claim = claimConfig(env); if (!claim) throw new Fault(404, 'Import door unavailable');
    const token = request.headers.get('Authorization'); if (!token?.startsWith('Bearer ')) throw new Fault(401, 'Import grant required');
    const {grant, kid} = await verifyImportGrant(token.slice(7), claim);
    selectedSource?.(grant.namespace);
    if (grant.action !== path.split('/').at(-1) || new URL(request.url).origin !== claim.appOrigin) fail(403, 'Import grant binding changed');
    const predicate = sql(`EXISTS(SELECT 1 FROM ik_door_settings WHERE installation_id=? AND enabled=1) AND NOT EXISTS(SELECT 1 FROM ik_door_revoked_keys WHERE installation_id=? AND kid=?) AND unixepoch()<? AND ${authority}`, doorKey, doorKey, kid, grant.exp);
    if (!await env.DB.prepare('SELECT 1 FROM ik_door_settings WHERE installation_id=? AND enabled=1').bind(doorKey).first()) throw new Fault(404, 'Import door unavailable');
    if (!await env.DB.prepare(`SELECT 1 WHERE (${predicate.sql}) AND NOT EXISTS(SELECT 1 FROM ik_door_grants WHERE installation_id=? AND jti=?)`).bind(...predicate.params ?? [], doorKey, grant.jti).first()) throw new Fault(403, 'Import grant replayed, revoked or expired');
    return {principal: ownerRow.id, email: ownerRow.email, namespace: grant.namespace, predicate, claim, grant, kid, c: undefined};
  }
  const {c, predicate} = await ownerAccess(env, request);
  if (c.uid !== ownerRow.id) fail(403, 'Only the configured workspace owner can import history');
  if (request.method !== 'GET' && request.headers.get('Origin') !== new URL(request.url).origin) fail(403, 'Origin required');
  const vendor = request.headers.get('X-Import-Source') ?? '';
  if (!sourceName(vendor) || vendor.includes(':')) fail(400, 'Unknown import source');
  const workspace = request.headers.get('X-Import-Namespace');
  let namespace = workspace ? vendor + ':' + workspace : vendor;
  if (typeof input.planId === 'string') {
    const row = await env.DB.prepare('SELECT namespace FROM ik_door_plans WHERE id=? AND installation_id=?').bind(input.planId, doorKey).first<{namespace: string}>();
    if (row && sourceName(row.namespace)?.kind === vendor && (!workspace || namespace === row.namespace)) namespace = row.namespace;
  }
  if (!sourceName(namespace)) fail(400, 'Invalid source workspace namespace');
  return {principal: ownerRow.id, email: ownerRow.email, namespace, predicate, claim: null, grant: undefined, kid: undefined, c};
}
export async function fencedBatch(env: DoorBindings, predicate: D1Sql, statements: D1Sql[]) {
  await transact(env.DB as any, predicate, statements);
}
export async function businessSettings(db: D1Database) {
  const row = await db.prepare('SELECT enabled FROM ik_door_settings WHERE installation_id=?').bind(doorKey).first<{enabled: number}>();
  const revoked = await db.prepare('SELECT kid FROM ik_door_revoked_keys WHERE installation_id=? ORDER BY kid').bind(doorKey).all<{kid: string}>();
  return {enabled: row?.enabled === 1, revokedKeys: revoked.results.map(r => r.kid)};
}
