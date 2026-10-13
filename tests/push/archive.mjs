import assert from 'node:assert/strict';
import {createPortability,readArchive} from '@runeditrun/rer/modules/portability';
import {productPolicy} from '../../src/platform/portability-policy.mjs';
import {installation} from './fixture.mjs';
export async function archive(c){
 const {call,db,mf,member}=c;
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
  const allRows=records.flatMap(r=>r.items??[]).filter(r=>r.kind==='row');assert.ok(allRows.some(r=>r.table==='nook_notify_preferences'&&r.row.user===member.user.id&&r.row.push_mentions===1));
  for(const target of c.recipients.values())assert.ok(!new TextDecoder().decode(bytes).includes(target.subscription.endpoint),'no subscription endpoint in exported bytes');
  let outbound=0;restore=await installation(async()=>{outbound++;return new Response(null,{status:201})},{bootstrap:false});
  const imported=await createPortability({db:restore.db,buckets:{FILES:await restore.mf.getR2Bucket('FILES')},policy:await productPolicy(restore.db)});
  const id=await imported.imports.create(records[0]);for(const record of records)if(record.kind==='part')await imported.imports.uploadPart(id,record.index,record);
  const closing=records.at(-1);await imported.imports.finalize(id,{contentHash:closing.contentHash,archiveHash:closing.archiveHash});
  for(const table of excluded)assert.equal((await restore.db.prepare(`SELECT count(*) AS n FROM ${table}`).first()).n,0,'restored '+table+' empty');
  assert.equal((await restore.db.prepare('SELECT push_mentions FROM nook_notify_preferences WHERE user=?').bind(member.user.id).first()).push_mentions,1);
  assert.equal((await restore.db.prepare('SELECT body FROM nook_messages WHERE id=?').bind(c.preserved.id).first()).body,c.preserved.body,'actual private content restored');
  assert.equal((await restore.db.prepare('SELECT count(*) AS n FROM oa_sessions').first()).n,0,'archive restores no live sessions');
  await restore.call('/api/me','GET',undefined,member.cookie,401);
  // Arm the restored real ChatHub through its normal internal hint, then allow
  // its alarm to drain. No old queue, subscriptions or network effects return.
  const hub=await restore.mf.getDurableObjectNamespace('CHAT_HUB');await hub.get(hub.idFromName('workspace')).fetch('https://hub/hint');await new Promise(resolve=>setTimeout(resolve,6500));assert.equal(outbound,0);
  c.t.diagnostic('Recovery: actual Base archive bytes from real D1/R2 exclude secrets/devices/presence/all delivery state; restored preferences and private content match, old session denied, real restored ChatHub alarm emits zero pushes.');
 }finally{if(exportId)await service.exports.abort(exportId);await restore?.close()}
}
