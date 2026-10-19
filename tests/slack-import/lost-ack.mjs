import assert from 'node:assert/strict';
import {slackServiceFixture} from './sqlite-service.mjs';
export async function lostAckFlow(inspectReversed){
 const f=await slackServiceFixture();
 try{
  await f.accept(await f.invite('lost-ack-reader@example.test'));
  const reader=f.db.prepare("SELECT id FROM oa_operators WHERE email='lost-ack-reader@example.test'").get().id;
  const inspection=await f.upload(),members=[f.owner.operatorId,reader],plan=await f.preview(inspection,members),batch=f.adapter.batch.bind(f.adapter);let dropped=false;
  f.adapter.batch=async statements=>{const result=await batch(statements);if(!dropped&&statements.some(s=>/INSERT INTO ik_jobs\(/.test(s.sql))){dropped=true;throw Error('Lost create acknowledgement')}return result};
  await f.door.apply(plan,{status:409});f.adapter.batch=batch;assert.equal(dropped,true);
  const raw=f.db.prepare('SELECT * FROM ik_jobs').get();assert.equal(raw.state,'queued');assert.equal(raw.checkpoint,0);
  assert.equal(f.db.prepare('SELECT job_id FROM ik_door_plans WHERE id=?').get(plan.planId).job_id,null);
  f.db.prepare("UPDATE oa_operators SET role='admin',version=version+1 WHERE id=?").run(reader);
  const status=await f.door.status(plan);assert.equal(status.job.id,raw.id);assert.equal(status.job.checkpoint,0);
  assert.ok((await f.door.history()).jobs.some(j=>j.planId===plan.planId&&j.jobId===raw.id));
  await f.door.apply(plan,{status:409});assert.equal(f.db.prepare('SELECT count(*) AS n FROM nook_import_records').get().n,0);
  const result=await f.door.undo(plan);assert.equal(result.job.state,'rolled_back');
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM nook_imports').get().n,0);
  await inspectReversed?.(f,plan);
  const fresh=await f.preview(inspection,members,'archive-fixture-fresh');await f.finish(fresh);await f.door.undo(plan);
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM nook_import_records').get().n,fresh.counts.messages);
  return {durable:{state:raw.state,checkpoint:raw.checkpoint,total:raw.total},recovered:status.job.state,staleForward:'refused',reversal:result.job.state,replacement:'completed'};
 }finally{f.close()}
}
