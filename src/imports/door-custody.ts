import {readFilePolicy,enforceFilePolicy,filePolicyVersion} from '../files/policy.server'
import type { DoorBindings } from './door-access';
import { fencedBatch } from './door-access';
import { doorKey, decodeDoorPacket, sourceName, type DoorCapture } from './door-source';
import { canonicalJson, sha256, type D1Sql } from './kit';
import { sql } from '../base/modules/import-kit/src/door/store';
import { publicLocalSummary } from './browser-runtime/public';
import { fail } from '../family/team-chat/domain';
import { recordAttestation } from './attestation.mjs';
import { publishAttestation } from './attestation-custody';
import { publishCutover } from './cutover-custody';

export const previewLifetime = 30 * 60 * 1000;
export async function uploadedCapture(env: DoorBindings, namespace: string, uploadId: string, owner: string, users: any[]) {
  const row = await env.DB.prepare('SELECT * FROM ik_door_uploads WHERE id=? AND installation_id=? AND namespace=?').bind(uploadId, doorKey, namespace).first<any>();
  if (!row) fail(404, 'Source upload unavailable');
  const chunks = (await env.DB.prepare('SELECT * FROM ik_door_chunks WHERE upload_id=? ORDER BY ordinal').bind(uploadId).all<any>()).results;
  const bytes = Buffer.concat(chunks.map((c, i) => {
    const bytes = Buffer.from(c.base64, 'base64');
    if (c.ordinal !== i || bytes.length !== c.size || sha256(bytes) !== c.sha256) fail(409, 'Source upload changed');
    return bytes;
  }));
  if (chunks.length !== row.total_chunks || bytes.length !== row.total_bytes || sha256(bytes) !== row.bundle_sha256) fail(409, 'Source upload is incomplete or changed');
  const listed = sourceName(namespace)!;
  return decodeDoorPacket(JSON.parse(bytes.toString('utf8')), listed.kind, listed.workspace, owner, users);
}
export async function refuseLegacyDuplicate(env: DoorBindings, value: DoorCapture) {
  const old = await env.DB.prepare(`SELECT 1 FROM nook_import_reviews r JOIN nook_imports j ON j.id=r.domain_job WHERE j.state='complete' AND json_extract(r.summary_json,'$.archiveDigest')=?
    UNION ALL SELECT 1 FROM nook_import_records WHERE key IN (SELECT value FROM json_each(?)) AND job<>? LIMIT 1`).bind(value.capture.archiveDigest, JSON.stringify(value.effects.filter(e => e.kind === 'message').map(e => (e.payload as any).key)), value.domainJob).first();
  if (old) fail(409, 'already imported');
}
export async function bindPlan(env: DoorBindings, predicate: D1Sql, value: DoorCapture, result: any, uploadId: string, owner: string, range?: {from: string; to: string}, cutover?: unknown) {
  const now = Date.now();
  const summary: any = publicLocalSummary(value.capture);
  if (cutover) summary.cutover = cutover;
  if (range) {
    const person = await env.DB.prepare('SELECT display_name AS name FROM oa_operators WHERE id=?').bind(owner).first<{name: string}>();
    if (!person) fail(409, 'Workspace owner changed; review the import again');
    summary.attestation = recordAttestation(range, {id: owner, name: person!.name}, now);
  }
  await fencedBatch(env, predicate, [sql(`INSERT OR IGNORE INTO nook_door_imports(plan_id,domain_job,owner,source_type,namespace,capture_digest,archive_digest,created,expires_at,authority_json,summary_json,upload_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`, result.planId, value.domainJob, owner, value.packet.sourceType, value.packet.namespace, value.capture.digest, value.capture.archiveDigest, now, now + previewLifetime, canonicalJson(value.authority), JSON.stringify(summary), uploadId)]);
  const binding = await env.DB.prepare('SELECT expires_at,summary_json FROM nook_door_imports WHERE plan_id=?').bind(result.planId).first<{expires_at: number; summary_json: string}>();
  const saved = JSON.parse(binding!.summary_json).attestation;
  if (!!saved !== !!range || range && (saved.from !== range.from || saved.to !== range.to)) fail(409, 'The attested date range changed; create a new reviewed import');
  return {...result, expiresAt: new Date(binding!.expires_at).toISOString()};
}
export function reviewedAudience(link: any): D1Sql {
  return sql(`NOT EXISTS(SELECT 1 FROM json_each(?) a WHERE NOT EXISTS(SELECT 1 FROM oa_operators o JOIN nook_access x ON x.user=o.id WHERE o.id=json_extract(a.value,'$.id') AND o.version=json_extract(a.value,'$.version') AND o.status='active' AND x.active=1 AND x.mode=json_extract(a.value,'$.mode') AND x.generation=json_extract(a.value,'$.generation')))`, link.authority_json);
}
export async function currentLink(env: DoorBindings, namespace: string, planId: string) {
  const link = await env.DB.prepare(`SELECT n.*,COALESCE(p.job_id,j.id) AS job_id,p.fingerprint,p.bundle_sha256,j.state AS job_state FROM nook_door_imports n JOIN ik_door_plans p ON p.id=n.plan_id LEFT JOIN ik_jobs j ON j.id=p.job_id OR (p.job_id IS NULL AND j.operation_key='door:'||p.id AND j.destination=n.owner AND j.principal_id=n.owner) WHERE n.plan_id=? AND p.installation_id=? AND p.namespace=?`).bind(planId, doorKey, namespace).first<any>();
  if (!link) fail(404, 'Reviewed dry run unavailable');
  return link;
}
export async function withdrawUnplanned(env: DoorBindings, predicate: D1Sql, namespace: string, uploadId: string) {
  const eligible = 'SELECT id FROM ik_door_uploads WHERE id=? AND installation_id=? AND namespace=? AND NOT EXISTS(SELECT 1 FROM nook_door_imports n WHERE n.upload_id=ik_door_uploads.id) AND NOT EXISTS(SELECT 1 FROM ik_door_plans p WHERE p.installation_id=ik_door_uploads.installation_id AND p.namespace=ik_door_uploads.namespace AND p.bundle_sha256=ik_door_uploads.bundle_sha256)';
  await fencedBatch(env, predicate, [sql('DELETE FROM ik_door_chunks WHERE upload_id IN (' + eligible + ')', uploadId, doorKey, namespace), sql('DELETE FROM ik_door_uploads WHERE id IN (' + eligible + ')', uploadId, doorKey, namespace)]);
}
export async function guardApply(env: DoorBindings, predicate: D1Sql, link: any) {
  if (!link.job_id && (Date.now() > link.expires_at || link.created > Date.now())) fail(409, 'Dry run expired; create a new dry run');
  const audience = reviewedAudience(link);
  if (!await env.DB.prepare(`SELECT 1 WHERE (${predicate.sql}) AND (${audience.sql})`).bind(...predicate.params ?? [], ...audience.params ?? []).first()) fail(409, 'Reviewed source or audience changed; create a new dry run');
  return sql(`(${predicate.sql}) AND (${audience.sql}) AND EXISTS(SELECT 1 FROM nook_door_imports n LEFT JOIN ik_door_plans p ON p.id=n.plan_id WHERE n.plan_id=? AND (p.job_id IS NOT NULL OR n.created<=CAST(unixepoch('subsec')*1000 AS INTEGER) AND n.expires_at>=CAST(unixepoch('subsec')*1000 AS INTEGER)))`, ...predicate.params ?? [], ...audience.params ?? [], link.plan_id);
}
/** Attachment writes use the same durable late-writer claims as native files.
 * No target is published while source bytes are being prepared. */
