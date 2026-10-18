import {retireD1ImportCustody,type D1RelatedErasure,type D1ImportContext} from '../../imports/kit'
import {importTargets} from '../../imports/target'
import {redactInSteps} from './redaction-steps'
import {mappingVersion} from '../../imports/formats.mjs'
import {importDigest} from '../../family/team-chat/import-capture.mjs'
import {authority,authFence,type Context} from '../../platform/storage/context'
import {authorizeWork} from './authorization'
import type {fenceService,Sql} from './portability'
/** A person's exact identifiers: their account email and the email their
 * imported Slack profile carried. Names are never identifiers. */
export async function personValues(c:Context,work:any,actor:any){
 const values=new Set<string>()
 if(work.kind==='member'){const row=await c.one('SELECT email FROM oa_operators WHERE id=?',[work.target]);if(row?.email)values.add(row.email)}
 const record=actor?JSON.parse(actor.source_record):null
 for(const email of [record?.profile?.email,record?.email_address])if(typeof email==='string'&&email)values.add(email)
 return [...values]
}
/** Nook review/custody bindings, never an ID prefix, select the import protocol.
 * The kit also proves no import header still equals one of `values`. */
export async function eraseImportedTarget(c:Context,work:any,kind:'actor'|'message',target:string,job:any,statements:Sql[],values:string[],f:Awaited<ReturnType<typeof fenceService>>,related?:D1RelatedErasure){
 const scope=await authorizeWork(c,work)
 const review=await c.one('SELECT r.kit_job,r.summary_json,k.destination,k.namespace,k.mapping_version FROM nook_import_reviews r JOIN ik_jobs k ON k.operation_key=r.id AND k.principal_id=r.owner AND k.destination=r.owner WHERE r.domain_job=?',[job.id])
 if(review){
  if(review.destination!==job.owner||review.namespace!==job.namespace||review.mapping_version!==mappingVersion(review))throw Error('Import custody binding changed')
  // Native rows, the portability fence, the redaction checkpoint and import custody
  // commit in one batch (with a reaction redaction, in its final step).
  const ctx:D1ImportContext={destination:job.owner,namespace:job.namespace,mappingVersion:review.mapping_version,originalErasurePolicy:'withdraw-all-job-artifacts',storage:{database:c.db,targets:importTargets()},authorization:{principalId:c.uid,predicate:()=>({sql:`${authority} AND ${authFence} AND (${scope.condition})`,params:[...c.credentials,...scope.params]})}}
  if(!related?.fields){await retireD1ImportCustody({target:{kind,id:target},values,related},statements,ctx,await f.checkpoint());return}
  await redactInSteps(c,work,scope,{kind,id:target},values,related,statements,job.owner,ctx,f)
  return
 }
 // The original capture importer predates import-kit. Its immutable digest is
 // the authoritative format discriminator, and absence is guarded at commit.
 if(job.plan_digest!==importDigest({policy:'immutable-new-private-v1',owner:job.owner,captureDigest:job.capture_digest}))throw Error('Import custody unavailable')
 const absent=`NOT EXISTS(SELECT 1 FROM nook_import_reviews WHERE domain_job=?) AND NOT EXISTS(SELECT 1 FROM nook_import_effect_revisions WHERE destination=? AND kind=? AND id=?) AND NOT EXISTS(SELECT 1 FROM ik_provenance WHERE destination=? AND target_kind=? AND target_id=?)`
 await c.batch(statements.map(s=>c.sql(s.sql,...s.params)),scope.conversation,`(${scope.condition}) AND ${absent}`,[...scope.params,job.id,job.owner,kind,target,job.owner,kind,target])
}
