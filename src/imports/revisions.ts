import type {Context} from '../platform/storage/context'
import {message} from '../platform/storage/read'
import {fail,Fault} from '../family/team-chat/domain'
import {decodeProvenance} from '../base/modules/import-kit/src/storage/provenance'
import {canonicalJson,sha256,type ProvenanceRow} from './kit'
import {publishedImport} from './projection'

export type ImportedRevision={
 body:string;sourceTimestamp:string;edited:boolean;state:'previous'|'current';
 provenance:{id:string|null;source:'Slack'|'Mattermost'|'Campfire'|'Imported';namespace:string};
 pass:{jobId:string;planId:string|null;importedAt:number|null}|null;
}
export type ImportedRevisionHistory={message:string;conversation:string;revisions:ImportedRevision[];current:ImportedRevision}
export type ImportedRevisionRow={
 message_id:string;conversation:string;domain_job:string;owner:string;namespace:string;
 current_body:string;current_timestamp:string;current_source_record:string;
 id:string|null;job_id:string|null;source_identity:string|null;destination:string|null;
 target_kind:string|null;target_id:string|null;reversed:number|null;record_json:string|null;
 successor_id:string|null;storage:'active'|'history'|null;plan_id:string|null;imported_at:number|null;
}
/** Bind message ID and its already-authorized conversation. The current source,
 * provenance, before-images and source-erasure fences share one SQL snapshot.
 * Kept public for the parent's scoped readable-export projection; never expose
 * these raw rows or their before-image file/author/source metadata to clients. */
export const importedRevisionSelect=`WITH current_source AS (
 SELECT r.*,j.owner,j.namespace FROM nook_import_records r JOIN nook_imports j ON j.id=r.job
 WHERE r.id=? AND r.conversation=? AND j.state='complete' AND ${publishedImport}
 AND NOT EXISTS(SELECT 1 FROM nook_erased_import_messages erased WHERE erased.id=r.id)
), receipts AS (
 SELECT p.id,p.job_id,p.ordinal,p.source_identity,p.destination,p.target_kind,p.target_id,p.reversed,p.record_json,NULL AS successor_id,'active' AS storage
 FROM ik_provenance p JOIN current_source s ON p.target_id=s.id AND p.destination=s.owner WHERE p.target_kind='message' AND p.reversed=0
 UNION ALL
 SELECT h.id,h.job_id,h.ordinal,h.source_identity,h.destination,h.target_kind,h.target_id,h.reversed,h.record_json,h.successor_id,'history'
 FROM ik_d1_history h JOIN current_source s ON h.target_id=s.id AND h.destination=s.owner WHERE h.target_kind='message' AND h.reversed=0
), visible AS (
 SELECT p.*,d.plan_id,d.created AS imported_at FROM receipts p JOIN ik_jobs job ON job.id=p.job_id AND job.destination=p.destination
 LEFT JOIN ik_door_plans plan ON plan.job_id=p.job_id
 LEFT JOIN nook_door_imports d ON d.plan_id=plan.id AND d.owner=p.destination AND d.domain_job=(SELECT job FROM current_source)
 WHERE job.state IN ('completed','undoing')
 AND NOT EXISTS(SELECT 1 FROM ik_d1_erased_sources erased WHERE erased.destination=p.destination AND erased.identity=p.source_identity)
 AND NOT EXISTS(SELECT 1 FROM ik_d1_plan_index idx JOIN ik_d1_erased_targets erased ON erased.destination=p.destination AND erased.identity=idx.target_identity WHERE idx.job_id=p.job_id AND idx.ordinal=p.ordinal)
)
SELECT s.id AS message_id,s.conversation,s.job AS domain_job,s.owner,s.namespace,
 s.body AS current_body,s.source_timestamp AS current_timestamp,s.source_record AS current_source_record,
 p.id,p.job_id,p.source_identity,p.destination,p.target_kind,p.target_id,p.reversed,p.record_json,p.successor_id,p.storage,p.plan_id,p.imported_at
FROM current_source s LEFT JOIN visible p ON p.target_id=s.id
WHERE NOT EXISTS(SELECT 1 FROM receipts denied JOIN ik_d1_erased_sources erased ON erased.destination=denied.destination AND erased.identity=denied.source_identity)
AND NOT EXISTS(SELECT 1 FROM receipts denied JOIN ik_d1_plan_index idx ON idx.job_id=denied.job_id AND idx.ordinal=denied.ordinal JOIN ik_d1_erased_targets erased ON erased.destination=denied.destination AND erased.identity=idx.target_identity)`

