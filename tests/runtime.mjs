import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { request as httpRequest } from 'node:http'
import {freePort,released} from './worker-ports.mjs'
import { mkdtemp,readFile,readdir,writeFile,mkdir,rm,realpath,access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, dirname } from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { createHash,scryptSync } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import {signIn,invite} from './auth-support.mjs'
import {devKey} from './dev-key.mjs'
import {workerEnvironment} from './worker-environment.mjs'

const withoutBrowser=process.argv.includes('--without-browser');
const root = process.cwd();let state = await mkdtemp(resolve(tmpdir(),'team-chat-d1-'));const states=[state]
const env = {...process.env,WRANGLER_LOG_PATH:resolve(state,'wrangler.log'),WRANGLER_SEND_METRICS:'false',X_LOCAL_EXPLORER:'false',CI:'true'}
const cli = ['node_modules/wrangler/bin/wrangler.js']
// Resolve public decoder APIs through the exact installed Start package graph.
const startRequire = createRequire(await realpath(resolve(root,'node_modules/@tanstack/react-start/package.json')))
const corePackage = startRequire.resolve('@tanstack/start-client-core/package.json')
const coreRequire = createRequire(corePackage)
const {fromCrossJSON} = coreRequire('seroval')
const routerPackage = coreRequire.resolve('@tanstack/router-core/package.json')
const routerMetadata = JSON.parse(await readFile(routerPackage,'utf8'))
const {defaultSerovalPlugins} = await import(pathToFileURL(resolve(dirname(routerPackage),routerMetadata.exports['.'].import.default)))
let worker,output = '',origin,checks = 0,bootstrapCookie,lossConfig
const sessionSecret=crypto.randomUUID()+crypto.randomUUID(),setupToken=crypto.randomUUID()+crypto.randomUUID()
const evidence = {clause:'BASE-ACCESS-002',runtime:'emitted Worker with local D1',wire:'parameterless GET; x-tsr-serverFn=true; same-origin; identical headers and URL for all session controls',matrix:[],checks:[]}
const command = args => new Promise((ok,bad) => { const p=spawn(process.execPath,[...cli,...args],{cwd:root,env,stdio:['ignore','pipe','pipe']}); let out=''; p.stdout.on('data',c=>out+=c); p.stderr.on('data',c=>out+=c); p.on('error',bad); p.on('exit',code=>code===0?ok(out):bad(new Error(out))) })
const sql = async statement => JSON.parse(await command(['d1','execute','DB','--local','--persist-to',state,'--config','dist/server/wrangler.json','--command',statement,'--json']))[0].results
const facts = async () => (await sql("SELECT (SELECT count(*) FROM nook_events) AS events,(SELECT count(*) FROM nook_messages) AS messages,(SELECT count(*) FROM nook_attachments) AS attachments"))[0]
async function start(port,{envFile}={}) {
 await released(port)
 origin=`http://127.0.0.1:${port}`; output=''
 await writeFile(resolve(state,'runtime.vars'),`AUTH_ORIGIN=${origin}\nRER_DEV_ORIGIN=${origin}\nAUTH_LOCAL=true\nOWNER_EMAIL=nativeowner@example.test\nSESSION_SECRET=${sessionSecret}\nSETUP_TOKEN=${setupToken}\nMAIL_PROVIDER=development\nMAIL_FROM=auth@localhost.test\nRER_DEV_KEY=${devKey}\n`,{mode:0o600})
 // Inspector sockets need no stable origin. Let workerd allocate one atomically
 // on every start rather than assuming the app's neighbouring port is free.
 worker=spawn(process.execPath,[...cli,'dev','--env-file',envFile??resolve(state,'runtime.vars'),'--local','--config',lossConfig?.path??'dist/server/wrangler.json','--persist-to',state,'--ip','127.0.0.1','--port',String(port),'--inspector-port','0','--show-interactive-dev-session=false'],{cwd:root,env:workerEnvironment(env),stdio:['ignore','pipe','pipe']})
 worker.stdout.on('data',c=>output+=c);worker.stderr.on('data',c=>output+=c)
 for(let i=0;i<160;i++) { if(worker.exitCode !== null) throw new Error(output); try { if((await fetch(origin+'/health')).ok) return } catch {} await new Promise(ok=>setTimeout(ok,125)) } throw new Error(output)
}
async function stop() { if(worker && worker.exitCode === null) { worker.kill('SIGTERM'); await new Promise(ok=>worker.once('exit',ok)) } }
async function request(path,{method='GET',body,cookie='',status=200,extra={}}={}) {
 const response=await fetch(origin+path,{method,redirect:'manual',headers:{origin,...(cookie?{cookie}:{}),...(body!==undefined?{'content-type':'application/json'}:{}),...extra},body:body===undefined?undefined:JSON.stringify(body)})
 const raw=await response.text(); assert.equal(response.status,status,`${method} ${path}: ${raw}`)
 return {response,raw,data:response.headers.get('content-type')?.includes('application/json')?JSON.parse(raw):undefined}
}
// The owner's first visit to the app goes through first-run setup until it is confirmed once.
async function finishFirstRun(cookie){
 assert.deepEqual(await (await fetch(origin+'/setup/state')).json(),{state:'unclaimed'})
 assert.match(await (await fetch(origin+'/')).text(),/href="\/setup"/)
 const pending=await fetch(origin+'/app',{redirect:'manual',headers:{cookie}});assert.equal(pending.status,303);assert.equal(pending.headers.get('location'),'/setup')
 const signedOut=await fetch(origin+'/setup',{redirect:'manual'});assert.equal(signedOut.headers.get('location'),'/signin?returnTo=%2Fsetup')
 const page=await fetch(origin+'/setup',{headers:{cookie}});assert.equal(page.status,200);assert.match(await page.text(),/Finish setup/)
 const done=await fetch(origin+'/setup',{method:'POST',redirect:'manual',headers:{cookie,origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'});assert.equal(done.status,303);assert.equal(done.headers.get('location'),'/app')
 assert.deepEqual(await (await fetch(origin+'/setup/state')).json(),{state:'claimed'})
 assert.match(await (await fetch(origin+'/')).text(),/href="\/signin"/)
 const again=await fetch(origin+'/setup',{redirect:'manual',headers:{cookie}});assert.equal(again.headers.get('location'),'/app','finished setup takes the owner into the app')
}
async function registered(name){
 if(name==='NativeOwner'){
  const response=await fetch(origin+'/auth/bootstrap',{method:'POST',redirect:'manual',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({token:setupToken,displayName:name,returnTo:'/app'})});assert.equal(response.status,303,'actual owner bootstrap');bootstrapCookie=response.headers.get('set-cookie').split(';')[0];const owner=await signIn(origin,'nativeowner@example.test');await finishFirstRun(owner.cookie);return owner;
 }
 const owner=await sql("SELECT email FROM oa_operators WHERE role='owner' AND status='active'");const actor=await signIn(origin,owner[0].email);return invite(origin,actor.cookie,name);
}
const login=async name=>{const actor=await signIn(origin,name.toLowerCase()+'@example.test');return {response:new Response(null,{headers:{'set-cookie':actor.cookie}}),data:{user:actor.user}}}

async function databasePath(dir) {let found;async function visit(path){for(const item of await readdir(path,{withFileTypes:true})){const child=resolve(path,item.name);if(item.isDirectory())await visit(child);else if(item.name.endsWith('.sqlite')){const db=new DatabaseSync(child,{readOnly:true});try{if(db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name='workspace'").get().n)found=child}finally{db.close()}}}}await visit(dir);assert.ok(found,'real D1 database found');return found}
async function check(name,fn) { try { await fn() } catch (error) { console.error('DIAG wrangler output tail:\n'+output.slice(-12000)); throw error } checks++; evidence.checks.push({name,status:'passed'}); console.log(`PASS ${name}`) }
try {
 await command(['d1','migrations','apply','DB','--local','--persist-to',state,'--config','dist/server/wrangler.json'])
 lossConfig=await(await import('./storage-hint-loss.mjs')).hintLossConfig(root);const port=await freePort(); await start(port)
 const beforeDenied=(await sql('SELECT count(*) AS n FROM workspace'))[0].n
 await request('/api/me',{status:401})
 assert.equal((await sql('SELECT count(*) AS n FROM workspace'))[0].n,beforeDenied,'denied empty-workspace read does not initialize state')
 const owner=await registered('NativeOwner'),member=await registered('NativeMember'),outsider=await registered('NativeOutsider'),expired=await registered('ExpiredControl'),revoked=await registered('RevokedControl')
 const c=(await request('/api/conversations',{method:'POST',cookie:owner.cookie,body:{name:'PrivateSessionMatrixMarker',kind:'private',participants:[member.user.id]}})).data
 await sql(`UPDATE oa_sessions SET expires_at=0 WHERE operator_id='${expired.user.id}'`)
 await request('/api/logout',{method:'POST',cookie:revoked.cookie,body:{}})
 const assets=await readdir(resolve(root,'dist/server/assets')); let fnId
 for(const file of assets.filter(x=>x.startsWith('loaders-')&&x.endsWith('.js'))) { const source=await readFile(resolve(root,'dist/server/assets',file),'utf8'); fnId=source.match(/id: "([a-f0-9]{64})",\s*name: "loadWorkspace"/)?.[1] ?? fnId }
 assert.ok(fnId,'private generated transport must exist in emitted artifact')
 await check('BASE-ACCESS-002 same-wire missing/expired/revoked/valid session matrix',async()=>{
  for(const [label,cookie,valid] of [['missing','',false],['expired',expired.cookie,false],['revoked',revoked.cookie,false],['valid',owner.cookie,true]]) {
   const before=await facts(),rows=[]
   for(const path of ['/api/me','/api/missing','/api/settings','/api/attention',`/api/conversations/${c.id}/preferences`]) { const r=await request(path,{cookie,status:valid?(path==='/api/missing'?404:200):401}); rows.push({surface:path,status:r.response.status,headers:Object.fromEntries(r.response.headers),body:r.raw}); if(!valid) assert.doesNotMatch(r.raw,/NativeOwner|PrivateSessionMatrixMarker/) }
   for(const path of ['/app','/app/missing']) { const r=await request(path,{cookie,status:valid?(path==='/app'?200:404):307}); rows.push({surface:path,status:r.response.status,headers:Object.fromEntries(r.response.headers),location:r.response.headers.get('location'),body:valid?'[synthetic document; private marker asserted]':r.raw}); if(!valid) { assert.equal(r.response.headers.get('location'),'/signin');assert.equal(r.raw,'') } else if(path==='/app') assert.match(r.raw,/PrivateSessionMatrixMarker/) }
   const r=await request(`/_serverFn/${fnId}`,{cookie,extra:{'x-tsr-serverFn':'true',accept:'application/json'}})
   rows.push({surface:'/_serverFn/<emitted-loadWorkspace-id>',status:r.response.status,headers:Object.fromEntries(r.response.headers),contentType:r.response.headers.get('content-type'),serialized:r.response.headers.get('x-tss-serialized'),body:r.raw})
   if(valid) { assert.match(r.raw,/PrivateSessionMatrixMarker/);assert.match(r.raw,/NativeOwner/);assert.equal(r.response.headers.get('x-tss-serialized'),'true'); const decoded=fromCrossJSON(JSON.parse(r.raw),{plugins:defaultSerovalPlugins});assert.equal(decoded.result.user.id,owner.user.id);assert.equal(decoded.result.conversations.find(row=>row.id===c.id)?.name,'PrivateSessionMatrixMarker') } else {assert.match(r.raw,/"to":"\/signin"/);assert.doesNotMatch(r.raw,/PrivateSessionMatrixMarker|NativeOwner/)}
   const after=await facts();assert.deepEqual(after,before,'read/session denial matrix must not mutate D1'); evidence.matrix.push({session:label,before,after,rows})
  }
  await request(`/_serverFn/${fnId}`,{cookie:owner.cookie,status:403,extra:{'x-tsr-serverFn':'true',origin:'https://attacker.invalid'}})
 })
 const post=(path,body,cookie=owner.cookie,status=200)=>request(path,{method:'POST',body,cookie,status})
 const patch=(path,body,cookie=owner.cookie,status=200)=>request(path,{method:'PATCH',body,cookie,status})
 const get=(path,cookie=owner.cookie,status=200)=>request(path,{cookie,status})
 await (await import('./operator-security.mjs')).runOperatorSecurity({origin,owner,member,setupToken,request,post,get,sql,facts,check})
 const restart=async(options={})=>{await stop();if(Object.hasOwn(options,'transferFaults')){await lossConfig.close();lossConfig=await(await import('./storage-hint-loss.mjs')).hintLossConfig(root,options.transferFaults)}await start(port)}
 const reconcile=async()=>{await stop();await new Promise((ok,bad)=>{const child=spawn(process.execPath,['scripts/storage/reconcile.mjs','--paused','--persist='+resolve(state,'v3'),'--discard-expired'],{cwd:root,env,stdio:['ignore','pipe','pipe']});let text='';child.stdout.on('data',value=>text+=value);child.stderr.on('data',value=>text+=value);child.once('error',bad);child.once('exit',code=>code===0?ok():bad(Error(text)))});await restart({transferFaults:null})}
 await (await import('./storage-flows.mjs')).storageFlows({check,post,patch,get,request,sql,owner,member,outsider,c,origin:()=>origin,restart,reconcile,facts})
 const normalizedHarness={check,post,patch,get,request,sql,owner,member,outsider,expired,revoked,registered,origin:()=>origin,restart:async()=>{await stop();await start(port)},facts,fnId,evidence,root};
 await(await import('./storage-guards.mjs')).storageGuards(normalizedHarness)
 await(await import('./attention.mjs')).runAttention(normalizedHarness)
 await(await import('./media-adversarial.mjs')).runMedia(normalizedHarness)
 await check('actual team invitations, scopes, reactions, preview and revocation',async()=>{await(await import('./team-runtime.mjs')).runTeamSurfaces({origin,ownerCookie:owner.cookie})})
 await check('Slack ZIP review, immutable native history, search, resume and guarded undo',async()=>{const checks=await(await import('./slack-import/journey.mjs')).importJourney({origin,owner,restart:async()=>restart({transferFaults:null}),sql});evidence.slackImports=checks})
 if(withoutBrowser){evidence.skipped=[{name:'Browser journey',reason:'Explicit --without-browser; no UI verdict'}]}else{
  await check('React/Start desktop and mobile native journey',async()=>{await(await import('./browser.mjs')).runBrowser(origin,resolve(root,'evidence/nook-1'))})
  await check('owner/admin erasure, modal keyboard containment and accessibility at desktop/mobile widths',async()=>{await(await import('./erasure-browser-support.mjs')).runErasureJourney({origin,ownerCookie:owner.cookie,destination:resolve(root,'evidence/nook-1/erasure')})})
  await check('keyboard focus, routing drafts and visible read frontier',async()=>{await(await import('./keyboard.mjs')).runKeyboard(origin,resolve(root,'evidence/nook-1'))})
  await check('team day-one desktop/mobile journey and native notification API',async()=>{await(await import('./team-browser.mjs')).runTeamBrowserSuite({origin,ownerCookie:owner.cookie,destination:resolve(root,'evidence/nook-1')})})
  await check('Slack wizard and imported history desktop/mobile',async()=>{await(await import('./slack-import-browser.mjs')).runSlackBrowser(origin)})
  await check('homepage responsive and keyboard behavior',async()=>{process.env.TEAM_CHAT_HOMEPAGE_ORIGIN=origin;process.env.TEAM_CHAT_HOMEPAGE_EVIDENCE_DIR=resolve(root,'evidence/nook-1');await import('./homepage.mjs')})
 }
 await stop()
 await check('original migrations, resumable R2 conversion and actual Base portability',async()=>{await import('./storage-migration.mjs')})
 await lossConfig.close();lossConfig=null
 await(await import('./installer-workflow.mjs')).runInstallerWorkflow({root,states,port,check,evidence,databasePath,stop,start,command,env,getState:()=>state,setState:value=>{state=value},getOrigin:()=>origin})
 console.log(`${checks} emitted Worker/D1 checks passed; all four native session controls recorded under BASE-ACCESS-002`)
 evidence.status=withoutBrowser?'partial':'passed';evidence.checkCount=checks
} catch(error) {evidence.status='failed';evidence.error=error.stack;evidence.workerLog=output.slice(-50000);throw error}
finally {
 await stop()
 await lossConfig?.close()
 const destination=process.env.TEAM_CHAT_EVIDENCE_DIR || resolve(root,'evidence/nook-1');await mkdir(destination,{recursive:true});await writeFile(resolve(destination,'worker-d1-results.json'),JSON.stringify(evidence,null,2)+'\n')
 for(const dir of states)await rm(dir,{recursive:true,force:true})
}
