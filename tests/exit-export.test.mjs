import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,mkdir,writeFile,readdir,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createRequire} from 'node:module';
import {getPlatformProxy} from 'wrangler';
import {remoteExport} from '../scripts/local/remote-export.mjs';
import {transfer} from '../scripts/local/transfer.mjs';
import {recoverNormalizedFixture} from './recovery-support.mjs';
import {opaqueToken} from '../src/base/modules/operator-auth/crypto.mjs';
import {ownerSigninDigest} from '../src/base/modules/operator-auth/owner-signin-grant.mjs';

// One public hosted-export -> offline import journey. D1 and R2 are real local
// Cloudflare bindings. No application, archive, search or file implementation is replaced.
test('an owner can export a hosted workspace and restore messages, files, search and replay into a fresh installation',{timeout:120_000},async()=>{
 const directory=await mkdtemp(join(tmpdir(),'nook-exit-')),execute=promisify(execFile),root=process.cwd();
 let proxy,server;
 try{
  const require=createRequire(import.meta.url),{build}=createRequire(require.resolve('wrangler'))('esbuild'),bundle=join(directory,'routes.mjs');
  await build({stdin:{contents:"export {portabilityRoute} from './src/platform/portability.server';export {authRoute} from './src/platform/operator-auth.server';export {context} from './src/platform/storage/context';export {write} from './src/platform/storage/commands';export {read} from './src/platform/storage/read';export {upload,download} from './src/platform/storage/files'",resolveDir:root},bundle:true,platform:'node',format:'esm',outfile:bundle,logLevel:'silent'});
  const app=await import(bundle);
  async function installation(name){
   const path=join(directory,name);await mkdir(path);await symlink(join(root,'migrations'),join(path,'migrations'));
   await writeFile(join(path,'wrangler.jsonc'),JSON.stringify({name:'nook-exit',compatibility_date:'2026-09-08',d1_databases:[{binding:'DB',database_name:'nook-exit',database_id:'00000000-0000-0000-0000-000000000001',migrations_dir:'migrations'}],r2_buckets:[{binding:'FILES',bucket_name:'nook-exit-files'}]}));
   await execute(process.execPath,[resolve('node_modules/wrangler/bin/wrangler.js'),'d1','migrations','apply','DB','--local','--config',join(path,'wrangler.jsonc'),'--persist-to',join(path,'.wrangler/state')],{env:{...process.env,CI:'true',WRANGLER_SEND_METRICS:'false'},maxBuffer:4*1024*1024});return path;
  }
  async function open(path){return getPlatformProxy({configPath:join(path,'wrangler.jsonc'),persist:{path:join(path,'.wrangler/state/v3')},remoteBindings:false})}
  const source=await installation('source');proxy=await open(source);
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
  const snapshot=async()=>({messages:await app.read(c,'messages',channel.id),search:await app.read(c,'search','',{q:'room'}),replay:await app.read(c,'replay',channel.id,{after:0}),file:Buffer.from(await new Response((await app.download(c,file.id)).body).arrayBuffer())});
  const before=await snapshot();assert.ok(before.search.items.length);assert.deepEqual(before.file,bytes);
  assert.equal((await fetch(origin+'/api/portability/exports',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'})).status,401);
  const sessionFile=join(directory,'owner.session'),archive=join(directory,'workspace.rer');await writeFile(sessionFile,cookie,{mode:0o600});
  const exported=await remoteExport({root:source,path:archive,origin,sessionFile,store:{report:message=>assert.fail(message)}});
  assert.ok(exported.tables.some(t=>t.name==='nook_messages'&&t.count===2));
  assert.equal((await env.DB.prepare('SELECT count(*) AS n FROM rer_portability_segments').first()).n,0);
  await proxy.dispose();proxy=null;
  const fresh=await installation('fresh'),imported=await transfer('import',archive,{root:fresh});assert.equal(imported.contentHash,exported.contentHash);
  const folder=join(fresh,'.wrangler/state/v3/d1/miniflare-D1DatabaseObject'),database=join(folder,(await readdir(folder)).find(n=>n.endsWith('.sqlite')&&!n.startsWith('metadata')));
  await recoverNormalizedFixture(database,owner);proxy=await open(fresh);env={...proxy.env,...settings,CHAT_HUB:hub};
  // Use the real one-time owner confirmation door after offline identity recovery.
  const token=opaqueToken(),now=Date.now();await env.DB.prepare('INSERT INTO oa_owner_signins VALUES(?,?,?,?,?,?,NULL)').bind(crypto.randomUUID(),await ownerSigninDigest(token),owner,1,now,now+60_000).run();
  const confirmed=await app.authRoute(env,authRequest('/auth/owner-signin',{token}));assert.equal(confirmed.status,303);cookie=confirmed.headers.get('set-cookie').split(';')[0];c=await app.context(env,new Headers({Cookie:cookie,Host:new URL(origin).host}));
  assert.deepEqual(await snapshot(),before);
  assert.equal((await env.DB.prepare('SELECT count(*) AS n FROM oa_sessions').first()).n,1,'old sessions do not travel');
 }finally{if(server)await new Promise(ok=>server.close(ok));await proxy?.dispose();await rm(directory,{recursive:true,force:true})}
});
