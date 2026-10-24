import {readFilePolicy,filePolicyVersion,DEFAULT_FILE_LIMIT} from '../files/policy.server'
import {auditDatabase} from '../audit/database';
import { createImportOperatorHandler } from '../base/modules/import-kit/src/door/operator';
import { admit } from '../base/modules/import-kit/src/door/admission';
import { createImportDoorHandler } from '../base/modules/import-kit/src/door/index';
import { sql } from '../base/modules/import-kit/src/door/store';
import { requestDatabase, limitStatements } from '../base/modules/import-kit/src/d1/budget';
import { metered, available } from './request-budget';
import { cleanupImportObjects } from './object-store';
import { authBindings } from '../platform/operator-auth.server';
import { Fault } from '../family/team-chat/domain';
import { access, people, type DoorBindings } from './door-access';
import { importSource, sourceName, vendors, doorKey } from './door-source';
import { bindPlan, currentLink, guardApply, prepareEnvelope, prepareFiles, publishResult, refuseLegacyDuplicate, uploadedCapture, withdrawUnplanned } from './door-custody';
import { importTargets } from './target';
import { ownerAction } from './door-history';
import { guardUndo } from './door-undo';
import {validateDeltaBaseline} from './delta-state';
import { attestedRange } from './attestation.mjs';
import { validateCutover } from './slack-cutover.mjs';
import type { D1Sql, D1TargetAdapter } from './kit';

