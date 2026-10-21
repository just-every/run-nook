import {DatabaseSync} from 'node:sqlite';
import {readdir,readFile} from 'node:fs/promises';
import {makePart,ContentVerifier,ArchiveVerifier} from '../../src/base/modules/portability/format.mjs';
import {migrationHistory} from '../migration-history.mjs';
import assert from 'node:assert/strict';
import {createPortability,readArchive} from '@runeditrun/rer/modules/portability';
import {productPolicy} from '../../src/platform/portability-policy.mjs';
import {installation,until} from './fixture.mjs';
export async function archive(c){
 const {call,db,mf,member}=c;
 await upgradeHistory(c);
 const quiet=(await call('/api/notify','GET',undefined,member.cookie)).quietSchedule;delete quiet.until;delete quiet.next
 const saved=(await call('/api/notify','PATCH',{quietSchedule:{...quiet,enabled:true}},member.cookie)).quietSchedule
 const policyRoom=c.archiveConversation;
 await call(`/api/conversations/${policyRoom.id}/notify`,'PATCH',{level:'nothing',threads:'all'},member.cookie);
 // Use the same public Base export/import service and product policy as rer's
 // filesystem operator command, over this journey's actual D1 and R2 bindings.
 await call('/api/devices/presence','POST',{id:c.device.id,page:crypto.randomUUID(),visible:true},member.cookie);
 for(const table of ['nook_push_devices','nook_push_presence','nook_push_secrets','nook_notify_queue'])assert.ok((await db.prepare(`SELECT count(*) AS n FROM ${table}`).first()).n>0,'export has live '+table+' to exclude');
 const service=await createPortability({db,buckets:{FILES:await mf.getR2Bucket('FILES')},policy:await productPolicy(db)});
 let exportId,restore;
 try{
  exportId=await service.exports.create();while((await service.exports.advance(exportId,{maxParts:16})).phase==='building'){}
  const bytes=await new Response(await service.exports.download(exportId)).arrayBuffer(),records=[];
  for await(const record of readArchive(new Blob([bytes]).stream()))records.push(record);
  const excluded=['nook_notify_queue','nook_push_devices','nook_push_presence','nook_push_secrets'];
  for(const table of excluded)assert.ok(!records[0].tables.some(row=>row.name===table),'archive excludes '+table);
  assert.ok(!records.flatMap(r=>r.items??[]).some(r=>r.table==='nook_push_delivery_records'&&c.removedRecords.includes(r.row.id)),'fresh archive excludes every positively witnessed erased record');
  const allRows=records.flatMap(r=>r.items??[]).filter(r=>r.kind==='row');assert.ok(allRows.some(r=>r.table==='nook_notify_preferences'&&r.row.user===member.user.id&&r.row.push_mentions===1));
  for(const target of c.recipients.values())assert.ok(!new TextDecoder().decode(bytes).includes(target.subscription.endpoint),'no subscription endpoint in exported bytes');
  let outbound=0;restore=await installation(async()=>{outbound++;return new Response(null,{status:201})},{bootstrap:false});
  const imported=await createPortability({db:restore.db,buckets:{FILES:await restore.mf.getR2Bucket('FILES')},policy:await productPolicy(restore.db),migrations:migrationHistory(await productPolicy(restore.db))});
  // A correctly checksummed staged archive with an erased source must fail even
  // under a fresh row key, independently of the generic erasure_epoch proof.
  const staged=structuredClone(records),entry=staged.flatMap(r=>r.items??[]).find(r=>r.table==='nook_push_delivery_records');assert.ok(entry);
  entry.row={...c.erasedSourceRecord,device:'staged-erased-source',id:`push:${c.erasedSourceRecord.message}:${c.erasedSourceRecord.user}:staged-erased-source`};
  const content=new ContentVerifier(staged[0]),binding=new ArchiveVerifier(staged[0]);
  for(let n=1;n<staged.length-1;n++){staged[n]=await makePart(staged[n].index,staged[n].items);binding.add(staged[n]);for(const item of staged[n].items)content.add(item)}
  const bad=await imported.imports.create(staged[0]);try{for(const record of staged)if(record.kind==='part')await imported.imports.uploadPart(bad,record.index,record);await assert.rejects(imported.imports.finalize(bad,{contentHash:content.digest(),archiveHash:binding.digest()}),/invalid_device_delivery_record/)}finally{await imported.imports.abort(bad)}
  const id=await imported.imports.create(records[0]);for(const record of records)if(record.kind==='part')await imported.imports.uploadPart(id,record.index,record);
  const closing=records.at(-1);await imported.imports.finalize(id,{contentHash:closing.contentHash,archiveHash:closing.archiveHash});
  for(const table of excluded)assert.equal((await restore.db.prepare(`SELECT count(*) AS n FROM ${table}`).first()).n,0,'restored '+table+' empty');
  assert.deepEqual((await restore.db.prepare('SELECT * FROM nook_push_delivery_records ORDER BY id').all()).results,(await db.prepare('SELECT * FROM nook_push_delivery_records ORDER BY id').all()).results,'every retained routing field, reason and time restores exactly');
  for(const witness of c.holdWitnesses){const restored=await restore.db.prepare('SELECT holds FROM nook_push_delivery_records WHERE id=?').bind(witness.id).first();assert.deepEqual(JSON.parse(restored.holds),witness.holds,'each quiet/snooze hold and release time restores exactly')}
  const kept='SELECT count(*) AS n FROM nook_push_delivery_records WHERE user=?';assert.equal((await restore.db.prepare(kept).bind(member.user.id).first()).n,(await db.prepare(kept).bind(member.user.id).first()).n,'retained routing records restore');assert.ok((await restore.db.prepare(kept).bind(member.user.id).first()).n>105);
  const restoredQuiet=await restore.db.prepare('SELECT * FROM nook_quiet_schedules WHERE user=?').bind(member.user.id).first();assert.equal(restoredQuiet.enabled,1);assert.equal(restoredQuiet.zone,quiet.zone);assert.deepEqual(JSON.parse(restoredQuiet.days_json),quiet.days)
  assert.equal((await restore.db.prepare('SELECT push_mentions FROM nook_notify_preferences WHERE user=?').bind(member.user.id).first()).push_mentions,1);
  assert.deepEqual(await restore.db.prepare('SELECT level,threads FROM nook_conversation_notify WHERE user=? AND conversation=?').bind(member.user.id,policyRoom.id).first(),{level:'nothing',threads:'all'});
  assert.equal((await restore.db.prepare('SELECT body FROM nook_messages WHERE id=?').bind(c.preserved.id).first()).body,c.preserved.body,'actual private content restored');
  assert.equal((await restore.db.prepare('SELECT count(*) AS n FROM oa_sessions').first()).n,0,'archive restores no live sessions');
  await restore.call('/api/me','GET',undefined,member.cookie,401);
  // Arm the restored real ChatHub through its normal internal hint, then allow
  // its alarm to drain. No old queue, subscriptions or network effects return.
  const hub=await restore.mf.getDurableObjectNamespace('CHAT_HUB');await hub.get(hub.idFromName('workspace')).fetch('https://hub/hint');
  await until(async()=>{const point=await restore.db.prepare('SELECT quiet_until,next_change FROM nook_quiet_schedules WHERE user=?').bind(member.user.id).first();return point.quiet_until===saved.until&&point.next_change===saved.next},'restored alarm recomputes the saved local calendar boundary');await new Promise(resolve=>setTimeout(resolve,6500));assert.equal(outbound,0);
  await legacyArchive(c,records);
  c.t.diagnostic('Recovery: actual Base archive bytes from real D1/R2 exclude secrets/devices/presence/live delivery queue and keep retained routing records; restored preferences and private content match, old session denied, real restored ChatHub alarm emits zero pushes.');
 }finally{if(exportId)await service.exports.abort(exportId);await restore?.close()}
}

