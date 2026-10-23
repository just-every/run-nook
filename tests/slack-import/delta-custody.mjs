import assert from 'node:assert/strict';
import {createPortability,readArchive} from '@runeditrun/rer/modules/portability';
import {productPolicy} from '../../src/platform/portability-policy.mjs';
import {migrationHistory} from '../migration-history.mjs';
import {installation} from '../push/fixture.mjs';

export async function deltaCustody({app,room,root,oldBody,pass,attestation,outsider}){
 const {db,call,ownerCookie}=app;
 let job=await call('/api/readable-exports','POST',{scope:'conversation',conversationId:room.id,custodyAccepted:true},ownerCookie);
 for(let n=0;!job.complete&&n<100;n++)job=await call('/api/readable-exports/'+job.id+'/step','POST',{},ownerCookie);
 assert.ok(job.complete);const index=await call('/api/readable-exports/'+job.id+'/index','GET',undefined,ownerCookie),readable=[];
 for(const page of index.items)readable.push(...(await call(`/api/readable-exports/${job.id}/pages/${page.ordinal}`,'GET',undefined,ownerCookie)).records);
 assert.ok(readable.some(record=>record.type==='imported_revisions'&&record.data.message===root.id&&record.data.body===oldBody));
 assert.deepEqual(readable.find(record=>record.type==='import_attestations'&&record.data.pass===pass.planId)?.data.attestation,attestation,'owner readable export includes pass attestation');
 let privateJob=await call('/api/readable-exports','POST',{scope:'permitted',custodyAccepted:true},outsider.cookie);for(let n=0;!privateJob.complete&&n<100;n++)privateJob=await call('/api/readable-exports/'+privateJob.id+'/step','POST',{},outsider.cookie);assert.ok(privateJob.complete);const privateIndex=await call('/api/readable-exports/'+privateJob.id+'/index','GET',undefined,outsider.cookie);for(const page of privateIndex.items)assert.ok(!(await call(`/api/readable-exports/${privateJob.id}/pages/${page.ordinal}`,'GET',undefined,outsider.cookie)).records.some(record=>record.type==='import_attestations'),'another member exports no owner attestation');
 const service=await createPortability({db,buckets:{FILES:await app.mf.getR2Bucket('FILES')},policy:await productPolicy(db)}),exportId=await service.exports.create(),archive=[];
 try{while((await service.exports.advance(exportId,{maxParts:16})).phase==='building'){}for await(const record of readArchive(await service.exports.download(exportId)))archive.push(record)}finally{await service.exports.abort(exportId)}
 const restored=await installation(undefined,{bootstrap:false});
 try{
  const policy=await productPolicy(restored.db),importer=await createPortability({db:restored.db,buckets:{FILES:await restored.mf.getR2Bucket('FILES')},policy,migrations:migrationHistory(policy)}),id=await importer.imports.create(archive[0]);
  for(const record of archive)if(record.kind==='part')await importer.imports.uploadPart(id,record.index,record);
  await importer.imports.finalize(id,{contentHash:archive.at(-1).contentHash,archiveHash:archive.at(-1).archiveHash});
  const rows=(await restored.db.prepare('SELECT body FROM nook_import_records WHERE id=?').bind(root.id).all()).results;assert.equal(rows.length,1);
  const restoredPass=await restored.db.prepare('SELECT summary_json FROM nook_door_imports WHERE plan_id=?').bind(pass.planId).first();assert.deepEqual(JSON.parse(restoredPass.summary_json).attestation,attestation,'archive restores the pass attestation with populated history');
  assert.equal((await restored.db.prepare('SELECT count(*) AS n FROM nook_notify_queue').first()).n,0,'restored attestation queues no mail');assert.equal((await restored.db.prepare("SELECT count(*) AS n FROM nook_schedules WHERE state='active'").first()).n,0,'restored attestation resumes no scheduled send');
  const history=(await restored.db.prepare('SELECT record_json FROM ik_provenance WHERE target_id=? AND reversed=0 UNION ALL SELECT record_json FROM ik_d1_history WHERE target_id=? AND reversed=0').bind(root.id,root.id).all()).results;assert.ok(JSON.stringify(history).includes(oldBody));
 }finally{await restored.close()}
}