const headers = {'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'};
function guardedTargets(predicate: D1Sql): D1TargetAdapter {
  const target = importTargets();
  const guarded = (queries: D1Sql[]) => [sql("INSERT INTO nook_guard(id,ok) SELECT 'door-apply',CASE WHEN (" + predicate.sql + ') THEN 1 ELSE 0 END', ...predicate.params ?? []), ...queries, sql("DELETE FROM nook_guard WHERE id='door-apply'")];
  return {...target, write: row => guarded(target.write(row)), remove: (destination, kind, id) => guarded(target.remove(destination, kind, id))};
}
async function inputBody(request: Request) {
  if (request.method === 'GET') return {};
  if (request.headers.get('Content-Type')?.split(';')[0] !== 'application/json') throw new Fault(415, 'JSON required');
  const body = await request.clone().text();
  if (new TextEncoder().encode(body).length > 400_000) throw new Fault(413, 'Import request too large');
  const value = JSON.parse(body);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Fault(400, 'JSON object required');
  return value;
}
export async function importDoor(request: Request, env: DoorBindings): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  if (!path.startsWith('/api/operator/import/') && !path.startsWith('/api/rer/import/')) return null;
  let auditActor:string|null=null;
  env = {...env,DB:metered(auditDatabase(env.DB,()=>auditActor))};
  let vendor = vendors[request.headers.get('X-Import-Source') as keyof typeof vendors] ?? 'Source';
  let cleanup: (() => Promise<void>) | undefined;
  try {
    const action = path.split('/').at(-1)!;
    const selectedSource=(namespace:string)=>{const source=sourceName(namespace);if(source)vendor=vendors[source.kind];};
    // Upload authority and namespace come from the session/grant and headers.
    // Captures may embed files: authenticate, then refuse restricted captures
    // before inputBody reads any bytes, until metadata-first admission exists.
    const uploadAccess=action==='uploads'?await access(env,request,{},selectedSource):null;
    const filePolicy=uploadAccess?await readFilePolicy(env.DB):null;
    if(filePolicy&&(filePolicy.max_bytes<DEFAULT_FILE_LIMIT||JSON.parse(filePolicy.blocked_json).length))throw new Fault(409,'Workspace file policy: history-import uploads are unavailable while size or extension restrictions are set');
    const input = await inputBody(request), admitted = uploadAccess??await access(env, request, input, selectedSource), listed = sourceName(admitted.namespace);
    if (!listed) throw new Fault(400, 'Unknown import source');
    vendor = vendors[listed.kind];
    auditActor=admitted.c?.uid??null;
    if (admitted.c) {
      const result = await ownerAction(env, admitted.c, action, input, listed.kind);
      if (result !== null) return Response.json(result, {headers});
    }
    const users = await people(env.DB), source = importSource(admitted.namespace, admitted.principal, users)!;
    let predicate = filePolicy?sql(`(${admitted.predicate.sql}) AND ${filePolicyVersion}=?`,...admitted.predicate.params??[],filePolicy.version):admitted.predicate, link: any, capture, attestation, cutover;
    if (action === 'plan') {
      cleanup = () => withdrawUnplanned(env, predicate, admitted.namespace, input.uploadId);
      if (Object.hasOwn(input, 'attestation')) {
        if (!admitted.c || listed.kind !== 'slack') throw new Fault(403, 'Only the workspace owner can attest a Slack ZIP date range');
        try { attestation = attestedRange(input.attestation); } catch (error) { throw new Fault(400, (error as Error).message); }
      }
      if (Object.hasOwn(input, 'cutover')) {
        if (!admitted.c || listed.kind !== 'slack') throw new Fault(403, 'Only the workspace owner can prepare Slack cutover invitations');
        try { validateCutover(input.cutover); } catch (error) { throw new Fault(400, (error as Error).message); }
        cutover = input.cutover;
      }
      capture = await uploadedCapture(env, admitted.namespace, input.uploadId, admitted.principal, users);
      if(capture.capture.delta){if(!admitted.c||input.catchup!==true)throw new Fault(403,'An owner-reviewed delta pass is required');await validateDeltaBaseline(admitted.c,capture.capture);}
      await refuseLegacyDuplicate(env, capture);
    }
    if (['apply','status','reconcile','undo'].includes(action)) {
      link = await currentLink(env, admitted.namespace, input.planId);
      if (action === 'undo' && !link.job_id && admitted.c) return Response.json({state: 'cancelled', ...await ownerAction(env, admitted.c, 'withdraw', {planId: input.planId}, listed.kind)}, {headers});
      if (action === 'undo') predicate = await guardUndo(env,predicate,link);
      if (action === 'apply') {
        if (input.reviewedFingerprint !== link.fingerprint) throw new Fault(409, 'Reviewed fingerprint changed');
        if (admitted.grant && admitted.grant.fingerprint !== link.fingerprint) throw new Fault(409, 'Granted fingerprint changed');
        predicate = await guardApply(env, predicate, link);
        if (!link.job_id) {
          capture = await uploadedCapture(env, admitted.namespace, link.upload_id, admitted.principal, users);
          const files = await prepareFiles(env, predicate, capture, admitted.principal, admitted.claim ? async () => {
            const stage = await admit({database: env.DB as any, targets: guardedTargets(predicate), ownerPrincipalId: admitted.principal, destination: admitted.principal,
              format: 'json', installationId: doorKey, claim: admitted.claim!, source: name => importSource(name, admitted.principal, users)}, request, 'apply');
            return stage.authority;
          } : undefined);
          if (files.staged < files.total) return Response.json({planId: link.plan_id, job: null, files}, {headers});
          await prepareEnvelope(env, predicate, link);
        }
      }
    }
    const database = requestDatabase(env.DB as any);
    limitStatements({storage:{database}} as any,available(env.DB));
    const runtime = {database, targets: guardedTargets(predicate), ownerPrincipalId: admitted.principal, destination: admitted.principal, format: 'json' as const, limits: {maxBytes: 64 * 1024 * 1024, maxRecords: 100_000, maxRecordBytes: 64 * 1024 * 1024}};
    const handler = admitted.claim
      ? createImportDoorHandler({...runtime, installationId: doorKey, claim: admitted.claim, source: name => importSource(name, admitted.principal, users)})
      : createImportOperatorHandler({...runtime, ...source, installationId: doorKey, appOrigin: authBindings(env).AUTH_ORIGIN, ownerEmail: admitted.email, namespace: admitted.namespace, authorize: async () => predicate});
    // Attestation is Nook-owned pass metadata. Base still receives its exact
    // plan schema; every other unknown request field remains a refusal.
    let handledRequest = request;
    if (action === 'plan' && (Object.hasOwn(input, 'attestation') || Object.hasOwn(input, 'cutover'))) {
      const { attestation: _range, cutover: _cutover, ...planInput } = input, planHeaders = new Headers(request.headers);
      planHeaders.delete('content-length');
      handledRequest = new Request(request, { headers: planHeaders, body: JSON.stringify(planInput) });
    }
    const response = await handler(handledRequest);
    if (!response) return null;
    let result = await response.json() as any;
    if (!response.ok) { await cleanup?.(); return Response.json({...result, errorCode: result.error, error: vendor + ': ' + result.error}, {status: /fingerprint/.test(result.error) ? 409 : response.status, headers}); }
    if (action === 'uploads' && result.complete) {
      cleanup = () => withdrawUnplanned(env, predicate, admitted.namespace, result.uploadId);
      await uploadedCapture(env, admitted.namespace, result.uploadId, admitted.principal, users);
    }
    if (action === 'plan') result = await bindPlan(env, predicate, capture!, result, input.uploadId, admitted.principal, attestation, cutover);
    if (link && ['apply','undo'].includes(action)) await publishResult(env, predicate, link, result);
    if (admitted.c && (result.state === 'cancelled' || ['undone','rolled_back'].includes(result.job?.state))) {await cleanupImportObjects(admitted.c);await admitted.c.hint();}
    if (link && ['status','apply'].includes(action)) result.destinations = (await env.DB.prepare('SELECT source_id AS sourceId,conversation AS id FROM nook_import_channels WHERE job=? ORDER BY source_id').bind(link.domain_job).all()).results;
    return Response.json(result, {status: response.status, headers});
  } catch (error) {
    await cleanup?.().catch(() => undefined);
    const status = error instanceof Fault ? error.status : typeof (error as any)?.status === 'number' ? (error as any).status : error instanceof SyntaxError ? 400 : /INVALID|CREDENTIAL|Invalid|Original file|reviewed|source|Source|audience|identity/i.test(String(error)) ? 409 : 500;
    return Response.json({error: vendor + ': ' + (status === 500 ? 'Import unavailable' : error instanceof Error ? error.message : 'Import refused')}, {status, headers});
  }
}
