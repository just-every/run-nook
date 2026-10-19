import {selectedDraftFiles} from './draft-files'
import {loadSnapshot} from '../../base/modules/import-kit/src/door/store'
import type {Context} from '../../platform/storage/context'
import {decodeSlackPlan} from '../../imports/archive-plan.mjs'
import {sql} from './statements'
import type {Sql} from './portability'

/** Reviews are custody even before the first native actor exists. A lost create
 * acknowledgement is resolved by the immutable owner/operation binding. */
export async function importSelection(c:Context,work:any){
 const selected=work.kind==='imported-message'?await c.one('SELECT * FROM nook_import_records WHERE id=?',[work.target]):null
 const native=work.kind==='imported-author'?await c.one("SELECT * FROM nook_import_actors WHERE job||':'||source_id=?",[work.target]):work.kind==='member'?await c.one('SELECT * FROM nook_import_actors WHERE association=? LIMIT 1',[work.target]):null
 const reviews=await c.rows("SELECT r.*,k.id AS actual_job,k.plan_json,k.fingerprint AS current_fingerprint,k.total,k.mapping_version,k.destination,k.principal_id,k.operation_key FROM nook_import_reviews r LEFT JOIN ik_jobs k ON k.operation_key=r.id AND k.principal_id=r.owner AND k.destination=r.owner WHERE r.state<>'discarded'")
 const doors=await c.rows("SELECT n.*,n.plan_id AS id,p.job_id AS kit_job,p.installation_id,p.namespace AS door_namespace,p.bundle_sha256,p.fingerprint,p.previous_id,p.snapshot_hash,p.complete,k.id AS actual_job,k.plan_json,k.fingerprint AS current_fingerprint,k.total,k.mapping_version,k.destination,k.principal_id,k.operation_key,'door' AS custody FROM nook_door_imports n JOIN ik_door_plans p ON p.id=n.plan_id LEFT JOIN ik_jobs k ON (k.id=p.job_id OR (p.job_id IS NULL AND k.operation_key='door:'||p.id)) AND k.principal_id=n.owner AND k.destination=n.owner")
 reviews.push(...doors)
 const matches:any[]=[]
 for(const review of reviews){
  if(selected&&review.domain_job!==selected.job||native&&review.domain_job!==native.job)continue
  let plan:any
  if(review.actual_job){
   if(review.kit_job&&review.kit_job!==review.actual_job)throw Error('Import custody binding changed')
   plan=decodeSlackPlan({...review,id:review.actual_job,fingerprint:review.current_fingerprint},await c.rows('SELECT * FROM ik_d1_plan_chunks WHERE job_id=? ORDER BY ordinal',[review.actual_job]))
  }
  if(review.custody==='door'&&!review.actual_job){
   if(JSON.parse(review.summary_json).erased)continue
   const snapshot=await loadSnapshot({options:{database:c.db,destination:review.owner,ownerPrincipalId:review.owner}} as any,{...review,namespace:review.door_namespace} as any)
   plan=snapshot.plan
  }
  const choices=review.custody==='door'&&plan?plan.entries.filter((e:any)=>!e.erased&&e.source.kind==='actor').map((e:any)=>e.source.payload):JSON.parse(review.summary_json).actors??[]
  if(review.custody==='door'&&native&&review.domain_job===native.job&&!choices.some((a:any)=>a.sourceId===native.source_id))choices.push({sourceId:native.source_id,association:native.association})
  const candidates=choices.filter((a:any)=>work.kind==='member'?a.association===work.target:work.kind==='imported-author'?review.domain_job+':'+a.sourceId===work.target:a.sourceId===selected?.source_actor)
  const choice=candidates.find((a:any)=>a.sourceId===native?.source_id)??candidates[0]
  if(!choice&&!selected)continue
  if(review.actual_job){
   const actor=plan.entries.find((e:any)=>!e.erased&&e.source.kind==='actor'&&candidates.some((a:any)=>a.sourceId===e.source.payload.sourceId))?.source.payload
   if(!actor&&!selected)continue
   matches.push({selected,actor:actor?{job:review.domain_job,source_id:actor.sourceId,association:actor.association,source_record:JSON.stringify(actor.sourceRecord)}:null,review,plan});continue
  }
  if(choice)matches.push({selected,actor:{job:review.domain_job,source_id:choice.sourceId,association:choice.association,source_record:'{}'},review,plan:plan??null})
 }
 const match=matches.find(m=>m.plan)??matches[0]
 if(match){const drafts=await selectedDraftFiles(c,match.review,match.actor,selected,doors);return {...match,plans:matches.filter(m=>m.review.domain_job===match.review.domain_job&&m.plan).map(m=>m.plan),drafts}}
 return {selected,actor:native,review:null,plan:null,plans:[],drafts:{keys:[] as string[],plans:[] as string[]}}
}

/** Queue exact selected file keys from the retained plan, including files whose
 * message has not crossed the apply checkpoint. No retained body is copied. */
export function selectedImportBlobs(work:any,selection:Awaited<ReturnType<typeof importSelection>>):Sql[]{
 const {plans,actor,selected,drafts}=selection
 const keys=[...drafts.keys,...plans.flatMap((plan:any)=>plan.entries.filter((e:any)=>!e.erased&&e.source.kind==='message'&&(selected?e.source.payload.id===selected.id:e.source.payload.sourceActor===actor?.source_id)).flatMap((e:any)=>e.source.payload.files.map((f:any)=>f.objectKey)))]
 const cancelled=drafts.plans.length?[sql("DELETE FROM nook_imports WHERE state='staging' AND EXISTS(SELECT 1 FROM nook_door_imports n WHERE n.plan_id IN (SELECT value FROM json_each(?)) AND n.domain_job=nook_imports.id AND n.owner=nook_imports.owner AND NOT EXISTS(SELECT 1 FROM ik_jobs k WHERE k.operation_key='door:'||n.plan_id AND k.destination=n.owner)) AND NOT EXISTS(SELECT 1 FROM nook_import_channels ch WHERE ch.job=nook_imports.id) AND NOT EXISTS(SELECT 1 FROM nook_import_records r WHERE r.job=nook_imports.id)",JSON.stringify(drafts.plans))]:[]
 if(!keys.length)return cancelled
 const json=JSON.stringify([...new Set(keys)])
 return [...cancelled,sql('INSERT OR IGNORE INTO nook_erasure_blobs SELECT ?,object_key FROM nook_import_objects WHERE object_key IN (SELECT value FROM json_each(?))',work.operation,json),sql('INSERT OR IGNORE INTO nook_object_deletes(object_key,created) SELECT object_key,? FROM nook_import_objects WHERE object_key IN (SELECT value FROM json_each(?))',Date.now(),json),sql("UPDATE nook_import_objects SET state='deleted' WHERE object_key IN (SELECT value FROM json_each(?))",json)]
}
