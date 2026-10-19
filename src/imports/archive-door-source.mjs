import {canonicalJson,sha256} from './kit.ts';
import {kitSource} from './source.ts';
import {decodeRoleCapture,encodeRoleEffect} from './role-decisions.ts';
const check=(ok,code)=>{if(!ok)throw Error(code)};
const equal=(a,b)=>canonicalJson(a)===canonicalJson(b);

/** Reproduce the source normalizer from the retained packet. Audience liveness
 * belongs to import time; offline archives preserve historical membership. */
export function validateDoorSource(binding,plan){
 if(plan.erasure){
  check(plan.erasure.originalPolicy==='withdraw-all-job-artifacts'&&plan.source.artifacts.every(a=>a.original?.status==='unavailable'&&a.original.reason==='unavailable-after-erasure'&&!a.original.base64),'door_erased_original_retained');
  for(const entry of plan.entries)if(entry.erased)check(entry.effects.length===0&&equal(entry.source.payload,{erased:true})&&entry.source.sourceId==='erased:'+entry.identity,'door_erased_source_changed');
  return;
 }
 check(plan.source.artifacts.length===1,'door_packet_artifact_changed');
 const artifact=plan.source.artifacts[0],bytes=Buffer.from(artifact.original?.base64??'','base64');
 check(artifact.original?.status==='available'&&bytes.toString('base64')===artifact.original.base64&&bytes.length===artifact.size&&sha256(bytes)===artifact.sha256,'door_packet_original_changed');
 const packet=JSON.parse(bytes.toString('utf8'));
 check(packet.version===1&&packet.sourceType===binding.source_type&&packet.namespace===binding.namespace&&packet.archiveDigest===binding.archive_digest&&packet.capture?.digest===binding.capture_digest&&packet.capture.namespace===binding.namespace&&packet.capture.archiveDigest===binding.archive_digest,'door_packet_binding_changed');
 const capture=structuredClone(packet.capture),stable='door-'+sha256(canonicalJson([binding.source_type,binding.namespace])).slice(0,40);
 for(const message of capture.messages??[])for(const file of message.files??[]){
  const body=Buffer.from(file.base64??'','base64');check(body.toString('base64')===file.base64&&body.length===file.size&&sha256(body)===file.sha256,'door_packet_file_changed');file.bytes=body;delete file.base64;
 }
 decodeRoleCapture(capture);
 const generated=kitSource(capture,binding.owner,stable,stable);
 const expected=generated.source.records.map(record=>{
  const value=structuredClone(record.payload);value.job=binding.domain_job;encodeRoleEffect(record.kind,value);
  if(record.kind==='message')for(const file of value.files)file.objectKey=file.objectKey.replace('/'+generated.domainJob+'/','/'+binding.domain_job+'/');
  return {kind:record.kind,sourceId:record.kind==='actor'?binding.domain_job+':'+value.sourceId:record.sourceId,payload:value};
 });
 check(expected.length===plan.source.records.length,'door_source_record_count_changed');
 for(const [i,record] of plan.source.records.entries())check(equal({kind:record.kind,sourceId:record.sourceId,payload:record.payload},expected[i])&&record.artifactHash===artifact.sha256&&record.location.artifact===artifact.name,'door_normalized_source_changed');
}
