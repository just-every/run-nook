import {canonicalJson,sha256} from './kit.ts';
import {originalStorage} from '../base/modules/import-kit/src/d1/original-storage.ts';
import {importDigest} from '../family/team-chat/import-capture.mjs';
import {assertCampfireEffect,campfireCaptureJobId} from './campfire-effects.mjs';
import {campfireCheck as check} from './campfire-capture.mjs';
const equal=(a,b)=>canonicalJson(a)===canonicalJson(b),ordered=rows=>[...rows].sort((a,b)=>canonicalJson(a).localeCompare(canonicalJson(b)));
/** An erased source cannot be reconstructed from withdrawn private originals.
 * Validate Base's explicit erasure fingerprints, source/target fences, complete
 * original withdrawal and every surviving immutable effect instead. */
export async function validateCampfireErased(read,review,job,plan){
 const summary=JSON.parse(review.summary_json),choices=JSON.parse(review.review_json),erasure=plan.erasure;
 check(erasure.reviewedFingerprint===review.fingerprint&&erasure.originalPolicy==='withdraw-all-job-artifacts'&&summary.sourceType==='campfire','erased review binding');
 check(review.domain_job===campfireCaptureJobId({namespace:review.namespace,digest:summary.captureDigest},review.upload)&&review.id===importDigest([review.owner,review.upload,summary.captureDigest,JSON.parse(review.authority_json)]),'erased operation binding');
 check(summary.reviewDigest===importDigest(choices)&&choices.namespace===review.namespace&&equal(JSON.parse(review.channels_json),summary.channels.map(c=>({sourceId:c.sourceId,members:c.members}))),'erased audience binding');
 check(plan.source.records.length===plan.entries.length&&plan.source.artifacts.every(a=>a.original?.status==='unavailable'&&a.original.reason==='unavailable-after-erasure'&&!a.original.base64),'original withdrawal');
 const originals=originalStorage(plan,job.id,3),versions=(await read('ik_original_sets')).filter(r=>r.job_id===job.id);
 check(versions.length===1&&versions[0].version===3&&equal(ordered(originals.rows),ordered((await read('ik_originals')).filter(r=>r.job_id===job.id)))&&equal(ordered(originals.chunks),ordered((await read('ik_d1_original_chunks')).filter(r=>r.job_id===job.id))),'erased custody');
 const sources=await read('ik_d1_erased_sources'),targets=await read('ik_d1_erased_targets'),effects=new Map();
 for(const [ordinal,entry]of plan.entries.entries()){
  check(equal(entry.source,plan.source.records[ordinal])&&entry.source.payloadHash===sha256(canonicalJson(entry.source.payload)),'erased source integrity');
  if(entry.erased){check(entry.effects.length===0&&equal(entry.source.payload,{erased:true})&&entry.source.sourceId==='erased:'+entry.identity&&sources.some(s=>s.destination===job.destination&&s.identity===entry.identity)&&targets.some(t=>t.destination===job.destination&&t.identity===entry.erasedTargetIdentity),'erased source/target fences');continue;}
  check(!entry.rejection&&entry.effects.length===1,'surviving effects');const effect=entry.effects[0];assertCampfireEffect(effect.targetKind,effect.value);
  check(effect.value.job===review.domain_job&&equal(effect.value,entry.source.payload),'surviving provenance');
  if(effect.targetKind==='channel'){const expected=summary.channels.find(c=>c.sourceId===effect.value.sourceId);check(expected&&equal(effect.value.members,expected.members)&&effect.value.kind===expected.kind&&effect.value.owner===expected.owner,'surviving audience');}
  if(effect.targetKind==='actor')check(effect.value.association===choices.actors[effect.value.sourceId],'surviving identity');
  const key=effect.targetKind+':'+effect.targetId;check(!effects.has(key),'duplicate surviving target');effects.set(key,effect.value);
 }
 return {plan,summary,effects};
}
