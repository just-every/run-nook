import assert from 'node:assert/strict';
import {execFile,execFileSync,spawn} from 'node:child_process';
import {copyFile,mkdir,mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {createServer} from 'node:net';
import {tmpdir} from 'node:os';
import {dirname,join} from 'node:path';
import {promisify} from 'node:util';
import {DatabaseSync} from 'node:sqlite';
const execute=promisify(execFile);
const freePort=()=>new Promise((resolve,reject)=>{const server=createServer();server.once('error',reject);server.listen(0,'127.0.0.1',()=>{const {port}=server.address();server.close(()=>resolve(port));});});
// A fresh local install of this working tree (uncommitted changes included):
// real rer setup, rer dev --login (the development outbox is the only mail edge),
// stop and start again, and the installation's own local D1 for the journey's
// fault and its read of the outbox.
export async function notifyInstallation(root){
 const directory=await mkdtemp(join(tmpdir(),'nook-notify-'));
 const {RER_LOCAL_OPERATION:ignored,...env}={...process.env,CI:'true',WRANGLER_SEND_METRICS:'false',RER_SERVER_JOURNEY:'1'};
 let dev;
 const run=async(verb,...args)=>{
  try{return (await execute(process.execPath,['scripts/rer.mjs',verb,...args],{cwd:directory,env,timeout:20*60_000,maxBuffer:8*1024*1024})).stdout;}
  catch(error){throw Error(`rer ${verb} failed (exit ${error.code ?? 'unknown'}); CLI output withheld because it can contain sign-in credentials.`);}
 };
 const stop=async()=>{
  if(!dev||dev.exitCode!==null||dev.signalCode!==null)return;
  try{await run('dev','--stop');}catch{try{process.kill(-dev.pid,'SIGTERM');}catch{}}
  if(dev.exitCode===null&&dev.signalCode===null)await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('dev did not stop')),30_000);dev.once('exit',()=>{clearTimeout(timer);resolve();});});
 };
 let origin;
 const start=async()=>{
  dev=spawn(process.execPath,['scripts/rer.mjs','dev','--login'],{cwd:directory,env,stdio:['ignore','pipe','pipe'],detached:true});
  let output='';dev.stdout.on('data',chunk=>{output+=chunk;});dev.stderr.on('data',chunk=>{output+=chunk;});
  await new Promise((resolve,reject)=>{const deadline=Date.now()+10*60_000;const timer=setInterval(()=>{if(output.includes(`RER_READY ${origin}`)){clearInterval(timer);resolve();}else if(dev.exitCode!==null||Date.now()>deadline){clearInterval(timer);reject(Error('dev did not become ready; credential-bearing output withheld'));}},200);});
 };
 try{
  execFileSync('git',['clone','--quiet','--no-hardlinks',root,directory],{stdio:'pipe'});
  const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
  for(const file of files){await mkdir(dirname(join(directory,file)),{recursive:true});await copyFile(join(root,file),join(directory,file)).catch(error=>{if(error.code!=='ENOENT')throw error;});}
  await run('install');
  const port=await freePort();origin=`http://127.0.0.1:${port}`;
  assert.ok((await run('setup','--owner-email','sam@example.test','--owner-name','Sam','--port',String(port))).includes('RER_SETUP_READY'));
  await start();
  const key=/^RER_DEV_KEY=(\S+)$/m.exec(await readFile(join(directory,'.rer/local/dev-key.env'),'utf8'))?.[1];assert.ok(key);
  const folder=join(directory,'.wrangler/state/v3/d1/miniflare-D1DatabaseObject'),database=join(folder,(await readdir(folder)).find(name=>name.endsWith('.sqlite')&&name!=='metadata.sqlite'));
  // Writes go through Wrangler's local D1 door, as the runtime suite's do.
  const sql=async statement=>{await execute(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--persist-to','.wrangler/state','--config','wrangler.jsonc','--command',statement],{cwd:directory,env,timeout:120_000});};
  const read=(statement,...values)=>{const db=new DatabaseSync(database,{readOnly:true});try{return db.prepare(statement).all(...values);}finally{db.close();}};
  const outbox=()=>read('SELECT message FROM rer_mail_development_outbox ORDER BY sequence').map(row=>JSON.parse(row.message));
  return {origin,key,directory,sql,read,outbox,start,stop,close:async()=>{await stop();await rm(directory,{recursive:true,force:true});}};
 }catch(error){
  try{await stop();}finally{if(dev&&dev.exitCode===null&&dev.signalCode===null){try{process.kill(-dev.pid,'SIGTERM');}catch{}}await rm(directory,{recursive:true,force:true});}
  throw error;
 }
}
