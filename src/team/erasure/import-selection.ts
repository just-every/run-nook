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
 const matches:any[]=[]
 for(const review of reviews){
  if(selected&&review.domain_job!==selected.job||native&&review.domain_job!==native.job)continue
  const choices=JSON.parse(review.summary_json).actors??[]
  const candidates=choices.filter((a:any)=>work.kind==='member'?a.association===work.target:work.kind==='imported-author'?review.domain_job+':'+a.sourceId===work.target:a.sourceId===selected?.source_actor)
  const choice=candidates.find((a:any)=>a.sourceId===native?.source_id)??candidates[0]
  if(!choice&&!selected)continue
  let plan:any
  if(review.actual_job){
   if(review.kit_job&&review.kit_job!==review.actual_job)throw Error('Import custody binding changed')
   plan=decodeSlackPlan({...review,id:review.actual_job,fingerprint:review.current_fingerprint},await c.rows('SELECT * FROM ik_d1_plan_chunks WHERE job_id=? ORDER BY ordinal',[review.actual_job]))
   const actor=plan.entries.find((e:any)=>!e.erased&&e.source.kind==='actor'&&candidates.some((a:any)=>a.sourceId===e.source.payload.sourceId))?.source.payload
   if(!actor&&!selected)continue
   matches.push({selected,actor:actor?{job:review.domain_job,source_id:actor.sourceId,association:actor.association,source_record:JSON.stringify(actor.sourceRecord)}:null,review,plan});continue
  }
  if(choice)matches.push({selected,actor:{job:review.domain_job,source_id:choice.sourceId,association:choice.association,source_record:'{}'},review,plan:null})
 }
 const match=matches.find(m=>m.plan)??matches[0]
 if(match)return {...match,plans:matches.filter(m=>m.review.domain_job===match.review.domain_job&&m.plan).map(m=>m.plan)}
 return {selected,actor:native,review:null,plan:null,plans:[]}
}

/** Queue exact selected file keys from the retained plan, including files whose
 * message has not crossed the apply checkpoint. No retained body is copied. */
export function selectedImportBlobs(work:any,selection:Awaited<ReturnType<typeof importSelection>>):Sql[]{
 const {plans,actor,selected}=selection
 const keys=plans.flatMap((plan:any)=>plan.entries.filter((e:any)=>!e.erased&&e.source.kind==='message'&&(selected?e.source.payload.id===selected.id:e.source.payload.sourceActor===actor?.source_id)).flatMap((e:any)=>e.source.payload.files.map((f:any)=>f.objectKey)))
 if(!keys.length)return []
 const json=JSON.stringify(keys)
 return [sql('INSERT OR IGNORE INTO nook_erasure_blobs SELECT ?,object_key FROM nook_import_objects WHERE object_key IN (SELECT value FROM json_each(?))',work.operation,json),sql('INSERT OR IGNORE INTO nook_object_deletes(object_key,created) SELECT object_key,? FROM nook_import_objects WHERE object_key IN (SELECT value FROM json_each(?))',Date.now(),json),sql("UPDATE nook_import_objects SET state='deleted' WHERE object_key IN (SELECT value FROM json_each(?))",json)]
}
