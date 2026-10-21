import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {until} from './fixture.mjs';
const require=createRequire(import.meta.url),{build}=createRequire(require.resolve('wrangler'))('esbuild');
const DAY=86400_000;
// The person's own readable export through the app's job/page doors. Routing records
// do not depend on conversation scope, so one conversation keeps the export small.
async function deliveries({call,member},conversation){
 let job=await call('/api/readable-exports','POST',{scope:'conversation',conversationId:conversation.id,custodyAccepted:true},member.cookie);
 for(let n=0;!job.complete&&n<1000;n++)job=await call(`/api/readable-exports/${job.id}/step`,'POST',{},member.cookie);
 assert.ok(job.complete,'readable export completes');const records=[];
 for(const page of (await call(`/api/readable-exports/${job.id}/index`,'GET',undefined,member.cookie)).items)records.push(...(await call(`/api/readable-exports/${job.id}/pages/${page.ordinal}`,'GET',undefined,member.cookie)).records);
 return records.filter(r=>r.type==='device_deliveries').map(r=>r.data);
}
/** More than 100 activity-held phone alerts, canceled by a read with their reason.
 * The earlier sender is erased by now; a remaining member sends. */
export async function retention(c){
 const {call,db,member,unrelated,device,room,send,read,register,ownerCookie}=c;
 const started=Date.now();await call('/api/settings','PATCH',{dndUntil:null},member.cookie);
 const phone=await register(member,'Retention phone',undefined,'mobile'),page=crypto.randomUUID(),channel=await room('Weekly launch review','private',[member.user.id,unrelated.user.id]);
 const beat=()=>call('/api/devices/presence','POST',{id:device.id,page,visible:true,lastInputAt:Date.now()},member.cookie);
 const held=async()=>(await db.prepare("SELECT count(*) AS n FROM nook_notify_queue WHERE channel='push' AND device=? AND held_at IS NOT NULL").bind(phone.id).first()).n;
 for(let i=0;i<105;i++){if(i%15===0)await beat();await send(channel,{mentions:[member.user.id]},unrelated.cookie)}
 await until(async()=>{await beat();return await held()===105},'phone holds all 105 mentions while desktop is active',90_000);
 await read(channel);
 await until(async()=>(await db.prepare("SELECT count(*) AS n FROM nook_notify_queue WHERE channel='push' AND device=? AND state='cancelled' AND error='held-active-elsewhere'").bind(phone.id).first()).n===105,'read cancels every held phone alert');
 await call('/api/devices/presence','POST',{id:device.id,page,visible:false,lastInputAt:Date.now()},member.cookie);
 const view=await call('/api/devices','GET',undefined,member.cookie);assert.equal(view.alerts.length,100,'the delivery view shows at most the latest 100');
 // Earlier journey work can still reach a terminal cancellation while the
 // archive runs. Take the exact retention baseline only after that real work
 // settles, so later clock checks compare the same completed delivery set.
 await until(async()=>!(await db.prepare("SELECT 1 FROM nook_notify_queue WHERE channel='push' AND state IN ('pending','sending','retrying') LIMIT 1").first()),'all push work settles before the retained export baseline');
 const exported=await deliveries(c,channel),phoneRecords=exported.filter(r=>r.device===phone.id);
 assert.equal(phoneRecords.length,105,'export carries every record beyond the view limit');
 assert.ok(phoneRecords.every(r=>r.routing==='canceled'&&r.error==='held-active-elsewhere'&&r.reason==='mention'&&r.held_at>0&&r.device_name==='Retention phone'&&r.source_conversation===channel.id));
 assert.ok(exported.some(r=>r.routing==='released'&&r.device_name==='Ana’s phone'&&r.released_at>0),'released records survive device removal');
 assert.ok(!(await deliveries({call,member:{cookie:ownerCookie}},channel)).some(r=>r.device===phone.id),'the owner role exports none of another member’s routing');
 c.retention={phone,channel,exported:exported.length};c.t.diagnostic(`Retention records and bounded view: ${Math.round((Date.now()-started)/1000)} s.`);
}
/** Advance the actual push run's explicit clock past seven days and the queue's
 * own pruning: the view loses the rows, the export keeps them with reasons. */
export async function retentionClock(c){
 const {call,db,member,origin}=c,{phone,channel,exported}=c.retention;
 await until(async()=>!(await db.prepare("SELECT 1 FROM nook_notify_queue WHERE channel='push' AND state IN ('pending','sending','retrying') LIMIT 1").first()),'no live push work before the clock moves');
 const temp=await mkdtemp(join(tmpdir(),'nook-push-clock-'));
 try{
  const output=join(temp,'run.mjs');await build({stdin:{contents:"export {drainPush} from './src/push/run';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile:output,logLevel:'silent'});
  const {drainPush}=await import(pathToFileURL(output));
  for(const days of [8,31]){
   await drainPush({DB:db,AUTH_ORIGIN:origin,AUTH_LOCAL:'true'},Date.now()+days*DAY,async()=>assert.fail('no delivery is attempted'));
   const queue=(await db.prepare("SELECT count(*) AS n FROM nook_notify_queue WHERE device=?").bind(phone.id).first()).n;assert.equal(queue,days===8?105:0,days+' days: queue pruning follows its own retention');
  }
  const view=await call('/api/devices','GET',undefined,member.cookie);assert.ok(!view.alerts.some(a=>a.device===phone.id),'the bounded view no longer lists them');
  const records=await deliveries(c,channel);assert.equal(records.length,exported,'export still holds every record');assert.equal(records.filter(r=>r.device===phone.id&&r.error==='held-active-elsewhere').length,105);
  c.t.diagnostic(`NOOK-073 retention: 105 held phone alerts canceled by a read; view 100, export ${exported}; after a 31-day push-run clock the queue and view drop them and the export keeps all with reasons.`);
 }finally{await rm(temp,{recursive:true,force:true})}
}
