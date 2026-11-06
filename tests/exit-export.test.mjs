import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,mkdir,writeFile,readFile,readdir,symlink,rm,cp,copyFile,rename} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFile,execFileSync,spawn} from 'node:child_process';
import {DatabaseSync,backup} from 'node:sqlite';
import {promisify} from 'node:util';
import {createRequire} from 'node:module';
import {getPlatformProxy} from 'wrangler';
import {remoteExport} from '../scripts/local/remote-export.mjs';
import {transfer} from '../scripts/local/transfer.mjs';
import {recoverNormalizedFixture} from './recovery-support.mjs';
import {opaqueToken} from '../src/base/modules/operator-auth/crypto.mjs';
import {ownerSigninDigest} from '../src/base/modules/operator-auth/owner-signin-grant.mjs';
import {archiveContent} from '../scripts/local/archive-content.mjs';
import {assertRestoreAudit} from './archive-content.mjs';
import {freePort} from './worker-ports.mjs';
import {devKey} from './dev-key.mjs';
import {recoverNormalized} from '../scripts/storage/recover-identities.mjs';

// One public hosted-export -> offline import journey. D1 and R2 are real local
// Cloudflare bindings. No application, archive, search or file implementation is replaced.
test('an owner can export a hosted workspace and restore messages, files, search and replay into a fresh installation',{timeout:360_000},async t=>{
 const directory=await mkdtemp(join(tmpdir(),'nook-exit-')),execute=promisify(execFile),root=process.cwd();
 let proxy,server;
 try{
  const require=createRequire(import.meta.url),{build}=createRequire(require.resolve('wrangler'))('esbuild'),bundle=join(directory,'routes.mjs');
  await build({stdin:{contents:"export {portabilityRoute} from './src/platform/portability.server';export {authRoute} from './src/platform/operator-auth.server';export {context} from './src/platform/storage/context';export {write} from './src/platform/storage/commands';export {read} from './src/platform/storage/read';export {upload,download} from './src/platform/storage/files';export {createSchedule} from './src/scheduled/service';export {createReminder,reminderPreview} from './src/reminders/service'",resolveDir:root},bundle:true,platform:'node',format:'esm',outfile:bundle,logLevel:'silent'});
  const app=await import(bundle);
  async function installation(name,migrate=true){
   const path=join(directory,name);await mkdir(path);await symlink(join(root,'migrations'),join(path,'migrations'));
   await writeFile(join(path,'wrangler.jsonc'),JSON.stringify({name:'nook-exit',compatibility_date:'2026-09-08',d1_databases:[{binding:'DB',database_name:'nook-exit',database_id:'00000000-0000-0000-0000-000000000001',migrations_dir:'migrations'}],r2_buckets:[{binding:'FILES',bucket_name:'nook-exit-files'}]}));
   if(migrate)await execute(process.execPath,[resolve('node_modules/wrangler/bin/wrangler.js'),'d1','migrations','apply','DB','--local','--config',join(path,'wrangler.jsonc'),'--persist-to',join(path,'.wrangler/state')],{env:{...process.env,CI:'true',WRANGLER_SEND_METRICS:'false'},maxBuffer:4*1024*1024});return path;
  }
  async function open(path){return getPlatformProxy({configPath:join(path,'wrangler.jsonc'),persist:{path:join(path,'.wrangler/state/v3')},remoteBindings:false})}
  // Apply the real migration CLI once, then copy its stopped, still-empty
  // state (including any WAL) before starting either binding or creating data.
  // Both installations have real migrated D1 databases and independent state;
  // repeating every migration is not part of this hosted export/restore proof.
  const source=await installation('source'),fresh=await installation('fresh',false);
  await cp(join(source,'.wrangler/state'),join(fresh,'.wrangler/state'),{recursive:true,errorOnExist:true,force:false});
  const local=join(directory,'local');await mkdir(local);
  await cp(join(source,'.wrangler/state'),join(local,'.wrangler/state'),{recursive:true,errorOnExist:true,force:false});
  proxy=await open(source);
  // The remote hint transport carries no product data; the restored replay is checked below.
  const hub={idFromName:()=> 'workspace',get:()=>({fetch:async()=>new Response(null,{status:204})})};
  let env;
  server=createServer(async(req,res)=>{
   try{const chunks=[];for await(const chunk of req)chunks.push(chunk);const request=new Request(env.AUTH_ORIGIN+req.url,{method:req.method,headers:req.headers,...(chunks.length?{body:Buffer.concat(chunks)}:{})}),response=await app.portabilityRoute(env,request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()))}
   catch{res.writeHead(500);res.end()}
  });
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const origin='http://127.0.0.1:'+server.address().port;
  const settings={AUTH_LOCAL:'true',AUTH_ORIGIN:origin,OWNER_EMAIL:'owner@example.test',SESSION_SECRET:crypto.randomUUID()+crypto.randomUUID(),SETUP_TOKEN:crypto.randomUUID()+crypto.randomUUID(),MAIL_PROVIDER:'development',MAIL_FROM:'nook@localhost.test'};
  env={...proxy.env,...settings,CHAT_HUB:hub};
  const authRequest=(path,body,cookie)=>new Request(origin+path,{method:'POST',headers:{Host:new URL(origin).host,Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)});
  const boot=await app.authRoute(env,authRequest('/auth/bootstrap',{token:settings.SETUP_TOKEN,displayName:'Morgan'}));assert.equal(boot.status,303);
  let cookie=boot.headers.get('set-cookie').split(';')[0],c=await app.context(env,new Headers({Cookie:cookie,Host:new URL(origin).host}));const owner=c.uid;
  const channel=await app.write(c,'conversations','',{name:'Launch plans',kind:'channel'}),bytes=Buffer.from('Room booking and launch checklist\n'),file=await app.upload(c,channel.id,{name:'launch-notes.txt',mime:'text/plain',bytes,intent:'exit-file'});
  const message=await app.write(c,'messages',channel.id,{body:'The launch room is booked. Checklist attached.',attachments:[file.id],intent:'exit-message'});
  await app.write(c,'messages',channel.id,{body:'Meet in the launch room at ten.',parent:message.id,intent:'exit-thread'});
  const reminderDefinition={phrase:'me tomorrow at 9am to verify the room booking',zone:'America/New_York'};const reminderPreview=await app.reminderPreview(c,reminderDefinition);const reminder=await app.createReminder(c,{...reminderDefinition,confirmedDue:reminderPreview.due,intent:'exit-personal-reminder'});
  const scheduleFile=await app.upload(c,channel.id,{name:'weekly-prompt.txt',mime:'text/plain',bytes,intent:'exit-scheduled-file'});
  const scheduleTime=new Date(Date.now()+7200000).toISOString().slice(0,16);
  const schedule=await app.createSchedule(c,channel.id,{body:'Send the weekly room-booking prompt after review.',attachments:[scheduleFile.id],localAt:scheduleTime,zone:'UTC',recurrence:'weekly',endDate:new Date(Date.now()+21*86400000).toISOString().slice(0,10),intent:'export-schedule'});
  const snapshot=async()=>({messages:await app.read(c,'messages',channel.id),search:await app.read(c,'search','',{q:'room'}),replay:await app.read(c,'replay',channel.id,{after:0}),file:Buffer.from(await new Response((await app.download(c,file.id)).body).arrayBuffer())});
  const before=await snapshot();assert.ok(before.search.items.length);assert.deepEqual(before.file,bytes);
  assert.equal((await fetch(origin+'/api/portability/exports',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'})).status,401);
  const sessionFile=join(directory,'owner.session'),archive=join(directory,'workspace.rer');await writeFile(sessionFile,cookie,{mode:0o600});
  const exported=await remoteExport({root:source,path:archive,origin,sessionFile,store:{report:message=>assert.fail(message)}});
  assert.ok(exported.tables.some(t=>t.name==='nook_messages'&&t.count===2));
  assert.equal((await env.DB.prepare('SELECT count(*) AS n FROM rer_portability_segments').first()).n,0);
  await proxy.dispose();proxy=null;
  const started=Date.now(),imported=await transfer('import',archive,{root:fresh}),finished=Date.now();assert.equal(imported.contentHash,exported.contentHash);
  const sourceArchive=await archiveContent(archive);
  const folder=join(fresh,'.wrangler/state/v3/d1/miniflare-D1DatabaseObject'),database=join(folder,(await readdir(folder)).find(n=>n.endsWith('.sqlite')&&!n.startsWith('metadata')));
  await recoverNormalizedFixture(database,owner);proxy=await open(fresh);env={...proxy.env,...settings,CHAT_HUB:hub};
  const restoredAudit=(await env.DB.prepare('SELECT * FROM nook_audit').all()).results;
  for(const row of sourceArchive.audit)assert.deepEqual(restoredAudit.find(kept=>kept.id===row.id),row,'hosted archive retains every original audit row');
  const restoreEvents=restoredAudit.filter(row=>row.kind==='archive.import.complete');assert.equal(restoreEvents.length,1);
  assertRestoreAudit(restoreEvents[0],{manifest:sourceArchive.manifest,closing:sourceArchive.closing,actor:'direct',started,finished});
  // Use the real one-time owner confirmation door after offline identity recovery.
  const token=opaqueToken(),now=Date.now();await env.DB.prepare('INSERT INTO oa_owner_signins VALUES(?,?,?,?,?,?,NULL)').bind(crypto.randomUUID(),await ownerSigninDigest(token),owner,1,now,now+60_000).run();
  const confirmed=await app.authRoute(env,authRequest('/auth/owner-signin',{token}));assert.equal(confirmed.status,303);cookie=confirmed.headers.get('set-cookie').split(';')[0];c=await app.context(env,new Headers({Cookie:cookie,Host:new URL(origin).host}));
  assert.deepEqual(await snapshot(),before);
  const restoredSchedule=await env.DB.prepare('SELECT state,reason,payload FROM nook_schedules WHERE id=?').bind(schedule.id).first();
  const restoredReminder=await env.DB.prepare('SELECT state,text FROM nook_reminders WHERE id=?').bind(reminder.id).first();assert.equal(restoredReminder.state,'paused');assert.equal(restoredReminder.text,'verify the room booking');
  assert.equal(restoredSchedule.state,'paused');assert.match(restoredSchedule.reason,/review/i);assert.equal(JSON.parse(restoredSchedule.payload).body,'Send the weekly room-booking prompt after review.');
  const restoredTemplate=await env.DB.prepare('SELECT object_key FROM nook_schedule_files WHERE schedule=? AND attachment=?').bind(schedule.id,scheduleFile.id).first();assert.ok(restoredTemplate);assert.deepEqual(Buffer.from(await (await env.FILES.get(restoredTemplate.object_key)).arrayBuffer()),bytes);
  assert.equal((await env.DB.prepare('SELECT count(*) AS n FROM nook_schedule_occurrences').first()).n,0,'restore sends no old scheduled occurrence');
  assert.equal((await env.DB.prepare('SELECT count(*) AS n FROM oa_sessions').first()).n,1,'old sessions do not travel');
  await proxy.dispose();proxy=null;
  await localPersonaRestore({root,local,execute,t});
 }finally{if(server)await new Promise(ok=>server.close(ok));await proxy?.dispose();await rm(directory,{recursive:true,force:true})}
});

// The stopped local exporter is a different door from hosted download. Exercise
// the actual dev entry: local personas must keep their durable audience through
// credential exclusion, without allowing entry to undo an intentional revocation.
async function localPersonaRestore({root,local,execute,t}){
 const files=execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
 for(const file of files){const target=join(local,file);await mkdir(resolve(target,'..'),{recursive:true});await copyFile(join(root,file),target)}
 await symlink(join(root,'node_modules'),join(local,'node_modules'),'dir');
 const origin='http://127.0.0.1:'+await freePort(),settings={AUTH_LOCAL:'true',AUTH_ORIGIN:origin,OWNER_EMAIL:'synthetic-nook-owner@example.test',SESSION_SECRET:crypto.randomUUID()+crypto.randomUUID(),SETUP_TOKEN:crypto.randomUUID()+crypto.randomUUID(),MAIL_PROVIDER:'development',MAIL_FROM:'nook@localhost.test',RER_DEV_KEY:devKey};
 await writeFile(join(local,'.dev.vars'),Object.entries(settings).map(([k,v])=>k+'='+v).join('\n')+'\n',{mode:0o600});
 // Reuse the stopped, migrated empty fixture, as in the hosted leg above.
 // Each import still gets an independent empty database, never source data.
 const empty=join(local,'empty-state');await cp(join(local,'.wrangler/state'),empty,{recursive:true});
 const environment={...process.env,CI:'true',WRANGLER_SEND_METRICS:'false',RER_DEV_KEY:devKey,RER_DEV_ORIGIN:origin};
 let worker,closed;
 async function start(){
  worker=spawn(process.execPath,[join(root,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port',new URL(origin).port,'--strictPort'],{cwd:local,env:environment,stdio:'ignore'});
  closed=new Promise(ok=>worker.once('close',ok));
  for(let attempt=0;attempt<600;attempt++){
   assert.equal(worker.exitCode,null,'local dev worker stays running');
   try{if((await fetch(origin+'/health')).status===200)return}catch{}
   await new Promise(ok=>setTimeout(ok,100));
  }
  throw Error('Local dev worker did not become ready');
 }
 async function stop(){if(!worker)return;if(worker.exitCode===null)worker.kill('SIGTERM');await closed;worker=null}
 async function call(path,{cookie='',body,status=200,method=body?'POST':'GET'}={}){
  const response=await fetch(origin+path,{method,redirect:'manual',headers:{origin,'x-rer-dev-key':devKey,...(cookie?{cookie}:{}),...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  assert.equal(response.status,status,method+' '+path);return response;
 }
 const json=async(path,options)=>(await call(path,options)).json();
 async function enter(as,status=303){const response=await call('/auth/dev/enter?as='+as,{status});return response.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ')}
 async function database(){const directory=join(local,'.wrangler/state/v3/d1/miniflare-D1DatabaseObject');for(const file of await readdir(directory)){if(!file.endsWith('.sqlite'))continue;const path=join(directory,file),db=new DatabaseSync(path,{readOnly:true});try{if(db.prepare("SELECT name FROM sqlite_master WHERE name='nook_actors'").get())return path}finally{db.close()}}throw Error('Normalized D1 binding missing')}
 const sorted=rows=>rows.map(row=>Object.fromEntries(Object.entries(row).sort(([a],[b])=>a.localeCompare(b)))).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
 async function snapshot(){const db=new DatabaseSync(await database(),{readOnly:true});try{return Object.fromEntries(['oa_operators','oa_sessions','nook_actors','nook_access','nook_members','nook_dm_roster','nook_attention'].map(table=>[table,sorted(db.prepare('SELECT * FROM '+table).all())]))}finally{db.close()}}
 const durable=snapshot=>Object.fromEntries(Object.entries(snapshot).filter(([table])=>!table.startsWith('oa_')));
 try{
  await start();
  const boot=await call('/auth/bootstrap',{body:{token:settings.SETUP_TOKEN,displayName:'Synthetic owner'},status:303});
  const ownerCookie=boot.headers.getSetCookie().map(value=>value.split(';')[0]).join('; '),owner=await json('/api/me',{cookie:ownerCookie});
  const memberCookie=await enter('member'),member=await json('/api/me',{cookie:memberCookie});
  const phases=[],witness=(phase,snapshot)=>phases.push({phase,auth:snapshot.oa_operators.find(row=>row.id===member.id)?.status??'excluded',actor:snapshot.nook_actors.find(row=>row.id===member.id).active,admission:snapshot.nook_access.find(row=>row.user===member.id).active,memberships:snapshot.nook_members.filter(row=>row.user===member.id).length,attention:snapshot.nook_attention.filter(row=>row.user===member.id).length,dmRoster:snapshot.nook_dm_roster.length,actors:snapshot.nook_actors.length,sessions:snapshot.oa_sessions.length});
  const create=(name,kind,participants=[])=>json('/api/conversations',{cookie:ownerCookie,body:{name,kind,participants}});
  const publicRoom=await create('Synthetic restore public','channel'),privateRoom=await create('Synthetic restore private','private'),dm=await create('Synthetic restore DM','dm',[member.id]),unjoined=await create('Synthetic nonmember','private');
  for(const room of [publicRoom,privateRoom])await json('/api/conversations/'+room.id+'/members',{cookie:ownerCookie,body:{user:member.id}});
  for(const room of [publicRoom,dm])await json('/api/conversations/'+room.id+'/messages',{cookie:ownerCookie,body:{body:'Synthetic restore Attention',mentions:room===publicRoom?[member.id]:[],intent:crypto.randomUUID()}});
  const rooms=[publicRoom,privateRoom,dm],visible=async cookie=>{
   // observedAt is this request's clock, not stored Attention or attribution.
   const {observedAt,...attention}=await json('/api/attention',{cookie});assert.ok(Number.isSafeInteger(observedAt));
   return {conversations:await json('/api/conversations',{cookie}),attention,messages:await Promise.all(rooms.map(room=>json('/api/conversations/'+room.id+'/messages',{cookie})))};
  };
  const beforeVisible=await visible(memberCookie);await stop();const before=await snapshot();
  witness('before-export',before);
  assert.equal(before.nook_actors.length,2);assert.equal(before.nook_members.filter(row=>row.user===member.id).length,3);assert.equal(before.nook_attention.filter(row=>row.user===member.id).length,2);
  const archive=join(local,'exports/personas.rer');
  // Use the documented CLI and its seed-owned adapter, not a service-only export.
  const run=async args=>execute(process.execPath,[join(root,'node_modules/@runeditrun/rer/bin/rer.mjs'),...args,'--json'],{cwd:local,env:environment,maxBuffer:8*1024*1024});
  await run(['export','--output',archive]);const afterExport=await snapshot();
  witness('source-after-export',afterExport);
  assert.ok(JSON.stringify(afterExport)===JSON.stringify(before),'export leaves source credentials, actors, admissions and memberships intact');
  const archiveRows=(await readFile(archive,'utf8')).trim().split('\n').map(line=>JSON.parse(line)).flatMap(record=>record.items??[]).filter(item=>item.kind==='row');
  assert.ok(archiveRows.every(item=>!item.table.startsWith('oa_')),'no source credentials or sessions in the archive');
  const archived=Object.fromEntries(Object.keys(before).map(table=>[table,sorted(archiveRows.filter(item=>item.table===table).map(item=>item.row))]));witness('archive',archived);
  for(const [table,rows]of Object.entries(durable(before)))assert.deepEqual(archived[table],rows,table+' is preserved in the archive');
  const state=join(local,'.wrangler/state');await rename(state,join(local,'source-state'));
  await cp(empty,state,{recursive:true});
  await run(['import','--input',archive,'--yes']);const imported=await snapshot();
  witness('after-import',imported);
  assert.equal(imported.oa_operators.length,0);assert.equal(imported.oa_sessions.length,0);assert.deepEqual(durable(imported),durable(before));
  await start();
  await call('/api/me',{cookie:memberCookie,status:401});await call('/api/attention',{status:401});
  await call('/auth/dev/enter?as=member',{status:409});
  await call('/auth/dev/enter?as=owner',{status:409});
  assert.equal((await fetch(origin+'/auth/dev/enter?as=member',{redirect:'manual'})).status,404,'keyless local entry stays hidden');
  await call('/auth/bootstrap',{body:{token:settings.SETUP_TOKEN,displayName:'Unrelated owner'},status:409});await stop();
  assert.deepEqual(await snapshot(),imported,'premature claims and persona entry create no identity or session');
  // OPERATIONS.md: SQLite backup, complete explicit mapping, new recovered file,
  // then replacement at the original binding path with its WAL preserved.
  const path=await database(),source=join(local,'identity-source.sqlite'),target=join(local,'identity-recovered.sqlite'),db=new DatabaseSync(path,{readOnly:true});
  try{await backup(db,source)}finally{db.close()}
  const mapping={owner:owner.id,users:before.nook_actors.map(actor=>({id:actor.id,email:actor.email,role:actor.role}))};
  assert.deepEqual(await recoverNormalized(source,target,mapping),{ok:true,users:2,sessions:0});
  await rename(path,path+'.imported');for(const suffix of ['-wal','-shm'])try{await rename(path+suffix,path+'.imported'+suffix)}catch(error){if(error.code!=='ENOENT')throw error}await copyFile(target,path);
  const mapped=await snapshot();assert.deepEqual(durable(mapped),durable(before));assert.equal(mapped.oa_sessions.length,0);assert.deepEqual(mapped.oa_operators.map(row=>row.id).sort(),before.oa_operators.map(row=>row.id).sort());
  witness('after-explicit-mapping',mapped);
  await start();const restoredOwner=await enter('owner'),restoredMember=await enter('member');
  assert.equal((await json('/api/me',{cookie:restoredMember})).id,member.id);assert.deepEqual(await visible(restoredMember),beforeVisible);
  await call('/api/me',{cookie:memberCookie,status:401});await call('/api/conversations/'+unjoined.id+'/messages',{cookie:restoredMember,status:403});
  for(const room of rooms)await call('/api/conversations/'+room.id+'/messages',{status:401});
  await call('/api/conversations/'+privateRoom.id+'/members',{cookie:restoredOwner,body:{user:member.id,remove:true}});
  await enter('member');await call('/api/conversations/'+privateRoom.id+'/messages',{cookie:restoredMember,status:403});
  await call('/auth/operator/status',{cookie:restoredOwner,body:{operatorId:member.id,status:'inactive'}});
  await call('/auth/session',{cookie:restoredMember,status:401});await enter('member',403);await stop();
  const revoked=await snapshot();assert.equal(revoked.oa_operators.find(row=>row.id===member.id).status,'inactive');assert.equal(revoked.nook_actors.find(row=>row.id===member.id).active,0);assert.equal(revoked.nook_access.find(row=>row.user===member.id).active,0);assert.equal(revoked.nook_members.filter(row=>row.user===member.id).length,0);assert.equal(revoked.nook_dm_roster.length,2);assert.equal(revoked.nook_actors.length,2);
  witness('intentional-deactivation',revoked);
  const inactiveArchive=join(local,'exports/inactive.rer');await run(['export','--output',inactiveArchive]);await rename(state,join(local,'revoked-state'));await cp(empty,state,{recursive:true});await run(['import','--input',inactiveArchive,'--yes']);
  const inactive=await snapshot();assert.equal(inactive.oa_operators.length,0);assert.deepEqual(durable(inactive),durable(revoked));
  const inactivePath=await database(),inactiveTarget=join(local,'inactive-recovered.sqlite');await recoverNormalized(inactivePath,inactiveTarget,mapping);const inactiveDB=new DatabaseSync(inactiveTarget,{readOnly:true});try{assert.equal(inactiveDB.prepare('SELECT status FROM oa_operators WHERE id=?').get(member.id).status,'inactive');assert.equal(inactiveDB.prepare('SELECT count(*) AS n FROM nook_members WHERE user=?').get(member.id).n,0)}finally{inactiveDB.close()}
  await rename(inactivePath,inactivePath+'.imported');for(const suffix of ['-wal','-shm'])try{await rename(inactivePath+suffix,inactivePath+'.imported'+suffix)}catch(error){if(error.code!=='ENOENT')throw error}await copyFile(inactiveTarget,inactivePath);
  await start();await enter('member',403);await call('/api/me',{cookie:restoredMember,status:401});await stop();witness('inactive-after-recovery',await snapshot());
  t.diagnostic('RESTORE witnesses '+JSON.stringify(phases));
  t.diagnostic('RESTORE local personas: 2 actors; member memberships 3 -> 3, Attention 2 -> 2 and DM roster 2 -> 2 through export/import/explicit mapping; source unchanged; credentials/sessions excluded; unmapped/old-session/unauthenticated 401, premature claim/entry 409, nonmember/revoked membership 403, inactive dev entry 403; intentional deactivation and inactive re-export/recovery retained.');
 }finally{await stop()}
}
