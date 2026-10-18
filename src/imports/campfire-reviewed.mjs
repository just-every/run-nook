import {validateCampfireErased} from './campfire-erased.mjs';
import { canonicalJson, sha256 } from './kit.ts';
import { buildImportPlan, planFingerprint } from '../base/modules/import-kit/src/plan/index.ts';
import { originalStorage } from '../base/modules/import-kit/src/d1/original-storage.ts';
import { importDigest } from '../family/team-chat/import-capture.mjs';
import { campfireCheck as check, campfireId, campfireCaptureDigest, campfireSummary, assertCampfireCaptureAdmitted } from './campfire-capture.mjs';
import { CAMPFIRE_MAPPING_VERSION, campfireKitSource, campfireCaptureJobId, assertCampfireEffect } from './campfire-effects.mjs';
const equal=(a,b)=>canonicalJson(a)===canonicalJson(b);
const ordered=items=>[...items].sort((a,b)=>canonicalJson(a).localeCompare(canonicalJson(b)));

/** Offline archive admission and lost-ack recovery share this exact binding. */
export async function validateCampfireReviewed(read,review,job,plan){
  check(job.mapping_version===CAMPFIRE_MAPPING_VERSION&&job.destination===review.owner&&job.principal_id===review.owner&&job.operation_key===review.id&&job.namespace===review.namespace&&(plan.erasure?.reviewedFingerprint??job.fingerprint)===review.fingerprint,'review job binding');
  check(plan.version===1&&plan.fingerprint===job.fingerprint&&planFingerprint(plan)===job.fingerprint&&plan.destination===job.destination&&plan.principalId===job.principal_id&&plan.namespace===job.namespace&&plan.mappingVersion===job.mapping_version&&plan.entries.length===job.total,'immutable plan binding');
  check(Number.isSafeInteger(job.checkpoint)&&job.checkpoint>=0&&job.checkpoint<=job.total&&(job.state!=='completed'||job.checkpoint===job.total),'checkpoint');
  if(plan.erasure)return validateCampfireErased(read,review,job,plan);
  const summary=JSON.parse(review.summary_json),choices=JSON.parse(review.review_json),authority=JSON.parse(review.authority_json);
  check(summary.sourceType==='campfire'&&plan.source.artifacts.length===1,'source declaration');
  const artifact=plan.source.artifacts[0];check(artifact.original?.status==='available','original capture required');
  const bytes=Buffer.from(artifact.original.base64,'base64');
  check(bytes.toString('base64')===artifact.original.base64&&bytes.length===artifact.size&&sha256(bytes)===artifact.sha256,'original capture hash');
  const normalized=JSON.parse(bytes.toString('utf8')),capture=normalized.capture;
  check(canonicalJson(normalized)===bytes.toString('utf8')&&normalized.sourceType==='campfire'&&capture.sourceType==='campfire'&&capture.namespace===review.namespace&&campfireCaptureDigest(capture)===capture.digest&&capture.digest===summary.captureDigest,'canonical capture binding');
  assertCampfireCaptureAdmitted(capture);
  check(equal(campfireSummary(capture),summary)&&capture.omissionDigest===importDigest(capture.omissions),'summary binding');
  check(choices&&Object.keys(choices).sort().join()==='acceptedOmissions,actors,namespace'&&choices.namespace===capture.namespace&&capture.reviewDigest===importDigest(choices)&&Array.isArray(choices.acceptedOmissions)&&choices.acceptedOmissions.length<=1&&choices.acceptedOmissions.every(x=>/^[a-f0-9]{64}$/.test(x))&&(!capture.omissions.length||equal(choices.acceptedOmissions,[capture.omissionDigest])),'explicit review decisions');
  const actors=new Map(capture.actors.map(a=>[a.sourceId,a])),associations=new Set();
  check(actors.size===capture.actors.length&&equal(Object.keys(choices.actors).sort(),[...actors.keys()].sort()),'complete identity mapping');
  const participants=new Set(capture.channels.flatMap(c=>c.sourceRecord.participantIds));
  for(const a of capture.actors){
    check(a.association===choices.actors[a.sourceId]&&(a.association===null||campfireId(a.association))&&(!participants.has(a.sourceId)||a.association!==null),'identity mapping fidelity');
    if(a.association!==null){check(!associations.has(a.association),'injective identity mapping');associations.add(a.association);}
  }
  check(capture.channels.length>0&&capture.channels.length<=50&&new Set(capture.channels.map(c=>c.sourceId)).size===capture.channels.length,'complete rooms');
  for(const c of capture.channels){
    const source=c.sourceRecord,members=source.participantIds.map(id=>actors.get(id)?.association).sort();
    check(members.every(campfireId)&&equal(members,c.members)&&c.owner===actors.get(source.creator_id)?.association&&c.members.includes(c.owner)&&equal(c.guestMembers,[]),'exact mapped audience');
  }
  const used=[...new Set([review.owner,...capture.channels.flatMap(c=>c.members),...capture.actors.map(a=>a.association).filter(Boolean)])].sort();
  check(Array.isArray(authority)&&equal(authority.map(a=>a.id),used)&&authority.every(a=>a.mode==='member'&&Number.isSafeInteger(a.version)&&a.version>0&&Number.isSafeInteger(a.generation)&&a.generation>0),'review authority');
  check(review.id===importDigest([review.owner,review.upload,capture.digest,authority])&&review.domain_job===campfireCaptureJobId(capture,review.upload),'review operation binding');
  check(equal(JSON.parse(review.channels_json),capture.channels.map(c=>({sourceId:c.sourceId,members:c.members}))),'review audience binding');
  const {source,mapping}=campfireKitSource(capture,review.owner,review.upload,review.id);
  check(equal(source,plan.source)&&equal(normalized.effects,source.records.map(r=>({kind:r.kind,key:r.sourceId,value:r.payload}))),'reconstructed original mapping');
  const rebuilt=buildImportPlan(source,mapping,{destination:job.destination,namespace:job.namespace,mappingVersion:job.mapping_version,authorization:{principalId:job.principal_id}});
  check(equal(rebuilt,plan),'canonical reviewed plan');
  const versions=(await read('ik_original_sets')).filter(r=>r.job_id===job.id),original=originalStorage(plan,job.id,3);
  check(versions.length===1&&versions[0].version===3,'original storage version');
  check(equal(ordered(original.rows),ordered((await read('ik_originals')).filter(r=>r.job_id===job.id)))&&equal(ordered(original.chunks),ordered((await read('ik_d1_original_chunks')).filter(r=>r.job_id===job.id))),'original rows and chunks');
  const counts={channels:capture.channels.length,actors:capture.actors.length,messages:capture.messages.length,threads:capture.messages.filter(m=>m.threadRoot).length,files:capture.messages.reduce((n,m)=>n+m.files.length,0),bytes:capture.messages.reduce((n,m)=>n+m.files.reduce((sum,f)=>sum+f.size,0),0),omissions:capture.omissions.length};
  check(equal(counts,capture.counts)&&new Set(capture.messages.map(m=>m.key)).size===capture.messages.length,'exact source counts');
  const effects=new Map();
  for(const entry of plan.entries){check(!entry.rejection&&!entry.erased&&entry.effects.length===1,'complete effects');const effect=entry.effects[0];assertCampfireEffect(effect.targetKind,effect.value);check(effect.value.job===review.domain_job&&equal(effect.value,entry.source.payload),'effect provenance');const key=effect.targetKind+':'+effect.targetId;check(!effects.has(key),'duplicate effect');effects.set(key,effect.value);}
  return {plan,summary,effects};
}
