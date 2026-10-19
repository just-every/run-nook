import {loadSnapshot} from '../../base/modules/import-kit/src/door/store'
import {canonicalJson} from '../../imports/kit'
import type {Context} from '../../platform/storage/context'

/** Separate drafts of the same source archive can stage the same author's
 * bytes under different namespaces. Follow the immutable archive binding and
 * source identity, never a filename, key prefix or author ID alone. Completed
 * native imports retain their own authorization and erasure boundary. */
export async function selectedDraftFiles(c:Context,review:any,actor:any,selected:any,doors:any[]){
 const keys=new Set<string>(),plans:string[]=[]
 if(review?.custody!=='door')return {keys:[...keys],plans}
 for(const draft of doors){
  if(draft.actual_job||draft.id===review.id||draft.owner!==review.owner||draft.source_type!==review.source_type||draft.archive_digest!==review.archive_digest||JSON.parse(draft.summary_json).erased)continue
  // An earlier bounded erasure step may already have withdrawn this body;
  // its exact file keys were queued before that step started.
  if(!await c.one('SELECT 1 FROM ik_door_plan_chunks WHERE plan_id=? LIMIT 1',[draft.id]))continue
  const snapshot=await loadSnapshot({options:{database:c.db,destination:draft.owner,ownerPrincipalId:draft.owner}} as any,{...draft,namespace:draft.door_namespace} as any)
  const messages=snapshot.plan.entries.filter(entry=>!entry.erased&&entry.source.kind==='message'&&(selected?canonicalJson((entry.source.payload as any).sourceRecord)===canonicalJson(JSON.parse(selected.source_record)):(entry.source.payload as any).sourceActor===actor?.source_id))
  if(!messages.length)continue
  plans.push(draft.id)
  for(const entry of messages)for(const file of (entry.source.payload as any).files)keys.add(file.objectKey)
 }
 return {keys:[...keys],plans}
}
