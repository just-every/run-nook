import {canonicalJson} from './kit.ts';
import {recordKey} from '../base/modules/import-kit/src/door/inventory.ts';
const check=(ok,code)=>{if(!ok)throw Error(code)};
const equal=(a,b)=>canonicalJson(a)===canonicalJson(b);

/** An unchanged or absent source keeps exactly its predecessor's targets.
 * Every newly written target names the plan and source that published it. */
export function validateDoorLineage(snapshots){
 for(const snapshot of snapshots.values()){
  const previous=snapshot.previous?snapshots.get(snapshot.previous):null;
  check(!snapshot.previous||previous,'door_previous_snapshot_missing');
  const prior=new Map((previous?.records??[]).map(r=>[recordKey(r),r]));
  const actual=new Map(snapshot.records.map(r=>[recordKey(r),r])),seen=new Set();
  check(actual.size===snapshot.records.length&&snapshot.sourceCount===snapshot.plan.entries.length,'door_snapshot_records_changed');
  for(const entry of snapshot.plan.entries){
   const key=recordKey(entry.source),row=actual.get(key),old=prior.get(key);seen.add(key);
   const targets=entry.effects.length?entry.effects.map(e=>({kind:e.targetKind,id:e.targetId,ownerPlanId:snapshot.id,sourceIdentity:entry.identity})):(old?.targets??[]);
   check(row&&row.sourceHash===(entry.rejection&&old?old.sourceHash:entry.source.payloadHash)&&equal(row.targets,targets),'door_snapshot_targets_changed');
  }
  const gone=[...prior.keys()].filter(key=>!seen.has(key));
  check(actual.size===seen.size+gone.length&&equal(snapshot.differences.gone,gone),'door_snapshot_missing_source_changed');
  for(const key of gone)check(equal(actual.get(key)?.targets,prior.get(key).targets)&&actual.get(key).sourceHash===prior.get(key).sourceHash,'door_snapshot_retained_target_changed');
  for(const key of snapshot.differences.unchanged){const entry=snapshot.plan.entries.find(e=>recordKey(e.source)===key),old=prior.get(key);check(entry&&old&&entry.effects.length===0&&!entry.rejection&&old.sourceHash===entry.source.payloadHash,'door_snapshot_unchanged_changed');}
 }
}
