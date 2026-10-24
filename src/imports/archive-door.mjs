import {validateDoorLineage} from './archive-door-lineage.mjs';
import {validateDoorSource} from './archive-door-source.mjs';
import {canonicalJson,sha256} from './kit.ts';
import {planFingerprint} from '../base/modules/import-kit/src/plan/index.ts';
import {originalStorage} from '../base/modules/import-kit/src/d1/original-storage.ts';
import {sourceIdentity} from '../base/modules/import-kit/src/provenance/identity.ts';
import {effectIdentity} from '../base/modules/import-kit/src/storage/provenance.ts';
import {InventorySnapshot} from '../base/modules/import-kit/src/d1/inventory-snapshot.ts';
import {provenanceSet} from '../base/modules/import-kit/src/d1/provenance-set.ts';
import {assertImportEffect} from './formats.mjs';
const check=(ok,code)=>{if(!ok)throw Error(code)};
const equal=(a,b)=>canonicalJson(a)===canonicalJson(b);
const ordered=rows=>[...rows].sort((a,b)=>canonicalJson(a).localeCompare(canonicalJson(b)));

/** Door snapshots use Base's canonical fingerprint and the actual publishing
 * plan. Base's inventory snapshot validates archived source claims and durable
 * provenance without issuing writes or replanning. */