export async function prepareFiles(env: DoorBindings, predicate: D1Sql, value: DoorCapture, owner: string, partialAuthority?: () => Promise<D1Sql>) {
  const files = value.effects.filter(e => e.kind === 'message').flatMap(e => {
    const message = e.payload as any;
    return message.files.map((f: any) => ({...f, bytes: value.capture.messages.find((m: any) => m.key === message.key).files.find((x: any) => x.sourceId === f.sourceId).bytes}));
  });
  if (!files.length) return {staged: 0, total: 0};
  const policy=await readFilePolicy(env.DB);for(const file of files)enforceFilePolicy(policy,file.name,file.size);
  predicate=sql(`(${predicate.sql}) AND ${filePolicyVersion}=?`,...predicate.params??[],policy.version);
  const rows = (await env.DB.prepare('SELECT * FROM nook_import_objects WHERE object_key IN (SELECT value FROM json_each(?))').bind(JSON.stringify(files.map(f => f.objectKey))).all<any>()).results;
  if (rows.some(row => ['deleting','deleted'].includes(row.state))) fail(409, 'Imported file was removed');
  const pending = files.filter(f => !rows.some(r => r.object_key === f.objectKey && r.state === 'ready'));
  // A private file-only response still consumes a Business grant exactly once.
  if (pending.length > 100 && partialAuthority) {
    const grant = await partialAuthority();
    predicate = sql(`(${predicate.sql}) AND (${grant.sql})`, ...predicate.params ?? [], ...grant.params ?? []);
  }
  const chunk = pending.slice(0, 100), attempts = chunk.map(f => ({id: crypto.randomUUID(), key: f.objectKey}));
  if (chunk.length) {
    await fencedBatch(env, predicate, [
      sql("INSERT INTO nook_upload_attempts SELECT json_extract(value,'$.id'),json_extract(value,'$.key'),? FROM json_each(?)", Date.now(), JSON.stringify(attempts)),
      sql("INSERT OR IGNORE INTO nook_import_objects SELECT json_extract(value,'$.objectKey'),?,?,json_extract(value,'$.sha256'),json_extract(value,'$.size'),json_extract(value,'$.mime'),'reserved' FROM json_each(?)", value.stable, owner, JSON.stringify(chunk.map(({bytes, ...file}) => file))),
    ]);
    for (const file of chunk) {
      const old = await env.FILES.head(file.objectKey);
      if (old && (old.size !== file.size || old.customMetadata?.sha256 !== file.sha256)) fail(409, 'Original file changed');
      if (!old) await env.FILES.put(file.objectKey, file.bytes, {customMetadata: {sha256: file.sha256}, httpMetadata: {contentType: file.mime}});
    }
    await fencedBatch(env, predicate, [sql("UPDATE nook_import_objects SET state='ready' WHERE owner=? AND state='reserved' AND object_key IN (SELECT value FROM json_each(?))", owner, JSON.stringify(chunk.map(f => f.objectKey))), sql('DELETE FROM nook_upload_attempts WHERE id IN (SELECT value FROM json_each(?))', JSON.stringify(attempts.map(a => a.id)))]);
  }
  return {staged: files.length - pending.length + chunk.length, total: files.length};
}
export async function prepareEnvelope(env: DoorBindings, predicate: D1Sql, link: any) {
  await fencedBatch(env, predicate, [sql("INSERT OR IGNORE INTO nook_imports(id,owner,intent,plan_digest,capture_digest,created,namespace,preview_digest,state) VALUES(?,?,?,?,?,?,?,?,'staging')", link.domain_job, link.owner, link.plan_id, link.fingerprint, link.capture_digest, new Date(link.created).toISOString(), link.namespace, link.capture_digest)]);
}
/** Current attachments and retained before-images both own their file bytes. */
export function queueOrphanedDoorFiles(link: any): D1Sql {
  return sql(`WITH held(object_key) AS MATERIALIZED (SELECT json_extract(f.value,'$.objectKey') FROM (SELECT record_json FROM ik_provenance WHERE reversed=0 UNION ALL SELECT record_json FROM ik_d1_history WHERE reversed=0) p,json_each(p.record_json,'$.before.value.files') f)
    INSERT OR IGNORE INTO nook_object_deletes(object_key,created)
    SELECT o.object_key,? FROM nook_import_objects o WHERE o.owner=? AND o.upload=? AND o.state NOT IN ('deleting','deleted')
    AND NOT EXISTS(SELECT 1 FROM nook_attachments a WHERE a.object_key=o.object_key)
    AND o.object_key NOT IN (SELECT object_key FROM held WHERE object_key IS NOT NULL)`,
    Date.now(),link.owner,'door-'+sha256(canonicalJson([link.source_type,link.namespace])).slice(0,40));
}
export async function publishResult(env: DoorBindings, predicate: D1Sql, link: any, result: any) {
  if (result.job?.state === 'completed') await fencedBatch(env, predicate, [sql("UPDATE nook_imports SET state='complete' WHERE id=? AND owner=?", link.domain_job, link.owner)]);
  if(result.job?.state==='completed'&&JSON.parse(link.summary_json).delta){
    const changed=`SELECT DISTINCT r.conversation FROM ik_provenance p JOIN nook_import_records r ON r.id=p.target_id WHERE p.job_id=? AND p.target_kind='message' AND p.reversed=0`;
    const pending="EXISTS(SELECT 1 FROM nook_door_imports WHERE plan_id=? AND COALESCE(json_extract(summary_json,'$.delta.published'),0)=0)";
    await fencedBatch(env,predicate,[
      sql(`UPDATE nook_conversations SET seq=seq+1 WHERE id IN (${changed}) AND ${pending}`,result.job.id,link.plan_id),
      sql(`INSERT INTO nook_events SELECT id,seq,'import-history',?,? FROM nook_conversations WHERE id IN (${changed}) AND ${pending}`,link.plan_id,link.owner,result.job.id,link.plan_id),
      sql("UPDATE nook_door_imports SET summary_json=json_set(summary_json,'$.delta.published',1) WHERE plan_id=?",link.plan_id),
    ]);
  }
  if (result.state === 'cancelled' || ['undone','rolled_back'].includes(result.job?.state)) await fencedBatch(env, predicate, [sql('DELETE FROM nook_imports WHERE id=? AND NOT EXISTS(SELECT 1 FROM nook_import_channels WHERE job=?) AND NOT EXISTS(SELECT 1 FROM nook_import_records WHERE job=?)', link.domain_job, link.domain_job, link.domain_job),queueOrphanedDoorFiles(link)]);
  if(['undone','rolled_back'].includes(result.job?.state)&&JSON.parse(link.summary_json).delta){
    const affected="SELECT ch.conversation FROM nook_import_channels ch JOIN json_each(?,'$.channels') source ON json_extract(source.value,'$.sourceId')=ch.source_id WHERE ch.job=?";
    const pending="EXISTS(SELECT 1 FROM nook_door_imports WHERE plan_id=? AND COALESCE(json_extract(summary_json,'$.delta.undonePublished'),0)=0)";
    await fencedBatch(env,predicate,[
      sql(`UPDATE nook_conversations SET seq=seq+1 WHERE id IN (${affected}) AND ${pending}`,link.summary_json,link.domain_job,link.plan_id),
      sql(`INSERT INTO nook_events SELECT id,seq,'import-history',?,? FROM nook_conversations WHERE id IN (${affected}) AND ${pending}`,link.plan_id,link.owner,link.summary_json,link.domain_job,link.plan_id),
      sql("UPDATE nook_door_imports SET summary_json=json_set(summary_json,'$.delta.undonePublished',1) WHERE plan_id=?",link.plan_id),
    ]);
  }
  await publishAttestation(env, predicate, link, result);
  await publishCutover(env, predicate, link, result);
}
