import { validateReviewDecisions, actorChoiceMatches } from './review-binding.mjs';
import {captureJobId} from './ids.mjs';
import {importDigest} from '../family/team-chat/import-capture.mjs';
import {canonicalJson,sha256} from './kit.ts';
import {originalStorage} from '../base/modules/import-kit/src/d1/original-storage.ts';
import {assertSlackEffect} from './policy.mjs';
const check=(value,code)=>{if(!value)throw Error(code)};
const ordered=rows=>[...rows].sort((a,b)=>canonicalJson(a).localeCompare(canonicalJson(b)));
/** Validate the kit's explicit, fingerprinted erasure state; ordinary review
 * admission remains unchanged. Surviving effects still require exact provenance. */
export async function validateErasedReviewedPlan(read,review,job,plan){
 check(plan.erasure?.reviewedFingerprint===review.fingerprint&&plan.erasure.originalPolicy==='withdraw-all-job-artifacts','invalid_slack_erasure_review');
 check(plan.entries.length===job.total&&plan.entries.some(e=>e.erased)&&plan.source.records.length===plan.entries.length,'invalid_slack_erasure_entries');
 const originals=originalStorage(plan,job.id,3),same=(a,b)=>canonicalJson(ordered(a))===canonicalJson(ordered(b));
 check(same(originals.rows,(await read('ik_originals')).filter(r=>r.job_id===job.id))&&same(originals.chunks,(await read('ik_d1_original_chunks')).filter(r=>r.job_id===job.id)),'slack_original_custody_changed');
 check(plan.source.artifacts.every(a=>a.original?.status==='unavailable'&&a.original.reason==='unavailable-after-erasure'&&!a.original.base64),'slack_erased_original_retained');
 const summary=JSON.parse(review.summary_json),choices=JSON.parse(review.review_json),equal=(a,b)=>canonicalJson(a)===canonicalJson(b);
 check(plan.destination===job.destination&&plan.principalId===job.principal_id&&plan.namespace===job.namespace&&plan.mappingVersion===job.mapping_version&&review.domain_job===captureJobId({namespace:review.namespace,digest:summary.captureDigest},review.upload),'invalid_slack_plan_binding');
 check(review.id===importDigest([review.owner,review.upload,summary.captureDigest,JSON.parse(review.authority_json)]),'slack_review_binding_changed');
 check(summary.completeness==='unknown'&&summary.sourceAuthenticityVerified===false&&Array.isArray(summary.omissions)&&summary.omissionDigest===importDigest(summary.omissions),'slack_review_summary_changed');
 check(choices.namespace===review.namespace&&Array.isArray(choices.channels)&&Array.isArray(choices.acceptedOmissions)&&choices.acceptedOmissions.length<=1&&(summary.omissions.length===0||equal(choices.acceptedOmissions,[summary.omissionDigest])),'slack_review_choices_changed');
 validateReviewDecisions(summary,choices,plan);
 const versions=(await read('ik_original_sets')).filter(r=>r.job_id===job.id);check(versions.length===1&&versions[0].version===3,'invalid_slack_original_version');
 const sources=await read('ik_d1_erased_sources'),targets=await read('ik_d1_erased_targets'),effects=new Map();
 for(const [ordinal,entry] of plan.entries.entries()){
  check(canonicalJson(entry.source)===canonicalJson(plan.source.records[ordinal])&&entry.source.payloadHash===sha256(canonicalJson(entry.source.payload)),'slack_erasure_source_changed');
  if(entry.erased){check(entry.effects.length===0&&canonicalJson(entry.source.payload)==='{"erased":true}'&&entry.source.sourceId==='erased:'+entry.identity&&sources.some(s=>s.destination===job.destination&&s.identity===entry.identity)&&targets.some(t=>t.destination===job.destination&&t.identity===entry.erasedTargetIdentity),'slack_erasure_fence_missing');continue;}
  check(!entry.rejection&&entry.effects.length===1,'invalid_slack_effect');const effect=entry.effects[0];assertSlackEffect(effect.targetKind,effect.value);
  check(effect.value.job===review.domain_job&&canonicalJson(effect.value)===canonicalJson(entry.source.payload),'invalid_slack_effect');const key=effect.targetKind+':'+effect.targetId;check(!effects.has(key),'duplicate_slack_effect');effects.set(key,effect.value);
 }
 const messages=[...effects].filter(([key])=>key.startsWith('message:')).map(([,v])=>v);
 check(messages.every(m=>!m.missingFiles?.length||choices.importWithoutMissingFiles===true),'slack_review_choices_changed');
 const channels=[...effects].filter(([key])=>key.startsWith('channel:')).map(([,v])=>v),actors=[...effects].filter(([key])=>key.startsWith('actor:')).map(([,v])=>v);
 check(equal(JSON.parse(review.channels_json),channels.map(c=>({sourceId:c.sourceId,members:c.members})))&&equal(choices.channels.map(c=>({...c,members:[...c.members].sort()})),channels.map(c=>({sourceId:c.sourceId,name:c.name,members:c.members}))), 'slack_review_audience_changed');
 check(equal(summary.channels,channels.map(c=>({sourceId:c.sourceId,name:c.name,members:c.members,guestMembers:c.guestMembers})))&&actors.every(a=>(summary.reviewDigest?actorChoiceMatches(a,choices,messages,summary.externalActors):choices.actors?.[a.sourceId]===a.association)&&summary.actors.some(s=>s.sourceId===a.sourceId&&s.association===a.association)),'slack_review_summary_changed');
 return {plan,summary,effects};
}