export async function erasedArchive(c){
 const service=await createPortability({db:c.db,buckets:{FILES:await c.mf.getR2Bucket('FILES')},policy:await productPolicy(c.db)}),id=await service.exports.create();
 try{while((await service.exports.advance(id,{maxParts:16})).phase==='building'){}let kept=0;for await(const record of readArchive(await service.exports.download(id)))for(const item of record.items??[])if(item.table==='nook_push_delivery_records'){assert.ok(!c.removedRecords.includes(item.row.id),'fresh post-scale-erasure archive excludes all erased records');kept++}assert.ok(kept>0,'unaffected routing records remain in the fresh archive')}finally{await service.exports.abort(id)}
}

// Replay the prior schema over records produced by this public-door journey.
// This is a populated upgrade fixture, not a replacement application or pinned
// source assertion. Pruned queues and removed devices must remain classifiable.
async function upgradeHistory(c){
 const db=new DatabaseSync(':memory:');
 try{
  const latest='0074_push_record_sources.sql',migrations=(await readdir('migrations')).filter(n=>n.endsWith('.sql')&&n<latest).sort();
  for(const name of migrations)db.exec(await readFile('migrations/'+name,'utf8'));
  for(const table of ['nook_actors','oa_operators','nook_access','nook_conversations','nook_messages','nook_erased_messages','nook_erased_actors','nook_outcomes','nook_outcome_versions','nook_erased_outcomes','nook_erased_outcome_actions']){
   const rows=(await c.db.prepare('SELECT * FROM '+table).all()).results;for(const row of rows){const keys=Object.keys(row);db.prepare(`INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map(()=>'?').join(',')})`).run(...Object.values(row))}
  }
  const columns=db.prepare('PRAGMA table_info(nook_push_delivery_records)').all().map(c=>c.name),insert=db.prepare(`INSERT INTO nook_push_delivery_records VALUES(${columns.map(()=>'?').join(',')})`);
  const records=(await c.db.prepare("SELECT * FROM nook_push_delivery_records WHERE held_at IS NOT NULL OR state='cancelled' ORDER BY id").all()).results;assert.ok(records.length>=105);
  for(const record of [...records,c.erasedSourceRecord])insert.run(...columns.map(k=>record[k]));
  const queued=await c.db.prepare("SELECT * FROM nook_notify_queue WHERE channel='push' AND held_at IS NOT NULL LIMIT 1").first();assert.ok(queued);const queueKeys=Object.keys(queued);db.prepare(`INSERT INTO nook_notify_queue(${queueKeys.join(',')}) VALUES(${queueKeys.map(()=>'?').join(',')})`).run(...Object.values(queued));
  assert.ok(db.prepare('SELECT 1 FROM nook_push_delivery_records WHERE id=?').get(c.erasedSourceRecord.id),'upgrade begins with an erased-source historical record');
  const ambiguous={...records[0],id:'unresolvable-prior-source'};insert.run(...columns.map(k=>ambiguous[k]));
  const migration=await readFile('migrations/'+latest,'utf8');db.exec('BEGIN');assert.throws(()=>db.exec(migration),/ambiguous_delivery_source/);db.exec('ROLLBACK');
  assert.equal(db.prepare('SELECT count(*) AS n FROM nook_push_delivery_records').get().n,records.length+2,'refused upgrade preserves every original row');db.prepare('DELETE FROM nook_push_delivery_records WHERE id=?').run(ambiguous.id);
  db.exec('BEGIN');db.exec(migration);db.exec('COMMIT');
  assert.equal(db.prepare('SELECT count(*) AS n FROM nook_push_delivery_records').get().n,records.length);assert.equal(db.prepare('SELECT 1 FROM nook_push_delivery_records WHERE id=?').get(c.erasedSourceRecord.id),undefined,'upgrade removes erased source');
  for(const record of records){const upgraded=db.prepare('SELECT * FROM nook_push_delivery_records WHERE id=?').get(record.id);assert.ok(upgraded);for(const key of ['message','outcome','actor','source_version'])assert.equal(upgraded[key],record[key],key+' is recovered from source identity and exact source version');assert.equal(upgraded.legacy,1);assert.deepEqual(JSON.parse(upgraded.holds),record.held_at===null?[]:[{kind:'legacy-activity-or-mobile-delay',start:record.held_at,release:record.released_at}],'unknown legacy holds are never invented')}
  c.upgradedRecords=db.prepare('SELECT * FROM nook_push_delivery_records ORDER BY id').all().map(row=>({...row}));
  c.t.diagnostic(`Populated prior-data upgrade: ${records.length} valid records classified from a live queue and pruned IDs/source versions without devices; erased source removed; ambiguous source refused atomically with all prior rows preserved.`);
 }finally{db.close()}
}

