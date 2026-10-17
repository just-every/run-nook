import {installDependencies} from '../install-dependencies.mjs';
import assert from 'node:assert/strict';
import {execFile,execFileSync,spawn} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {createServer} from 'node:net';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {promisify} from 'node:util';
import {pilotPhase} from './progress.mjs';
import {copyWorkingTree} from '../working-tree-copy.mjs';

const execute=promisify(execFile);
const freePort=()=>new Promise((resolve,reject)=>{const server=createServer();server.once('error',reject);server.listen(0,'127.0.0.1',()=>{const {port}=server.address();server.close(()=>resolve(port));});});

// Source is copied from this working tree, including intentional uncommitted
// changes. The install has its own dependencies, settings, database and R2.
export async function pilotInstallation(root){
 const directory=await mkdtemp(join(tmpdir(),'nook-pilot-'));
 const {RER_LOCAL_OPERATION:ignored,...env}={...process.env,CI:'true',WRANGLER_SEND_METRICS:'false',RER_SERVER_JOURNEY:'1'};
 let dev;
 const run=async(verb,...args)=>{
  try{return (await execute(process.execPath,['node_modules/@runeditrun/rer/global/rer.mjs',verb,...args,...(['export','import','reset'].includes(verb)?['--json']:[])],{cwd:directory,env,timeout:20*60_000,maxBuffer:8*1024*1024})).stdout;}
  catch(error){
   const pending=String(error.stdout??'').includes('(reconcile_pending_object_work_before_export)')||String(error.stderr??'').includes('(reconcile_pending_object_work_before_export)');
   const events=String(error.stdout??'').split('\n').flatMap(line=>{try{return [JSON.parse(line)];}catch{return [];}});
   const failure=events.find(event=>event.event==='error');
   const code=typeof failure?.code==='string'&&/^[a-z][a-z0-9_]{0,80}$/.test(failure.code)?failure.code:undefined;
   // Nook's transfer adapter puts only its machine reason in these parentheses.
   // Report that reason and the CLI code, never raw messages, links or settings.
   const reason=code==='transfer_refused'?/\(([a-z][a-z0-9_]{0,80})\)\.$/.exec(failure.message??'')?.[1]:undefined;
   throw Error(`Pilot rer ${verb} failed (exit ${error.code ?? 'unknown'}${code?'; '+code:''}${reason?'; '+reason:''}${pending?'; reconcile_pending_object_work_before_export':''}); credential-bearing CLI output withheld.`);
  }
 };
 const stop=async()=>{
  if(!dev||dev.exitCode!==null||dev.signalCode!==null)return;
  // Stop only this pilot's own dev process group; `rer dev --stop` reaches other runs on a shared machine.
  try{process.kill(-dev.pid,'SIGTERM');}catch{}
  if(dev.exitCode===null&&dev.signalCode===null)await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Pilot dev did not stop')),30_000);dev.once('exit',()=>{clearTimeout(timer);resolve();});});
 };
 try{
  execFileSync('git',['clone','--quiet','--no-hardlinks',root,directory],{stdio:'pipe'});
  await copyWorkingTree(root,directory);
  console.log('PILOT installing isolated working-tree copy');await installDependencies(directory,env);
  const port=await freePort(),origin=`http://127.0.0.1:${port}`;
  console.log('PILOT running real rer setup');const setupOutput=await run('setup','--owner-email','pilot-owner@example.test','--owner-name','Pilot owner','--port',String(port));assert.ok(setupOutput.includes('RER_SETUP_READY'),'rer setup reported ready');
  dev=spawn(process.execPath,['node_modules/@runeditrun/rer/global/rer.mjs','dev','--foreground','--login'],{cwd:directory,env,stdio:['ignore','pipe','pipe'],detached:true});
  let output='';dev.stdout.on('data',chunk=>{output+=chunk;});dev.stderr.on('data',chunk=>{output+=chunk;});
  await new Promise((resolve,reject)=>{const deadline=Date.now()+10*60_000;const timer=setInterval(()=>{if(output.includes(`RER_READY ${origin}`)&&/RER_OPEN (http:\/\/\S+)/.test(output)){clearInterval(timer);resolve();}else if(dev.exitCode!==null||Date.now()>deadline){clearInterval(timer);reject(Error('Pilot dev did not become ready; credential-bearing output withheld'));}},200);});
  const open=/RER_OPEN (http:\/\/\S+)/.exec(output)?.[1];
  assert.ok(open,'rer dev --login opens the local owner identity');
  const key=/^RER_DEV_KEY=(\S+)$/m.exec(await readFile(join(directory,'.rer/local/dev-key.env'),'utf8'))?.[1];
  assert.ok(key,'fresh setup created its local identity key');
  return {origin,open,key,run,stop,directory,close:async()=>{await stop();await rm(directory,{recursive:true,force:true});}};
 }catch(error){
  try{await stop();}finally{if(dev&&dev.exitCode===null&&dev.signalCode===null){try{process.kill(-dev.pid,'SIGTERM');}catch{}}await rm(directory,{recursive:true,force:true});}
  throw error;
 }
}

export async function roundTrip(installation){
 const step=async(phase,action)=>{const started=Date.now();pilotPhase(`${phase}-start`);await action();pilotPhase(`${phase}-complete`,{elapsedSeconds:Math.round((Date.now()-started)/1000)});};
 await installation.stop();
 await step('restore-export',()=>installation.run('export','--output','exports/pilot.rer'));
 await step('restore-reset',()=>installation.run('reset','--yes'));
 await step('restore-import',()=>installation.run('import','--input','exports/pilot.rer','--yes'));
 await step('restore-reexport',()=>installation.run('export','--output','exports/pilot-restored.rer'));
 const digest=async name=>JSON.parse((await readFile(join(installation.directory,'exports',name),'utf8')).trim().split('\n').at(-1)).contentHash;
 const before=await digest('pilot.rer'),after=await digest('pilot-restored.rer');
 assert.ok(before,'export carries a content hash');assert.equal(after,before,'fresh empty restore reexports identical private data and media');
 pilotPhase('restore-identical-content-complete');
 return {commands:['rer export','rer reset --yes','rer import --yes','rer export'],contentHash:after,identical:true};
}