export async function doorArchivePlans(read,decode,db){
 const names=['nook_door_imports','ik_door_plans','ik_door_plan_chunks','ik_door_uploads','ik_door_chunks','ik_door_namespaces','ik_door_approvals','ik_door_apply_failures','ik_door_scopes','ik_jobs','ik_d1_plan_chunks','ik_provenance','ik_d1_history','ik_sources','ik_d1_entries','ik_batches','ik_d1_reversal_reports','ik_original_sets','ik_originals','ik_d1_original_chunks','ik_d1_erasure_journal','ik_d1_erased_sources','ik_d1_erased_targets'];
 const data=Object.fromEntries(await Promise.all(names.map(async name=>[name,await read(name)])));
 const jobs=new Map(data.ik_jobs.map(j=>[j.id,j])),plans=new Map(data.ik_door_plans.map(p=>[p.id,p])),links=new Map(data.nook_door_imports.map(p=>[p.plan_id,p]));
 check(links.size===data.nook_door_imports.length&&plans.size===data.ik_door_plans.length,'duplicate_door_plan');
 const proofs=new Map(),snapshots=new Map();
 for(const row of plans.values()){
  const binding=links.get(row.id);check(binding,'door_plan_without_product_binding');
  check(['slack','campfire','mattermost','gchat'].includes(binding.source_type)&&binding.domain_job===binding.source_type+'-'+sha256(canonicalJson([binding.source_type,binding.namespace])).slice(0,40)&&(row.namespace===binding.source_type||row.namespace===binding.source_type+':'+binding.namespace),'door_product_binding_changed');
  const summary=JSON.parse(binding.summary_json);
  check(summary.captureDigest===binding.capture_digest&&summary.archiveDigest===binding.archive_digest,'door_capture_binding_changed');
  const chunks=data.ik_door_plan_chunks.filter(c=>c.plan_id===row.id).sort((a,b)=>a.ordinal-b.ordinal);
  const erased=data.ik_d1_erasure_journal.some(j=>j.destination===binding.owner);
  let snapshot=null;
  if(chunks.length){
   check(row.complete===1&&chunks.every((c,i)=>c.ordinal===i),'door_snapshot_chunks_changed');
   const body=chunks.map(c=>c.body).join('');snapshot=JSON.parse(body);
   check(canonicalJson(snapshot)===body&&sha256(body)===row.snapshot_hash&&snapshot.id===row.id&&snapshot.namespace===row.namespace&&snapshot.bundleSha256===row.bundle_sha256&&snapshot.previous===row.previous_id&&snapshot.plan.fingerprint===row.fingerprint&&planFingerprint(snapshot.plan)===row.fingerprint&&snapshot.kitNamespace===snapshot.plan.namespace&&snapshot.plan.destination===binding.owner&&snapshot.plan.principalId===binding.owner,'door_snapshot_changed');
  }else check(erased,'door_snapshot_missing');
  if(snapshot){validateDoorSource(binding,snapshot.plan);snapshots.set(snapshot.id,snapshot);}
  const job=row.job_id?jobs.get(row.job_id):data.ik_jobs.find(j=>j.operation_key==='door:'+row.id&&j.destination===binding.owner);
  if(row.job_id)check(job,'door_job_missing');
  if(!job){check(!row.job_id,'door_job_missing');continue;}
  const plan=decode(job,data.ik_d1_plan_chunks);
  check(job.destination===binding.owner&&job.principal_id===binding.owner&&job.operation_key==='door:'+row.id&&job.mapping_version==='nook-'+binding.source_type+'-door-v1'&&plan.namespace===job.namespace&&plan.destination===job.destination&&plan.principalId===job.principal_id&&plan.mappingVersion===job.mapping_version&&plan.entries.length===job.total&&['completed','undone','rolled_back'].includes(job.state),'door_job_binding_changed');
  check(snapshot?equal(plan,snapshot.plan)||plan.erasure?.reviewedFingerprint===snapshot.plan.fingerprint:erased&&(plan.fingerprint===row.fingerprint||plan.erasure?.reviewedFingerprint===row.fingerprint),'door_job_snapshot_changed');
  validateDoorSource(binding,plan);
  if(plan.erasure)check(plan.erasure.reviewedFingerprint===row.fingerprint,'door_erasure_binding_changed');
  const originals=originalStorage(plan,job.id,3);
  check(equal(ordered(originals.rows),ordered(data.ik_originals.filter(r=>r.job_id===job.id)))&&equal(ordered(originals.chunks),ordered(data.ik_d1_original_chunks.filter(r=>r.job_id===job.id)))&&equal(data.ik_original_sets.filter(r=>r.job_id===job.id),[{job_id:job.id,version:3}]),'door_original_custody_changed');
  const effects=new Map();
  for(const [ordinal,entry] of plan.entries.entries()){
   check(equal(entry.source,plan.source.records[ordinal])&&entry.source.namespace===job.namespace&&(entry.erased||entry.identity===sourceIdentity(job.destination,job.namespace,entry.source.kind,entry.source.sourceId))&&entry.source.payloadHash===sha256(canonicalJson(entry.source.payload)),'door_source_changed');
   if(entry.erased)check(data.ik_d1_erased_sources.some(r=>r.destination===job.destination&&r.identity===entry.identity)&&data.ik_d1_erased_targets.some(r=>r.destination===job.destination&&r.identity===entry.erasedTargetIdentity),'door_erasure_fence_missing');
   for(const effect of entry.effects){assertImportEffect(effect.targetKind,effect.value);check(effect.targetKind===entry.source.kind&&effect.targetId===(entry.source.kind==='actor'?entry.source.sourceId:effect.value.id)&&effect.value.job===binding.domain_job&&equal(effect.value,entry.source.payload),'door_effect_changed');effects.set(effect.targetKind+':'+effect.targetId,effect.value);}
  }
  proofs.set(row.id,{door:true,binding,snapshot,review:{...binding,id:row.id,fingerprint:row.fingerprint},job,plan,summary,effects,revisions:[]});
 }
 check([...links.keys()].every(id=>plans.has(id)),'orphan_door_product_binding');
 validateDoorLineage(snapshots);
 // Both retained predecessor receipts and current receipts are independently
 // attributable to their original publishing plan through Base's validator.
 const claims=new Map(data.ik_sources.map(s=>[s.identity,s]));
 const inventory=new InventorySnapshot();
 for(const [name,rows] of Object.entries(data))inventory.tables.set(name,rows);
 for(const job of data.ik_jobs)inventory.plans.set(job.id,decode(job,data.ik_d1_plan_chunks));
 const doorJobs=new Set([...proofs.values()].map(p=>p.job.id));
 const checkedRows=[...data.ik_provenance,...data.ik_d1_history].filter(p=>doorJobs.has(p.job_id));
 const context={storage:{database:db,targets:{}},destination:'archive',namespace:'archive',mappingVersion:'archive',authorization:{principalId:'archive'}};
 // Offline admission validates the immutable inventory but publishes no batch,
 // so it must not request SQL guards tied to a live custody-state revision.
 const safeCauses=new Set(['IMPORT_CUSTODY_STATE_REQUIRED','IMPORT_INVENTORY_SNAPSHOT_MISSING','PROVENANCE_JOB_MISMATCH','PROVENANCE_JOB_MISSING','PROVENANCE_STORAGE_MISMATCH','PROVENANCE_ATTRIBUTION_MISMATCH','PROVENANCE_BEFORE_IMAGE_MISMATCH','PROVENANCE_SOURCE_CLAIM_MISMATCH','IMPORT_HISTORY_MISMATCH','IMPORT_REVERSAL_INTEGRITY']);
 let validation;try{validation=await provenanceSet(checkedRows,context,undefined,[...doorJobs],[],inventory)}catch(error){const cause=safeCauses.has(error?.message)?error.message:'UNKNOWN';throw new Error('door_provenance_integrity:'+cause,{cause:error})}
 const decoded=new Map(validation.decoded.map(p=>[p.id,p]));
 const all=[...data.ik_provenance,...data.ik_d1_history],byId=new Map(all.map(p=>[p.id,p]));
 check(byId.size===all.length,'duplicate_door_provenance');
 for(const proof of proofs.values()){
  const {job,plan}=proof,receipts=all.filter(p=>p.job_id===job.id),entries=[];
  for(let ordinal=0;ordinal<job.checkpoint;ordinal++){
   const entry=plan.entries[ordinal];entries.push({job_id:job.id,ordinal,source_identity:entry.identity,owner_job_id:job.id,effects_hash:sha256(canonicalJson(entry.effects))});
   for(let index=0;index<entry.effects.length;index++)check(receipts.some(p=>p.id===effectIdentity(job.id,entry.identity,index)),'door_publication_missing');
  }
  check(equal(ordered(entries),ordered(data.ik_d1_entries.filter(r=>r.job_id===job.id))),'door_entry_receipts_changed');
  for(const row of receipts){
   const p=decoded.get(row.id);check(p,'door_provenance_missing');check(p.reversed===['undone','rolled_back'].includes(job.state),'door_provenance_state_changed');
   if(row.successor_id){const successor=byId.get(row.successor_id),next=successor&&JSON.parse(successor.record_json);check(next&&next.predecessorId===row.id&&next.before&&next.before.revision===p.appliedRevision&&sha256(canonicalJson(next.before.value))===p.valueHash&&next.targetId===p.targetId&&next.targetKind===p.targetKind,'door_history_changed');}
   else if(!p.reversed)proof.revisions.push({destination:p.destination,kind:p.targetKind,id:p.targetId,revision:p.appliedRevision});
  }
  for(const claim of data.ik_sources.filter(s=>s.job_id===job.id)){const entry=plan.entries.find(e=>e.identity===claim.identity);check(entry&&plan.entries.indexOf(entry)<job.checkpoint&&job.state==='completed'&&claim.source_hash===entry.source.payloadHash&&claim.mapping_version===job.mapping_version&&claim.effects_hash===sha256(canonicalJson(entry.effects)),'door_source_claim_changed');}
  if(job.state==='completed')for(let ordinal=0;ordinal<job.checkpoint;ordinal++){const entry=plan.entries[ordinal];check(claims.get(entry.identity)?.job_id===job.id,'door_source_claim_missing');}
 }
 for(const row of data.ik_door_plan_chunks)check(plans.has(row.plan_id),'orphan_door_snapshot_chunk');
 for(const row of [...data.ik_door_approvals,...data.ik_door_apply_failures])check(plans.has(row.plan_id),'orphan_door_approval');
 for(const row of data.ik_door_approvals)check(row.fingerprint===plans.get(row.plan_id).fingerprint&&typeof row.owner==='string'&&row.owner.length>0&&Number.isFinite(Date.parse(row.approved_at))&&typeof row.approval_id==='string'&&row.approval_id.length>0&&typeof row.reviewer==='string'&&row.reviewer.length>0,'door_approval_binding_changed');
 for(const row of plans.values())if(row.previous_id){const previous=plans.get(row.previous_id);check(previous&&previous.installation_id===row.installation_id&&previous.namespace===row.namespace&&row.previous_id!==row.id,'door_lineage_changed');}
 for(const start of plans.values()){const seen=new Set();for(let row=start;row;row=plans.get(row.previous_id)){check(!seen.has(row.id),'door_lineage_cycle');seen.add(row.id);}}
 for(const row of data.ik_door_namespaces)for(const id of [row.head_id,row.pending_id])if(id){const p=plans.get(id);check(p&&p.installation_id===row.installation_id&&p.namespace===row.namespace,'door_namespace_changed');}
 const uploads=new Map(data.ik_door_uploads.map(u=>[u.id,u]));
 for(const row of data.ik_door_chunks){const u=uploads.get(row.upload_id),bytes=Buffer.from(row.base64,'base64');check(u&&Number.isSafeInteger(row.ordinal)&&row.ordinal>=0&&row.ordinal<u.total_chunks&&bytes.toString('base64')===row.base64&&bytes.length===row.size&&row.size===Math.min(65536,u.total_bytes-row.ordinal*65536)&&sha256(bytes)===row.sha256,'door_upload_chunk_changed');}
 for(const u of uploads.values()){const chunks=data.ik_door_chunks.filter(c=>c.upload_id===u.id).sort((a,b)=>a.ordinal-b.ordinal);check(Number.isSafeInteger(u.total_bytes)&&u.total_bytes>0&&u.total_chunks===Math.ceil(u.total_bytes/65536)&&/^[a-f0-9]{64}$/.test(u.bundle_sha256)&&chunks.length<=u.total_chunks,'door_upload_changed');if(chunks.length===u.total_chunks)check(chunks.every((c,i)=>c.ordinal===i)&&chunks.reduce((n,c)=>n+c.size,0)===u.total_bytes&&sha256(Buffer.concat(chunks.map(c=>Buffer.from(c.base64,'base64'))))===u.bundle_sha256,'door_upload_changed');}
 return proofs;
}
