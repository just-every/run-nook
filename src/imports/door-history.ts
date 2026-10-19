import { readImportDoorHistory, writeImportDoorSettings } from '../base/modules/import-kit/src/door/authority';
import { sql } from '../base/modules/import-kit/src/door/store';
import { doorKey, sourceName, vendors } from './door-source';
import { businessSettings, fencedBatch, ownerPredicate, type DoorBindings } from './door-access';
import { queueOrphanedDoorFiles } from './door-custody';
import { listImports } from './list';
import { undoLegacy } from './legacy';
import { cleanupImportObjects } from './object-store';
import type { Context } from '../platform/storage/context';
import { fail } from '../family/team-chat/domain';

export async function history(c: Context, kind?: string) {
  const approvals = await readImportDoorHistory(c.db as any, doorKey, ownerPredicate(c));
  const links = await c.rows(`SELECT n.*,p.namespace AS door_namespace,p.fingerprint,p.job_id,j.state,j.checkpoint,j.total FROM nook_door_imports n JOIN ik_door_plans p ON p.id=n.plan_id LEFT JOIN ik_jobs j ON j.id=p.job_id WHERE n.owner=? ORDER BY n.created DESC`, [c.uid]);
  const jobs: any[] = links.filter(n => !kind || n.source_type === kind).map(n => ({...approvals.find(a => a.planId === n.plan_id), planId: n.plan_id, jobId: n.job_id, namespace: n.door_namespace, sourceNamespace: n.namespace, sourceType: n.source_type, state: n.state ?? 'reviewed', fingerprint: n.fingerprint, checkpoint: n.checkpoint ?? 0, total: n.total ?? 0, expiresAt: new Date(n.expires_at).toISOString(), summary: JSON.parse(n.summary_json), caption: approvals.find(a => a.planId === n.plan_id)?.caption ?? 'Dry run awaiting owner review'}));
  for (const vendor of Object.keys(vendors)) if (!kind || vendor === kind) {
    const legacy = await listImports(c, vendor);
    jobs.push(...legacy.jobs.map((entry: any) => ({...entry, legacy: true, sourceType: vendor, sourceNamespace: JSON.parse(JSON.stringify(entry.summary)).namespace, state: entry.job?.state ?? entry.state, jobId: entry.job?.id, checkpoint: entry.job?.checkpoint ?? 0, total: entry.job?.total ?? 0, caption: 'Approved by the workspace owner before the shared import door'})));
  }
  return {jobs, business: await businessSettings(c.db)};
}
export async function ownerAction(env: DoorBindings, c: Context, action: string, input: any, kind: string) {
  const predicate = ownerPredicate(c);
  if (action === 'history') return history(c, kind);
  if (action === 'settings' || action === 'revocations') {
    const current = await businessSettings(c.db);
    if (action === 'settings' && typeof input.enabled !== 'boolean') fail(400, 'Choose whether Business imports are enabled');
    await writeImportDoorSettings(c.db as any, doorKey, {enabled: action === 'settings' ? input.enabled : current.enabled, ...(action === 'revocations' ? {revokedKids: [input.kid]} : {})}, predicate);
    return businessSettings(c.db);
  }
  if (action === 'legacy-undo') return undoLegacy(c, input.review);
  if (action === 'cleanup') return {removed: await cleanupImportObjects(c)};
  if (action !== 'withdraw') return null;
  let uploadId = input.uploadId;
  if (input.planId) {
    const link = await c.one('SELECT n.*,p.namespace AS door_namespace,p.job_id FROM nook_door_imports n JOIN ik_door_plans p ON p.id=n.plan_id WHERE n.plan_id=? AND n.owner=?', [input.planId, c.uid]);
    if (!link || sourceName(link.door_namespace)?.kind !== kind) fail(404, 'Dry run unavailable');
    if (link.job_id || await c.one('SELECT 1 FROM ik_jobs WHERE operation_key=?', ['door:' + link.plan_id])) fail(409, 'This import has started; use guarded Undo');
    uploadId = link.upload_id;
    await fencedBatch(env, predicate, [
      queueOrphanedDoorFiles(link),
      sql('UPDATE ik_door_namespaces SET pending_id=NULL WHERE installation_id=? AND namespace=? AND pending_id=?', doorKey, link.door_namespace, link.plan_id),
      sql('DELETE FROM nook_door_imports WHERE plan_id=?', link.plan_id),
      sql('DELETE FROM ik_door_approvals WHERE plan_id=?', link.plan_id),
      sql('DELETE FROM ik_door_apply_failures WHERE plan_id=?', link.plan_id),
      sql('DELETE FROM ik_door_plan_chunks WHERE plan_id=?', link.plan_id),
      sql('DELETE FROM ik_door_plans WHERE id=? AND job_id IS NULL AND NOT EXISTS(SELECT 1 FROM ik_jobs WHERE operation_key=?)', link.plan_id, 'door:' + link.plan_id),
    ]);
  }
  if (typeof uploadId !== 'string') fail(400, 'Source upload required');
  const upload = await c.one('SELECT * FROM ik_door_uploads WHERE id=? AND installation_id=?', [uploadId, doorKey]);
  if (upload && sourceName(upload.namespace)?.kind !== kind) fail(403, 'Source upload belongs to another vendor');
  if (upload && await c.one('SELECT 1 FROM nook_door_imports WHERE upload_id=?', [uploadId])) fail(409, 'Source upload belongs to a retained import');
  await fencedBatch(env, predicate, [sql('DELETE FROM ik_door_chunks WHERE upload_id=?', uploadId), sql('DELETE FROM ik_door_uploads WHERE id=? AND installation_id=?', uploadId, doorKey)]);
  await cleanupImportObjects(c);await c.hint();
  return {withdrawn: true};
}