type Receipt=ProvenanceRow&{predecessorId?:string}
type Value={id:string;job:string;owner:string;conversation:string;body:string;sourceTimestamp:string;sourceRecord:Record<string,unknown>;erased?:boolean}
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)
const unavailable=()=>fail(409,'Imported revision history is unavailable because its retained source binding changed')
const sourceName=(job:string):ImportedRevision['provenance']['source']=>job.startsWith('slack-')?'Slack':job.startsWith('mattermost-')?'Mattermost':job.startsWith('campfire-')?'Campfire':'Imported'
function wasEdited(source:ImportedRevision['provenance']['source'],record:Record<string,unknown>){
 if(source==='Slack')return !!record.edited
 const changed=typeof record.created_at==='string'&&typeof record.updated_at==='string'&&record.created_at!==record.updated_at
 const rich=record.richText
 return changed||object(rich)&&typeof rich.created_at==='string'&&typeof rich.updated_at==='string'&&rich.created_at!==rich.updated_at
}
function revision(value:Value,row:ImportedRevisionRow,receipt:Receipt|null,state:ImportedRevision['state'],scope:ImportedRevisionRow):ImportedRevision{
 if(value.id!==scope.message_id||value.job!==scope.domain_job||value.owner!==scope.owner||value.conversation!==scope.conversation||typeof value.body!=='string'||typeof value.sourceTimestamp!=='string'||!/^\d+\.\d+$/.test(value.sourceTimestamp)||!object(value.sourceRecord)||value.erased||value.sourceRecord.erased)unavailable()
 const source=sourceName(value.job)
 return {body:value.body,sourceTimestamp:value.sourceTimestamp,edited:wasEdited(source,value.sourceRecord),state,
  provenance:{id:receipt?.id??null,source,namespace:scope.namespace},
  pass:receipt?{jobId:receipt.jobId,planId:row.plan_id,importedAt:row.imported_at}:null}
}
/** Pure allowlisted reading projection. Before.value is the previous applied
 * message, NOT the value applied by the receipt holding it. Follow the actual
 * successor/predecessor chain rather than sorting opaque import IDs or dates. */
export function projectImportedRevisions(rows:ImportedRevisionRow[]):ImportedRevisionHistory{
 const scope=rows[0];if(!scope)fail(404,'Message unavailable')
 const decoded=new Map<string,{row:ImportedRevisionRow;receipt:Receipt}>()
 for(const row of rows){
  if(row.message_id!==scope.message_id||row.conversation!==scope.conversation||row.owner!==scope.owner||row.domain_job!==scope.domain_job)unavailable()
  if(row.id===null)continue
  let receipt:Receipt;try{receipt=decodeProvenance(row) as Receipt}catch{unavailable()}
  if(receipt!.destination!==scope.owner||receipt!.targetId!==scope.message_id||receipt!.targetKind!=='message'||receipt!.reversed||decoded.has(row.id))unavailable()
  decoded.set(row.id,{row,receipt:receipt!})
 }
 const active=[...decoded.values()].filter(item=>item.row.storage==='active');if(active.length>1)unavailable()
 const head=active[0]??null
 let source:Record<string,unknown>;try{source=JSON.parse(scope.current_source_record)}catch{unavailable()}
 const current=revision({id:scope.message_id,job:scope.domain_job,owner:scope.owner,conversation:scope.conversation,body:scope.current_body,sourceTimestamp:scope.current_timestamp,sourceRecord:source!},head?.row??scope,head?.receipt??null,'current',scope)
 const previous:ImportedRevision[]=[],seen=new Set<string>();let cursor:{row:ImportedRevisionRow;receipt:Receipt}|null=head
 while(cursor){
  const p:Receipt=cursor.receipt;if(seen.has(p.id))unavailable();seen.add(p.id)
  if(!p.before){if(p.predecessorId)unavailable();break}
  const before=p.before
  if(before.destination!==scope.owner||before.targetKind!=='message'||before.targetId!==scope.message_id||!object(before.value))unavailable()
  const predecessor:{row:ImportedRevisionRow;receipt:Receipt}|undefined=p.predecessorId?decoded.get(p.predecessorId):undefined
  if(p.predecessorId&&(!predecessor||predecessor.row.storage!=='history'||predecessor.row.successor_id!==p.id||before.revision!==predecessor.receipt.appliedRevision||sha256(canonicalJson(before.value))!==predecessor.receipt.valueHash))unavailable()
  previous.push(revision(before.value as unknown as Value,predecessor?.row??cursor.row,predecessor?.receipt??null,'previous',scope))
  cursor=predecessor??null
 }
 return {message:scope.message_id,conversation:scope.conversation,revisions:previous.reverse(),current}
}
/** Parent GET /api/messages/:id/imported-revisions dispatches revisions(c,id).
 * The ordinary message door runs first; current membership is checked again in
 * the same snapshot as history. An unrelated admin gets the missing-source 404. */
export async function revisions(c:Context,messageId:string):Promise<ImportedRevisionHistory>{
 try{
  const current=await message(c,messageId)
  if(!current.immutable||current.deleted||current.retainedSource)fail(404,'Message unavailable')
  return projectImportedRevisions(await c.rows<ImportedRevisionRow>(importedRevisionSelect,[messageId,current.conversation],current.conversation))
 }catch(error){if(error instanceof Fault&&(error.status===403||error.status===404))fail(404,'Message unavailable');throw error}
}
