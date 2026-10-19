import {installDependencies} from './install-dependencies.mjs'
import assert from 'node:assert/strict'
import {execFileSync,spawn} from 'node:child_process'
import {mkdtemp,readFile,mkdir,rm,rename,appendFile,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {resolve,dirname} from 'node:path'
import {pathToFileURL} from 'node:url'
import {DatabaseSync} from 'node:sqlite'
import {released} from './worker-ports.mjs'
import {approveInstaller,launchInstaller} from './installer-approval.mjs'
import {devKey} from './dev-key.mjs'
import {copyWorkingTree} from './working-tree-copy.mjs'
// A setup rerun may refresh local identity credentials; product
// rows, people, sessions and the owner claim must not change.
function workspaceSnapshot(path){const db=new DatabaseSync(path,{readOnly:true});try{const names=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND (name LIKE 'nook_%' OR name IN ('oa_operators','oa_sessions','oa_bootstrap')) AND name NOT LIKE 'nook_search%' ORDER BY name").all().map(row=>row.name);return JSON.stringify(names.map(name=>[name,db.prepare('SELECT * FROM '+name).all().map(row=>JSON.stringify(row)).sort()]))}finally{db.close()}}
export async function runInstallerWorkflow(h){
 const {root,states,port,check,evidence,databasePath,stop}=h
 // The guided installer runs in a fresh clone, never over this checkout's own state;
 // install its locked package tools before opening the guided installer.
 const {RER_LOCAL_OPERATION:_,...baseEnv}=h.env,env={...baseEnv,RER_SERVER_JOURNEY:'1'}
 let app
 let state=h.getState(),origin=h.getOrigin(),guidedPort
 // The restarted clone uses the test provider edge and its own ordinary local identity key.
 async function start(port){h.setState(state);const vars=resolve(app,'.dev.vars');if(!(await readFile(vars,'utf8')).includes('RER_DEV_KEY='))await appendFile(vars,`RER_DEV_KEY=${devKey}\n`);await h.start(guidedPort??port,{envFile:resolve(app,'.dev.vars')});origin=h.getOrigin()}
 await check('guided Base installer → two-user full HTTP workflow → populated guided rerun/restart/archive/restore',async()=>{
  const {runWorkflow,verifyWorkflow,workflowReport}=await import(pathToFileURL(resolve(root,'scripts/workflow-proof.mjs')))
  app=await mkdtemp(resolve(tmpdir(),'nook-guided-'));execFileSync('git',['clone','--quiet','--no-hardlinks',root,app]);await copyWorkingTree(root,app)
  // `rer setup` writes the checkout's dev key before anything starts; the guided installer only reads it, so the clone gets the harness's key the same way.
  await mkdir(resolve(app,'.rer/local'),{recursive:true,mode:0o700});await writeFile(resolve(app,'.rer/local/dev-key.env'),`RER_DEV_KEY=${devKey}\n`,{mode:0o600})
  const localState=resolve(app,'.wrangler/state'),branding=await readFile(resolve(app,'src/branding.json'));
  await stop();state=localState;states.push(state)
  let installer
  try {
   await installDependencies(app,env)
   installer=await launchInstaller(app,['--port',String(port),'--no-prefill'],env)
   const original=JSON.parse(branding);const input={WORKSPACE_NAME:original.name,PRIMARY_COLOR:original.primaryColor,OWNER_EMAIL:'nativeowner@example.test',displayName:'NativeOwner',MAIL_PROVIDER:'development',MAIL_FROM:'auth@localhost.test',IDENTITY_PROVIDER:''}
   const held=await mkdtemp(resolve(tmpdir(),'nook-build-repair-'));states.push(held);const entry=resolve(app,'src/server.ts'),preserved=resolve(held,'server.ts');
   await rename(entry,preserved);let failed;try{failed=await approveInstaller(installer,input,{phase:'failed'})}finally{await rename(preserved,entry)}
   assert.equal(failed.appUrl,undefined,'failed build starts no application');await installer.close();installer=undefined;
   installer=await launchInstaller(app,['--port',String(port),'--resume'],env);assert.deepEqual((await installer.state()).draft,input,'failed attempt keeps approved answers');
   origin=await approveInstaller(installer,input);guidedPort=Number(new URL(origin).port)
   // Setup satisfies every local input; owner-account deploy inputs come only from the shell.
   const deployInputs={CLOUDFLARE_ACCOUNT_ID:'a'.repeat(32),CLOUDFLARE_API_TOKEN:'test-only-token',SESSION_SECRET:'test-only-production-session-secret',SETUP_TOKEN:'test-only-production-setup-token',OWNER_EMAIL:'nativeowner@example.test',MAIL_FROM:'auth@example.test',SENDGRID_API_KEY:'test-only-sendgrid-key'}
   const diagnostic=await new Promise((ok,bad)=>{const child=spawn(process.execPath,['node_modules/@runeditrun/rer/bin/rer.mjs','doctor','--json'],{cwd:app,env:{...env,...deployInputs},stdio:['ignore','pipe','pipe']});let text='';child.stdout.on('data',value=>text+=value);child.stderr.on('data',()=>{});child.once('error',bad);child.once('close',code=>code===0?ok(text):bad(Error('Installed public diagnostics failed: '+text))) });const diagnosticResult=diagnostic.trim().split('\n').map(line=>JSON.parse(line)).find(event=>event.event==='result');assert.equal(diagnosticResult.diagnostics.ok,true);assert.deepEqual(diagnosticResult.diagnostics.missingInputs,[]);
   const phase=(await installer.state()).phase;await installer.close();installer=undefined;await released(guidedPort);await start(port)
   const proof=await runWorkflow(origin);const initial=await verifyWorkflow(origin,proof)
   const guide={failureThenResume:true,oneApprovalPerAttempt:true,providers:false,phase,branding:input,appPort:Number(new URL(origin).port)}
   await stop()
   const persisted=await databasePath(state),beforeBuild=await readFile(persisted)
   await new Promise((ok,bad)=>{const child=spawn(process.execPath,['node_modules/vite/bin/vite.js','build'],{cwd:app,env,stdio:'inherit'});child.once('error',bad);child.once('exit',code=>code===0?ok():bad(Error('Populated rebuild failed')))})
   assert.deepEqual(await readFile(persisted),beforeBuild,'rebuilding preserves existing D1 bytes')
   const beforeRerun=workspaceSnapshot(persisted)
   installer=await launchInstaller(app,['--port',String(port),'--resume'],env)
   assert.deepEqual((await installer.state()).draft,input,'the second wizard retains the approved setup')
   origin=await approveInstaller(installer,input)
   await installer.close();installer=undefined;await released(guidedPort);await start(port)
   const reinstalled=await verifyWorkflow(origin,proof,{preservedSessions:true});await stop()
   assert.equal(await databasePath(state),persisted,'the second installation uses the populated D1 store')
   assert.ok(workspaceSnapshot(persisted)===beforeRerun,'guided reinstall preserves every workspace row, user, owner, session and private byte without writes')
   await start(port);const restarted=await verifyWorkflow(origin,proof);await stop()
   const portable=await (await import('./runtime-portability.mjs')).runPortabilityWorkflow({root:app,state,states,proof,ownerEmail:input.OWNER_EMAIL,databasePath,command:h.command,start,stop,verify:()=>verifyWorkflow(origin,proof,{sessionsExcluded:true})})
   evidence.guidedWorkflow={...workflowReport(proof),guide,initial,portable,reinstalled:{...reinstalled,secondApproval:true,sameD1:true,completeWorkspacePreserved:true,originalSessionsValid:true},restarted,restored:portable,normalizedStorage:true}
  } finally {await installer?.close();await stop();await rm(app,{recursive:true,force:true})}
 })

 h.setState(state)
}
