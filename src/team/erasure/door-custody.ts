import {doorCustodyInScope} from '../../base/modules/import-kit/src/d1/retirement-door'
import {tallyStores} from '../../base/modules/import-kit/src/d1/retirement-tally'
import type {Context} from '../../platform/storage/context'
import {authority,authFence} from '../../platform/storage/context'
import {retireD1ImportCustody,sha256,type D1ImportContext} from '../../imports/kit'
import {importTargets} from '../../imports/target'
import {authorizeWork} from './authorization'
import {sql} from './statements'
import type {fenceService,Sql} from './portability'

/** Base withdraws opaque bytes for this destination, including uploads which
 * never acquired a plan. Product approval metadata travels in the same batch;
 * body-free plan/job identities remain so unaffected native history can undo. */
export function doorMetadataRetirement(destination:string):Sql[]{
 return [
  // Base retains body-free approvals, nonce replay protection, scopes and
  // failure facts. They describe the importing owner, never the erased source
  // person; preserving them keeps both authority and history correctly bound.
  // Keep only the reviewed roster's opaque IDs: target snapshots need them to
  // distinguish account erasure from a later native audience edit on undo.
  sql(`UPDATE nook_door_imports SET authority_json='{}',summary_json=json_object('sourceType',source_type,'captureDigest',capture_digest,'archiveDigest',archive_digest,'omissions',json('[]'),'omissionDigest',?,'channels',json((SELECT json_group_array(json_object('sourceId',json_extract(value,'$.sourceId'),'members',json(coalesce(json_extract(value,'$.members'),'[]')),'guestMembers',json(coalesce(json_extract(value,'$.guestMembers'),'[]')))) FROM json_each(nook_door_imports.summary_json,'$.channels'))),'erased',json('true')) WHERE owner=?`, sha256('[]'),destination),
 ]
}

/** A member can occur only in an unapplied or unplanned bundle. Native actor
 * traversal cannot discover those bundles; retire their indivisible custody
 * before deleting the account, under the ordinary erasure authority/fence. */
export async function retireDoorIdentity(c:Context,work:any,f:Awaited<ReturnType<typeof fenceService>>){
 const destinations=await c.rows("SELECT DISTINCT destination FROM ik_door_scopes UNION SELECT DISTINCT owner AS destination FROM nook_door_imports UNION SELECT id AS destination FROM oa_operators WHERE role='owner'")
 if(!destinations.length)return
 const person=await c.one('SELECT email FROM oa_operators WHERE id=?',[work.target]);if(!person?.email)return
 const scope=await authorizeWork(c,work),stores=await tallyStores(c.db)
 for(const {destination} of destinations){
  const held=await doorCustodyInScope(c.db,destination,stores)
  if(!held)continue
  const ctx:D1ImportContext={destination,namespace:'nook-door-erasure',mappingVersion:'nook-door-erasure-v1',originalErasurePolicy:'withdraw-all-job-artifacts',storage:{database:c.db,targets:importTargets()},authorization:{principalId:c.uid,predicate:()=>({sql:`${authority} AND ${authFence} AND (${scope.condition})`,params:[...c.credentials,...scope.params]})}}
  await retireD1ImportCustody({values:[person.email]},[...await f.invalidate(),...doorMetadataRetirement(destination)],ctx,await f.checkpoint())
 }
}

/** Private previews have no native rows yet; withdraw their source custody
 * through the same Base erasure door before the author/account can disappear. */
export async function cancelDoorPreview(c:Context,work:any,review:any,f:Awaited<ReturnType<typeof fenceService>>,blobs:Sql[]){
 const scope=await authorizeWork(c,work)
 const ctx:D1ImportContext={destination:review.owner,namespace:review.namespace,mappingVersion:'nook-'+review.source_type+'-door-v1',originalErasurePolicy:'withdraw-all-job-artifacts',storage:{database:c.db,targets:importTargets()},authorization:{principalId:c.uid,predicate:()=>({sql:`${authority} AND ${authFence} AND (${scope.condition})`,params:[...c.credentials,...scope.params]})}}
 const statements=[...await f.invalidate(),...blobs,...doorMetadataRetirement(review.owner)]
 if(work.kind==='imported-author')statements.push(sql("UPDATE nook_erasure_work SET phase='blobs' WHERE operation=?",work.operation))
 await retireD1ImportCustody({target:{kind:'actor',id:work.target}},statements,ctx,await f.checkpoint())
}