// Valid classified legacy history also crosses the real import and export
// service. A populated source-less archive is refused, not silently promoted.
async function legacyArchive(c,records){
 const staged=structuredClone(records),upgraded=new Map(c.upgradedRecords.map(r=>[r.id,r]));
 for(const entry of staged.flatMap(r=>r.items??[]))if(entry.table==='nook_push_delivery_records'&&upgraded.has(entry.row.id))entry.row=upgraded.get(entry.row.id);
 let outbound=0;const restored=await installation(async()=>{outbound++;return new Response(null,{status:201})},{bootstrap:false});
 try{
  const service=await createPortability({db:restored.db,buckets:{FILES:await restored.mf.getR2Bucket('FILES')},policy:await productPolicy(restored.db),migrations:migrationHistory(await productPolicy(restored.db))});
  const importRows=async(source,error)=>{
   const content=new ContentVerifier(source[0]),binding=new ArchiveVerifier(source[0]),id=await service.imports.create(source[0]);let complete=false;
   try{for(const part of source.slice(1,-1)){const packed=await makePart(part.index,part.items);binding.add(packed);for(const item of packed.items)content.add(item);await service.imports.uploadPart(id,packed.index,packed)}
    const finish=service.imports.finalize(id,{contentHash:content.digest(),archiveHash:binding.digest()});if(error)await assert.rejects(finish,error);else{await finish;complete=true;}
   }finally{if(!complete)await service.imports.abort(id)}
  };
  const ambiguous=structuredClone(staged),entry=ambiguous.flatMap(r=>r.items??[]).find(r=>r.table==='nook_push_delivery_records');assert.ok(entry&&entry.row.actor);entry.row.actor=null;
  await importRows(ambiguous,/invalid_device_delivery_record/);
  await importRows(staged);
  for(const record of c.upgradedRecords)assert.deepEqual(await restored.db.prepare('SELECT * FROM nook_push_delivery_records WHERE id=?').bind(record.id).first(),record,'classified legacy source and honest aggregate hold restore exactly');
  const id=await service.exports.create();try{while((await service.exports.advance(id,{maxParts:16})).phase==='building'){}const exported=[];for await(const part of readArchive(await service.exports.download(id)))for(const item of part.items??[])if(item.table==='nook_push_delivery_records'&&upgraded.has(item.row.id))exported.push(item.row);assert.deepEqual(exported.sort((a,b)=>a.id.localeCompare(b.id)),c.upgradedRecords,'all classified legacy rows survive a fresh operational export')}finally{await service.exports.abort(id)}
  for(const table of ['nook_notify_queue','nook_push_devices','nook_push_presence','nook_push_secrets'])assert.equal((await restored.db.prepare('SELECT count(*) AS n FROM '+table).first()).n,0);
  assert.equal(outbound,0);c.t.diagnostic('Classified prior-schema records restore and re-export exactly; an archive with an ambiguous causing actor is refused; no delivery authority or old sends return.');
 }finally{await restored.close()}
}
