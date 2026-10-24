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
import {mailRuntime} from './mail-runtime.mjs'
import {mailEdge} from './mail-edge.mjs'

const withoutBrowser=process.argv.includes('--without-browser');
const suite=process.argv.find(arg=>arg.startsWith('--suite='))?.slice('--suite='.length)??'all';
assert.ok(['all','core','core-api','core-api-storage','core-api-product','core-browser','installer','unreads','scheduled','reminders','broadcast','personal','files','search','composition','slack-imports','conversion','keyboard','threads','readable-export','campfire-imports','mattermost-imports','integrations'].includes(suite),'runtime suite must be all, core, core-api, core-browser or installer');
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
const provider=mailEdge();
let worker,output = '',origin,checks = 0,bootstrapCookie,lossConfig
const sessionSecret=crypto.randomUUID()+crypto.randomUUID(),setupToken=crypto.randomUUID()+crypto.randomUUID()
const evidence = {clause:'BASE-ACCESS-002',runtime:'emitted Worker with local D1',wire:'parameterless GET; x-tsr-serverFn=true; same-origin; identical headers and URL for all session controls',matrix:[],checks:[]}
const command = args => new Promise((ok,bad) => { const p=spawn(process.execPath,[...cli,...args],{cwd:root,env,stdio:['ignore','pipe','pipe']}); let out='',err=''; p.stdout.on('data',c=>out+=c); p.stderr.on('data',c=>err+=c); p.on('error',bad); p.on('exit',code=>code===0?ok(out):bad(new Error(out+err))) })
// The running Worker owns this SQLite store. Query its D1 binding rather than
// starting a competing Wrangler/workerd writer against the same file.
const sql = async statement => worker ? (await worker.db.prepare(statement).all()).results : JSON.parse(await command(['d1','execute','DB','--local','--persist-to',state,'--config','dist/server/wrangler.json','--command',statement,'--json']))[0].results
const facts = async () => (await sql("SELECT (SELECT count(*) FROM nook_events) AS events,(SELECT count(*) FROM nook_messages) AS messages,(SELECT count(*) FROM nook_attachments) AS attachments"))[0]
async function start(port,{envFile}={}) {
 await released(port)
 origin=`http://127.0.0.1:${port}`; output=''
 const bindings=envFile?Object.fromEntries((await readFile(envFile,'utf8')).trim().split('\n').filter(line=>line.includes('=')).map(line=>{const at=line.indexOf('=');return [line.slice(0,at),line.slice(at+1)]})):{};
 worker=await mailRuntime({root,state,origin,bindings:{OWNER_EMAIL:'nativeowner@example.test',SESSION_SECRET:sessionSecret,SETUP_TOKEN:setupToken,RER_DEV_KEY:devKey,...bindings},configPath:lossConfig?.path,edge:provider});
}
async function stop(){if(worker){const current=worker;worker=undefined;await current.close()}}
async function request(path,{method='GET',body,cookie='',status=200,extra={}}={}) {
 // Each fixture request owns its socket. A synchronous archive validation or a
 // Worker restart must not reuse an idle pooled socket the server has closed.
 const payload=body===undefined?undefined:JSON.stringify(body)
 const response=await new Promise((resolve,reject)=>{const req=httpRequest(origin+path,{method,agent:false,headers:{origin,...(cookie?{cookie}:{}),...(payload!==undefined?{'content-type':'application/json','content-length':Buffer.byteLength(payload)}:{}),...extra}},res=>{const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('error',reject);res.on('end',()=>{const headers=new Headers();for(const [name,value] of Object.entries(res.headers))for(const item of Array.isArray(value)?value:[value])if(item!==undefined)headers.append(name,item);const response=new Response(chunks.length?Buffer.concat(chunks):null,{status:res.statusCode,statusText:res.statusMessage,headers});Object.defineProperty(response,'url',{value:new URL(path,origin).href});resolve(response)})});req.on('error',reject);req.end(payload)})
 const raw=await response.text(); assert.equal(response.status,status,`${method} ${path}: ${raw}`)
 return {response,raw,data:response.headers.get('content-type')?.includes('application/json')?JSON.parse(raw):undefined}
}
// The owner's first visit to the app goes through first-run setup until it is confirmed once.
async function finishFirstRun(cookie){
 assert.deepEqual(await (await fetch(origin+'/setup/state')).json(),{state:'claimed'})
 assert.match(await (await fetch(origin+'/')).text(),/href="\/signin(\?login_hint=[^"]*)?"/)
 const pending=await fetch(origin+'/app',{redirect:'manual',headers:{cookie}});assert.equal(pending.status,303);assert.equal(pending.headers.get('location'),'/setup')
 const signedOut=await fetch(origin+'/setup',{redirect:'manual'});assert.equal(signedOut.headers.get('location'),'/signin?returnTo=%2Fsetup')
 const page=await fetch(origin+'/setup',{headers:{cookie}});assert.equal(page.status,200);assert.match(await page.text(),/Finish setup/)
 const done=await fetch(origin+'/setup',{method:'POST',redirect:'manual',headers:{cookie,origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'});assert.equal(done.status,303);assert.equal(done.headers.get('location'),'/app')
 assert.deepEqual(await (await fetch(origin+'/setup/state')).json(),{state:'claimed'})
 assert.match(await (await fetch(origin+'/')).text(),/href="\/signin(\?login_hint=[^"]*)?"/)
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
async function validateArchive(){
 const db=new DatabaseSync(await databasePath(state),{readOnly:true});try{
  const {validateNormalizedArchive}=await import('../src/platform/storage/archive-validation.mjs')
  await validateNormalizedArchive({read:async table=>db.prepare('SELECT * FROM '+table).all()})
 }finally{db.close()}
}
async function check(name,fn) { try { await fn() } catch (error) { console.error('DIAG wrangler output tail:\n'+output.slice(-12000)); throw error } checks++; evidence.checks.push({name,status:'passed'}); console.log(`PASS ${name}`) }
try {
 const port=await freePort()
 if(suite!=='installer'){
 await command(['d1','migrations','apply','DB','--local','--persist-to',state,'--config','dist/server/wrangler.json'])
 lossConfig=await(await import('./storage-hint-loss.mjs')).hintLossConfig(root);await start(port)
 const beforeDenied=(await sql('SELECT count(*) AS n FROM workspace'))[0].n
 await request('/api/me',{status:401})
 assert.equal((await sql('SELECT count(*) AS n FROM workspace'))[0].n,beforeDenied,'denied empty-workspace read does not initialize state')
 const owner=await registered('NativeOwner'),member=await registered('NativeMember'),outsider=await registered('NativeOutsider'),expired=await registered('ExpiredControl'),revoked=await registered('RevokedControl')
 const c=(await request('/api/conversations',{method:'POST',cookie:owner.cookie,body:{name:'PrivateSessionMatrixMarker',kind:'private',participants:[member.user.id]}})).data
 await sql(`UPDATE oa_sessions SET expires_at=0 WHERE operator_id='${expired.user.id}'`)
 await request('/api/logout',{method:'POST',cookie:revoked.cookie,body:{}})
 const assets=await readdir(resolve(root,'dist/server/assets')); let fnId
 for(const file of assets.filter(x=>x.startsWith('loaders-')&&x.endsWith('.js'))) { const source=await readFile(resolve(root,'dist/server/assets',file),'utf8'); fnId=source.match(/id: "([a-f0-9]{64})",\s*name: "loadWorkspace"/)?.[1] ?? fnId }
 let broadcastFixture
 if(['core-api-product','core-browser'].includes(suite)){const harness={post:(path,body,cookie=owner.cookie,status=200)=>request(path,{method:'POST',body,cookie,status}),get:(path,cookie=owner.cookie,status=200)=>request(path,{cookie,status}),request,owner,member,registered,sql,check,origin:()=>origin};const fixture=await(await import('./reports.mjs')).reportsJourney(harness);if(suite==='core-browser'&&!withoutBrowser)await check('Report filters, current source drill-through and CSV at 1440 and 390',()=>import('./reports-browser.mjs').then(m=>m.reportsBrowser({origin,owner,fixture})))}
 assert.ok(fnId,'private generated transport must exist in emitted artifact')
 if(['unreads','scheduled','reminders','broadcast','personal','files','search','composition','slack-imports','conversion','keyboard','threads','readable-export','campfire-imports','mattermost-imports','integrations'].includes(suite)){
 const post=(path,body,cookie=owner.cookie,status=200)=>request(path,{method:'POST',body,cookie,status}),get=(path,cookie=owner.cookie,status=200)=>request(path,{cookie,status});
 if(suite==='integrations'){const fixture=await(await import('./integration-tokens.mjs')).integrationTokensJourney({post,get,request,owner,member,check,sql,origin:()=>origin});if(!withoutBrowser)await check('NOOK-079 an owner creates, rotates and revokes an integration token at 1440 and 390',()=>import('./integration-tokens-browser.mjs').then(m=>m.integrationTokensBrowser({origin,owner,alerts:fixture.alerts})))}
 else if(suite==='mattermost-imports'){const journey=await(await import('./mattermost-import/journey.mjs')).mattermostJourney({origin,owner,restart:async()=>{await stop();await start(port)},sql,validateArchive,check});if(!withoutBrowser)await check('NOOK-046 Mattermost import review and history at 1440 and 390',()=>import('./mattermost-import/browser.mjs').then(m=>m.mattermostBrowser({origin,owner,journey})))}
 else if(suite==='campfire-imports'){await(await import('./google-chat-import/journey.mjs')).googleChatJourney({origin,owner,sql,validateArchive,restart:async()=>{await stop();await start(port)},check});if(!withoutBrowser)await(await import('./google-chat-import/browser.mjs')).googleChatBrowser({origin});const journey=await(await import('./campfire-import/journey.mjs')).campfireJourney({origin,owner,restart:async()=>{await stop();await start(port)},sql,validateArchive,check});if(!withoutBrowser)await check('NOOK-044 Campfire reviewed import screens and populated history at 1440 and 390',()=>import('./campfire-import/browser.mjs').then(m=>m.campfireBrowser({origin,owner,journey})));await(await import('./campfire-import/journey.mjs')).campfireErasure({journey,check,validateArchive})}
 else if(suite==='slack-imports'){await check('Slack ZIP review, immutable native history, search, resume and guarded undo',async()=>{await(await import('./slack-import/journey.mjs')).importJourney({origin,owner,restart:async()=>{await stop();await start(port)},sql,validateArchive})});if(!withoutBrowser)await(await import('./slack-import-browser.mjs')).runSlackBrowser(origin)}
 else if(suite==='conversion'){await(await import('./group-conversion.mjs')).offboardedConversion({post,get,owner,member,registered,check,validateArchive,restart:async()=>{await stop();await start(port)}})}
 else if(suite==='readable-export'){await check('NOOK-047 readable scoped exports at both widths',()=>import('./readable-export-browser.mjs').then(m=>m.readableExportBrowser({origin,owner,member,outsider})))}
 else if(suite==='threads'){await(await import('./threads.mjs')).threadJourney({post,get,patch:(path,body,cookie=owner.cookie,status=200)=>request(path,{method:'PATCH',body,cookie,status}),registered,check,restart:async()=>{await stop();await start(port)}})}
 else if(suite==='keyboard'){await check('NOOK-052 authoritative last edit and current-ACL quick navigation at both widths',()=>import('./keyboard-gaps.mjs').then(m=>m.keyboardGaps({origin,owner,member})))}
 else if(suite==='composition'){const harness={post,get,request,owner,member,outsider,registered,check,restart:async()=>{await stop();await start(port)},sql,origin:()=>origin};if(!process.argv.includes('--browser-only'))await(await import('./profiles.mjs')).profilesJourney(harness);if(!withoutBrowser)await check('NOOK-017 composition and personal workspace at both widths',()=>import('./composition-browser.mjs').then(m=>m.compositionBrowser({origin,owner,member,outsider,sql,directoryPerson:process.argv.includes('--browser-only')?'Elena Rivera':'Directory Colleague 5001',destination:'evidence/composition'})))}
 else if(suite==='search'){const harness={post,get,patch:(path,body,cookie=owner.cookie,status=200)=>request(path,{method:'PATCH',body,cookie,status}),request,owner,member,outsider,registered,check,restart:async()=>{await stop();await start(port)},sql,origin:()=>origin};if(!process.argv.includes('--browser-only'))await(await import('./search.mjs')).searchJourney(harness);if(!withoutBrowser)await(await import('./search-browser.mjs')).searchBrowser({origin,owner,member,destination:'evidence/search'})}
 else if(suite==='files'){const patch=(path,body,cookie=owner.cookie,status=200)=>request(path,{method:'PATCH',body,cookie,status});const harness={post,get,patch,request,owner,member,outsider,registered,check,restart:async()=>{await stop();await start(port)},sql,validateArchive,origin:()=>origin};if(!process.argv.includes('--browser-only'))await(await import('./files.mjs')).filesJourney(harness);if(!withoutBrowser)await(await import('./files-browser.mjs')).filesBrowser({origin,owner,member,destination:'evidence/files'})}
 else if(suite==='personal'){const harness={post,get,request,owner,member,outsider,registered,check,restart:async()=>{await stop();await start(port)},sql,validateArchive};if(!process.argv.includes('--browser-only'))await(await import('./personal.mjs')).personalJourney(harness);if(!withoutBrowser)await(await import('./personal-browser.mjs')).personalBrowser({origin,owner,member})}
 else if(suite==='broadcast'){const patch=(path,body,cookie=owner.cookie,status=200)=>request(path,{method:'PATCH',body,cookie,status});const {people}=await(await import('./broadcast.mjs')).broadcastJourney({post,get,patch,request,owner,member,outsider,check,origin:()=>origin,restart:async()=>{await stop();await start(port)},sql});if(!withoutBrowser)await(await import('./broadcast-browser.mjs')).broadcastBrowser({origin,owner,member,people})}
 else if(suite==='reminders'){if(!process.argv.includes('--browser-only')){const harness={post,get,request,patch:(path,body,cookie=owner.cookie,status=200)=>request(path,{method:'PATCH',body,cookie,status}),owner,member,outsider,check,restart:async()=>{await stop();await start(port)},sql,origin:()=>origin};await(await import('./reminders.mjs')).remindersJourney(harness);await(await import('./saved-reminders.mjs')).savedRemindersJourney(harness);}if(!withoutBrowser)await(await import('./reminders-browser.mjs')).remindersBrowser({origin,owner,member})}
 else if(suite==='scheduled'){if(!process.argv.includes('--browser-only'))await (await import('./scheduled.mjs')).scheduledJourney({post,get,request,owner,member,outsider,check,restart:async()=>{await stop();await start(port)},sql});if(!withoutBrowser)await check('NOOK-034 schedule and review messages at both widths',()=>import('./scheduled-browser.mjs').then(m=>m.scheduledBrowser({origin,owner,member,memberOccurrences:!process.argv.includes('--browser-only')})))}
 else{if(!process.argv.includes('--browser-only'))await (await import('./unreads.mjs')).unreadsJourney({post,get,request,owner,member,outsider,check,registered,validateArchive,restart:async()=>{await stop();await start(port)},sql});
 if(!withoutBrowser)await (await import('./unreads-browser.mjs')).unreadsBrowser({origin,owner,member,outsider});}
 }
 if(suite!=='core-browser'&&!['unreads','scheduled','reminders','broadcast','personal','files','search','composition','slack-imports','conversion','keyboard','threads','readable-export','campfire-imports','mattermost-imports','integrations'].includes(suite)){
 if(suite!=='core-api-product'){
 await check('BASE-ACCESS-002 same-wire missing/expired/revoked/valid session matrix',async()=>{
  for(const [label,cookie,valid] of [['missing','',false],['expired',expired.cookie,false],['revoked',revoked.cookie,false],['valid',owner.cookie,true]]) {
   const before=await facts(),rows=[]
   for(const path of ['/api/me','/api/workspace?conversation='+c.id,'/api/missing','/api/settings','/api/attention',`/api/conversations/${c.id}/preferences`]) { const r=await request(path,{cookie,status:valid?(path==='/api/missing'?404:200):401}); rows.push({surface:path,status:r.response.status,headers:Object.fromEntries(r.response.headers),body:r.raw}); if(!valid) assert.doesNotMatch(r.raw,/NativeOwner|PrivateSessionMatrixMarker/) }
   for(const path of ['/app','/app/missing']) { const r=await request(path,{cookie,status:valid?(path==='/app'?200:404):307}); rows.push({surface:path,status:r.response.status,headers:Object.fromEntries(r.response.headers),location:r.response.headers.get('location'),body:valid?'[synthetic document; private marker asserted]':r.raw}); if(!valid) { assert.equal(r.response.headers.get('location'),'/signin');assert.equal(r.raw,'') } else if(path==='/app') assert.match(r.raw,/PrivateSessionMatrixMarker/) }
   const r=await request(`/_serverFn/${fnId}`,{cookie,extra:{'x-tsr-serverFn':'true',accept:'application/json'}})
   rows.push({surface:'/_serverFn/<emitted-loadWorkspace-id>',status:r.response.status,headers:Object.fromEntries(r.response.headers),contentType:r.response.headers.get('content-type'),serialized:r.response.headers.get('x-tss-serialized'),body:r.raw})
   if(valid) { assert.match(r.raw,/PrivateSessionMatrixMarker/);assert.match(r.raw,/NativeOwner/);assert.equal(r.response.headers.get('x-tss-serialized'),'true'); const decoded=fromCrossJSON(JSON.parse(r.raw),{plugins:defaultSerovalPlugins});assert.equal(decoded.result.user.id,owner.user.id);assert.equal(decoded.result.conversations.find(row=>row.id===c.id)?.name,'PrivateSessionMatrixMarker') } else {assert.match(r.raw,/"href":"\/signin"/);assert.doesNotMatch(r.raw,/PrivateSessionMatrixMarker|NativeOwner/)}
   const after=await facts();assert.deepEqual(after,before,'read/session denial matrix must not mutate D1'); evidence.matrix.push({session:label,before,after,rows})
  }
  await request(`/_serverFn/${fnId}`,{cookie:owner.cookie,status:403,extra:{'x-tsr-serverFn':'true',origin:'https://attacker.invalid'}})
 })
 }
 const post=(path,body,cookie=owner.cookie,status=200)=>request(path,{method:'POST',body,cookie,status})
 const patch=(path,body,cookie=owner.cookie,status=200)=>request(path,{method:'PATCH',body,cookie,status})
 const get=(path,cookie=owner.cookie,status=200)=>request(path,{cookie,status})
 if(suite!=='core-api-product')await (await import('./operator-security.mjs')).runOperatorSecurity({origin,owner,member,setupToken,request,post,get,sql,facts,check})
 const restart=async(options={})=>{await stop();if(Object.hasOwn(options,'transferFaults')){await lossConfig.close();lossConfig=await(await import('./storage-hint-loss.mjs')).hintLossConfig(root,options.transferFaults)}await start(port)}
 const reconcile=async()=>{await stop();await new Promise((ok,bad)=>{const child=spawn(process.execPath,['scripts/storage/reconcile.mjs','--paused','--persist='+resolve(state,'v3'),'--discard-expired'],{cwd:root,env,stdio:['ignore','pipe','pipe']});let text='';child.stdout.on('data',value=>text+=value);child.stderr.on('data',value=>text+=value);child.once('error',bad);child.once('exit',code=>code===0?ok():bad(Error(text)))});await restart({transferFaults:null})}
 if(suite!=='core-api-product')await (await import('./storage-flows.mjs')).storageFlows({check,post,patch,get,request,sql,owner,member,outsider,c,origin:()=>origin,restart,reconcile,facts})
 const normalizedHarness={validateArchive,check,post,patch,get,request,sql,owner,member,outsider,expired,revoked,registered,origin:()=>origin,restart:async()=>{await stop();await start(port)},facts,fnId,evidence,root};
 if(suite!=='core-api-product')await(await import('./storage-guards.mjs')).storageGuards(normalizedHarness)
 if(suite!=='core-api-storage'){
 await(await import('./attention.mjs')).runAttention(normalizedHarness)
 await(await import('./threads.mjs')).threadJourney(normalizedHarness)
 // Archive proofs run before later journeys deliberately corrupt reminder clocks.
 await(await import('./personal.mjs')).personalJourney(normalizedHarness)
 await(await import('./files.mjs')).filesJourney(normalizedHarness)
 await(await import('./channel-lifecycle.mjs')).channelLifecycleJourney(normalizedHarness)
 await(await import('./scheduled.mjs')).scheduledJourney(normalizedHarness)
 await(await import('./reminders.mjs')).remindersJourney(normalizedHarness)
 await(await import('./unreads.mjs')).unreadsJourney(normalizedHarness)
 await(await import('./posting.mjs')).postingJourney(normalizedHarness)
 broadcastFixture=await(await import('./broadcast.mjs')).broadcastJourney(normalizedHarness)
 await(await import('./saved-reminders.mjs')).savedRemindersJourney(normalizedHarness)
 await(await import('./saved-search.mjs')).savedSearchJourney(normalizedHarness)
 }
 if(suite!=='core-api-product')await(await import('./media-adversarial.mjs')).runMedia(normalizedHarness)
 if(suite!=='core-api-storage'){
 await check('actual team invitations, scopes, reactions, preview and revocation',async()=>{await(await import('./team-runtime.mjs')).runTeamSurfaces({origin,ownerCookie:owner.cookie})})
 await check('Slack ZIP review, immutable native history, search, resume and guarded undo',async()=>{const checks=await(await import('./slack-import/journey.mjs')).importJourney({origin,owner,restart:async()=>restart({transferFaults:null}),sql});evidence.slackImports=checks})
 }
 }
 if(!['core-api','core-api-storage','core-api-product'].includes(suite)&&!['unreads','scheduled','reminders','broadcast','personal','files','search','composition','slack-imports','conversion','keyboard','threads','readable-export','campfire-imports','mattermost-imports','integrations'].includes(suite)){
 if(withoutBrowser){evidence.skipped=[{name:'Browser journey',reason:'Explicit --without-browser; no UI verdict'}]}else{
  broadcastFixture??=await(await import('./broadcast.mjs')).broadcastJourney({check,post:(path,body,cookie=owner.cookie,status=200)=>request(path,{method:'POST',body,cookie,status}),patch:(path,body,cookie=owner.cookie,status=200)=>request(path,{method:'PATCH',body,cookie,status}),get:(path,cookie=owner.cookie,status=200)=>request(path,{cookie,status}),request,owner,member,outsider,sql,origin:()=>origin,restart:async()=>{await stop();await start(port)}})
  await(await import('./broadcast-browser.mjs')).broadcastBrowser({origin,owner,member,people:broadcastFixture.people})
  if(['all','core'].includes(suite))await check('NOOK-047 readable scoped exports at both widths',()=>import('./readable-export-browser.mjs').then(m=>m.readableExportBrowser({origin,owner,member,outsider})))
  await check('NOOK-019 Files at both widths',async()=>{await(await import('./files-browser.mjs')).filesBrowser({origin,owner,member,destination:'evidence/files'})})
  await check('NOOK-017 Drafts and sent at both widths',async()=>{await(await import('./personal-browser.mjs')).personalBrowser({origin,owner,member})})
  await check('NOOK-033 reminder journeys at both widths',async()=>{await(await import('./reminders-browser.mjs')).remindersBrowser({origin,owner,member})})
  await check('NOOK-034 schedule and review messages at both widths',async()=>{await(await import('./scheduled-browser.mjs')).scheduledBrowser({origin,owner,member})})
  await check('NOOK-071 All unreads and group conversion at both widths',async()=>{await(await import('./unreads-browser.mjs')).unreadsBrowser({origin,owner,member,outsider})})
  await check('NOOK-020 saved reminders at both widths',async()=>{await(await import('./saved-reminders-browser.mjs')).savedRemindersBrowser({origin,owner,member})})
  await check('NOOK-066 posting settings and restricted composers at both widths',async()=>{await(await import('./posting-browser.mjs')).postingBrowser({origin,owner,member})})
  await check('React/Start desktop and mobile native journey',async()=>{await(await import('./browser.mjs')).runBrowser(origin,resolve(root,'evidence/nook-1'))})
  await check('owner/admin erasure, modal keyboard containment and accessibility at desktop/mobile widths',async()=>{await(await import('./erasure-browser-support.mjs')).runErasureJourney({origin,ownerCookie:owner.cookie,destination:resolve(root,'evidence/nook-1/erasure')})})
  await check('keyboard focus, routing drafts and visible read frontier',async()=>{await(await import('./keyboard.mjs')).runKeyboard(origin,resolve(root,'evidence/nook-1'))})
  if(suite==='all'||suite==='core')await check('NOOK-052 authoritative last edit and current-ACL quick navigation at both widths',()=>import('./keyboard-gaps.mjs').then(m=>m.keyboardGaps({origin,owner,member})))
  await check('team day-one desktop/mobile journey and native notification API',async()=>{await(await import('./team-browser.mjs')).runTeamBrowserSuite({origin,ownerCookie:owner.cookie,destination:resolve(root,'evidence/nook-1')})})
  await check('installed Nook opens its own app window at desktop/mobile widths',async()=>{await(await import('./pwa-install.mjs')).runPwaInstall({origin,ownerCookie:owner.cookie,destination:resolve(root,'evidence/nook-1/install')})})
  await check('Slack wizard and imported history desktop/mobile',async()=>{await(await import('./slack-import-browser.mjs')).runSlackBrowser(origin)})
  await check('homepage responsive and keyboard behavior',async()=>{process.env.TEAM_CHAT_HOMEPAGE_ORIGIN=origin;process.env.TEAM_CHAT_HOMEPAGE_EVIDENCE_DIR=resolve(root,'evidence/nook-1');await import('./homepage.mjs')})
  await check('NOOK-017 composition and personal workspace at both widths',()=>import('./composition-browser.mjs').then(m=>m.compositionBrowser({origin,owner,member,outsider,sql,destination:'evidence/composition'})))
 }
 }
 if(['all','core','core-api','core-api-product','installer'].includes(suite))await(await import('./profiles.mjs')).profilesJourney({post:(path,body,cookie=owner.cookie,status=200)=>request(path,{method:'POST',body,cookie,status}),get:(path,cookie=owner.cookie,status=200)=>request(path,{cookie,status}),request,owner,member,outsider,check,restart:async()=>{await stop();await start(port)},sql,origin:()=>origin})
 await stop()
 if(suite==='all'||suite==='core')await new Promise((ok,bad)=>{const child=spawn(process.execPath,['tests/runtime.mjs','--suite=conversion'],{cwd:root,env,stdio:'inherit'});child.once('error',bad);child.once('exit',code=>code===0?ok():bad(Error('Isolated group-conversion journey failed')))})
 if(suite!=='core-api-product'&&suite!=='core-browser'&&!['unreads','scheduled','reminders','broadcast','personal','files','search','composition','slack-imports','conversion','keyboard','threads','readable-export','campfire-imports','mattermost-imports','integrations'].includes(suite))await check('original migrations, resumable R2 conversion and actual Base portability',async()=>{await import('./storage-migration.mjs')})
 if(['all','core','threads'].includes(suite))await new Promise((ok,bad)=>{const child=spawn(process.execPath,['--test','--test-concurrency=1','tests/thread-delivery.mjs'],{cwd:root,env,stdio:'inherit'});child.once('error',bad);child.once('exit',code=>code===0?ok():bad(Error('Thread delivery journey failed')))})
 await lossConfig.close();lossConfig=null
 }
 if(suite==='all'||suite==='installer')await(await import('./installer-workflow.mjs')).runInstallerWorkflow({root,states,port,check,evidence,databasePath,stop,start,command,env,getState:()=>state,setState:value=>{state=value},getOrigin:()=>origin})
 console.log(`${checks} emitted Worker/D1 checks passed; suite=${suite}`)
 evidence.status=withoutBrowser&&!['core-api','core-api-storage','core-api-product'].includes(suite)?'partial':'passed';evidence.checkCount=checks
} catch(error) {evidence.status='failed';evidence.error=error.stack;evidence.workerLog=output.slice(-50000);throw error}
finally {
 await stop()
 await lossConfig?.close()
 const destination=process.env.TEAM_CHAT_EVIDENCE_DIR || resolve(root,'evidence/nook-1');await mkdir(destination,{recursive:true});await writeFile(resolve(destination,'worker-d1-results.json'),JSON.stringify(evidence,null,2)+'\n')
 for(const dir of states)await rm(dir,{recursive:true,force:true})
}
