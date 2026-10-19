import assert from 'node:assert/strict';
import {makePart} from '../../src/base/modules/portability/index.mjs';
import {ArchiveVerifier,ContentVerifier} from '../../src/base/modules/portability/format.mjs';
import {slackServiceFixture,testBucket} from './sqlite-service.mjs';
import {reverseRestored} from './restored-reversal.mjs';
import {lostAckFlow} from './lost-ack.mjs';

export async function slackPortabilityFlow({exportedArchive,restoredArchive}){
 const f=await slackServiceFixture();
 try{
  await f.accept(await f.invite('archive-reader@example.test'));
  const reader=f.db.prepare("SELECT id FROM oa_operators WHERE email='archive-reader@example.test'").get().id,members=[f.owner.operatorId,reader],inspection=await f.upload(),plan=await f.preview(inspection,members),result=await f.finish(plan);
  assert.equal(result.job.state,'completed');
  const records=await exportedArchive(f,f.bucket),verifyRows=target=>{
   assert.equal(target.db.prepare('SELECT count(*) AS n FROM nook_import_records').get().n,plan.counts.messages);
   assert.equal(target.db.prepare('SELECT count(*) AS n FROM nook_import_records WHERE parent IS NOT NULL').get().n,plan.counts.threads);
   assert.equal(target.db.prepare('SELECT count(*) AS n FROM nook_import_files').get().n,plan.counts.files);
   const link=target.db.prepare('SELECT p.job_id FROM nook_door_imports n JOIN ik_door_plans p ON p.id=n.plan_id WHERE n.plan_id=?').get(plan.planId);assert.equal(link.job_id,result.job.id);assert.equal(target.db.prepare('SELECT state FROM ik_jobs WHERE id=?').get(link.job_id).state,'completed');
  };
  const restoredBucket=testBucket();await restoredArchive(records,{bucket:restoredBucket,inspect:verifyRows});
  for(const object of records[0].objects)assert.deepEqual(Buffer.from(await(await restoredBucket.get(object.key)).arrayBuffer()),Buffer.from(await(await f.bucket.get(object.key)).arrayBuffer()));
  const undoBucket=testBucket();await restoredArchive(records,{bucket:undoBucket,inspect:target=>reverseRestored(target,undoBucket,plan.planId,f.owner.operatorId)});
  // Each mutation keeps transport checksums valid. The real offline door must
  // reject semantic custody tampering before it writes any provider bytes.
  for(const [name,mutate,remove] of [
   ['missing completed job',rows=>{rows('ik_door_plans')[0].job_id='missing-job'}],
   ['missing Base custody',()=>{},table=>table.startsWith('ik_')],
   ['changed completed plan',rows=>{rows('ik_jobs')[0].plan_json='{}'}],
   ['queued completed history',rows=>{rows('ik_jobs')[0].state='queued'}],
   ['fabricated checkpoint',rows=>{rows('ik_jobs')[0].checkpoint--}],
   ['changed publication provenance',rows=>{rows('ik_provenance')[0].record_json='{}'}],
   ['changed retained original',rows=>{rows('ik_d1_original_chunks')[0].bytes='e30='}],
   ['changed reviewed capture',rows=>{rows('nook_door_imports')[0].capture_digest='0'.repeat(64)}],
   ['changed summary',rows=>{const row=rows('nook_door_imports')[0],summary=JSON.parse(row.summary_json);summary.archiveDigest='0'.repeat(64);row.summary_json=JSON.stringify(summary)}],
   ['strict reversal cursor',rows=>{rows('ik_jobs')[0].reversal_cursor=1}],
   ['strict reversal hash',rows=>{rows('ik_jobs')[0].reversal_hash='changed'}],
   ['strict reversal binding',rows=>{rows('ik_jobs')[0].reversal_policy_hash='changed'}],
   ['missing apply journal',()=>{},table=>table==='ik_batches'],
   ['changed journal fence',rows=>{rows('ik_batches')[0].fence++}],
   ['changed job fence',rows=>{rows('ik_jobs')[0].fence++}],
   ['changed plan index',rows=>{rows('ik_d1_plan_index')[0].source_identity='changed'}],
   ['missing custody state',()=>{},table=>table==='ik_d1_custody_states'],
   ['changed job fingerprint',rows=>{rows('ik_jobs')[0].fingerprint='0'.repeat(64)}],
   ['changed job namespace',rows=>{rows('ik_jobs')[0].namespace='forged-namespace'}],
   ['changed job mapping',rows=>{rows('ik_jobs')[0].mapping_version='forged-mapping'}],
   ['changed snapshot',rows=>{rows('ik_door_plans')[0].snapshot_hash='0'.repeat(64)}],
   ['changed source binding',rows=>{rows('nook_door_imports')[0].domain_job='slack-forged'}],
  ]){
   const forged=structuredClone(records),items=forged.flatMap(r=>r.items??[]);mutate(table=>items.filter(i=>i.kind==='row'&&i.table===table).map(i=>i.row));
   if(remove){for(const part of forged.filter(r=>r.kind==='part'))part.items=part.items.filter(i=>i.kind!=='row'||!remove(i.table));for(const table of forged[0].tables)if(remove(table.name))table.count=0;for(let i=forged.length-2;i>0;i--)if(!forged[i].items.length)forged.splice(i,1);const parts=forged.filter(r=>r.kind==='part');parts.forEach((p,i)=>p.index=i);forged[0].partCount=forged.at(-1).partCount=parts.length}
   const verifier=new ContentVerifier(forged[0]),binding=new ArchiveVerifier(forged[0]);for(let i=0;i<forged.length;i++)if(forged[i].kind==='part'){forged[i]=await makePart(forged[i].index,forged[i].items);binding.add(forged[i]);for(const item of forged[i].items)verifier.add(item)}forged.at(-1).contentHash=verifier.digest();forged.at(-1).archiveHash=binding.digest();
   const bucket=testBucket();await restoredArchive(forged,{bucket,rejection:/door_|slack_|invalid_|provenance|checksum|journal|original/i,label:name});assert.deepEqual((await bucket.list()).objects,[],name+' wrote provider bytes');
  }
  await f.preview(inspection,[f.owner.operatorId],'draft-fixture');await restoredArchive(await exportedArchive(f,f.bucket),{bucket:testBucket(),inspect:verifyRows});
  assert.equal((await f.door.undo(plan)).job.state,'undone');
  await f.door.request('cleanup');
  await restoredArchive(await exportedArchive(f,f.bucket),{bucket:testBucket(),inspect:target=>assert.equal(target.db.prepare('SELECT count(*) AS n FROM nook_import_records').get().n,0)});
  const fresh=await f.preview(inspection,members,'replacement-fixture');await f.finish(fresh);await f.door.undo(plan);
  await restoredArchive(await exportedArchive(f,f.bucket),{bucket:testBucket(),inspect:target=>assert.equal(target.db.prepare('SELECT count(*) AS n FROM nook_import_records').get().n,fresh.counts.messages)});
  const replacementBucket=testBucket();await restoredArchive(await exportedArchive(f,f.bucket),{bucket:replacementBucket,inspect:target=>reverseRestored(target,replacementBucket,fresh.planId,f.owner.operatorId)});
 }finally{f.close()}
 await lostAckFlow(async(source,plan)=>{const bucket=testBucket();await restoredArchive(await exportedArchive(source,source.bucket),{bucket,inspect:target=>reverseRestored(target,bucket,plan.planId,source.owner.operatorId,'rolled_back')})});
}
