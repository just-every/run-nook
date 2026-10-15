import assert from 'node:assert/strict'
import {execFileSync,spawn} from 'node:child_process'
import {mkdtemp,readFile,rm,stat,writeFile} from 'node:fs/promises'
import {createServer} from 'node:net'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {chromium} from '@playwright/test'

// Run README's "Run it on your computer" commands in a fresh clone, in order.
// Four kinds of line are not executed literally: `verify` (this test is part of it),
// the real deploy (it needs an owner account; tests/owner-deploy.test.mjs covers
// it), the npm global install (the shim below supplies the same launcher) and the clone
// and cd, which this test has already done. Dev receives a free port so the clone
// cannot collide with another local app.
const root=resolve(import.meta.dirname,'..')
const readme=await readFile(join(root,'README.md'),'utf8')
const section=readme.match(/^## Run it on your computer\n([\s\S]*?)(?=^## )/m)?.[1]
assert.ok(section,'README keeps its local section')
const lines=[...section.matchAll(/^```sh\n([\s\S]*?)^```/gm)].flatMap(match=>match[1].replace(/\\\n\s*/g,' ').split('\n')).map(line=>line.replace(/\s+#.*$/,'').trim()).filter(Boolean)
for(const verb of ['dev','verify','export','reset','import','deploy'])assert.ok(lines.some(line=>line.startsWith('rer '+verb)),'README documents '+verb)

const freePort=()=>new Promise((ok,bad)=>{const server=createServer();server.once('error',bad);server.listen(0,'127.0.0.1',()=>{const {port}=server.address();server.close(()=>ok(port))})})
const port=await freePort(),clone=await mkdtemp(join(tmpdir(),'nook-readme-')),bin=await mkdtemp(join(tmpdir(),'nook-readme-bin-'))
// README says `rer VERB`. The global rer runs the checkout's own pinned
// launcher, including the foreground override, and installs a fresh clone's
// dependencies itself, so the journey does exactly that.
await writeFile(join(bin,'rer'),`#!/bin/sh\nexec node ${join(root,'node_modules/@runeditrun/rer/global/rer.mjs')} "$@"\n`,{mode:0o755})
// The clone is a different checkout: it takes its own local operation, not verify's.
const {RER_LOCAL_OPERATION:_,...env}={...process.env,PATH:bin+':'+process.env.PATH,CI:'true',WRANGLER_SEND_METRICS:'false',RER_SERVER_JOURNEY:'1'}
const run=line=>execFileSync('bash',['-e','-c',line],{cwd:clone,env,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:20*60_000})
let dev,browser,ownerEmail
try{
 execFileSync('git',['clone','--quiet','--no-hardlinks',root,clone])
 for(const line of lines){
  if(line==='rer verify'||/^(npm install -g |OWNER_EMAIL=|CLOUDFLARE_ACCOUNT_ID=|git clone |cd )/.test(line))continue
  if(line==='rer dev'){
   dev=spawn('bash',['-c',line+' --port '+port+' --foreground'],{cwd:clone,env,stdio:['ignore','pipe','pipe'],detached:true});let output=''
   dev.stdout.on('data',chunk=>output+=chunk);dev.stderr.on('data',chunk=>output+=chunk)
   const ready=await new Promise((ok,bad)=>{const timer=setInterval(()=>{const url=/RER_READY (http:\/\/\S+)/.exec(output)?.[1];if(url){clearInterval(timer);clearTimeout(deadline);ok(url)}else if(dev.exitCode!=null){clearInterval(timer);clearTimeout(deadline);bad(Error('dev exited: '+output))}},250);const deadline=setTimeout(()=>{clearInterval(timer);bad(Error('dev never became ready: '+output))},10*60_000)})
   assert.equal(ready,`http://127.0.0.1:${port}`,'zero-setup dev uses the selected port')
   ownerEmail=/RER_SIGNED_IN (\S+@\S+)/.exec(output)?.[1]
   assert.ok(ownerEmail,'zero-setup dev creates a signed-in owner')
   assert.doesNotMatch(output,/RER_SIGN_IN /,'dev identity prints no outbox sign-in line')
   const open=/RER_OPEN (http:\/\/\S+)/.exec(output)?.[1]
   assert.ok(open,'dev prints the link that signs the browser in')
   browser=await chromium.launch({channel:'chromium'})
   await firstRun(ready,open)
   continue
  }
  const command=line.replace('--owner-email EMAIL','--owner-email '+ownerEmail)
  if(line==='rer export --output exports/nook.rer')assert.equal(dev.exitCode!=null||dev.signalCode!=null,true,'the app is stopped before export')
  const output=run(line==='rer deploy --dry-run'?'OWNER_EMAIL=nativeowner@example.test MAIL_FROM=auth@example.test SENDGRID_API_KEY=test-only-sendgrid-key '+command:command)
  if(line==='rer dev --stop')await new Promise(ok=>dev.exitCode!=null||dev.signalCode?ok():dev.once('exit',ok))
 }
 assert.equal((await stat(join(clone,'exports/nook.rer'))).mode&0o077,0,'the archive is owner-only')
 // Export again after reset and import: the restored installation holds the same records.
 run('rer export --output exports/after-import.rer')
 const digest=async name=>JSON.parse((await readFile(join(clone,'exports',name),'utf8')).trim().split('\n').at(-1)).contentHash
 assert.equal(await digest('after-import.rer'),await digest('nook.rer'),'export, import and export again carry identical content')
 console.log('README-JOURNEY passed: fresh clone, zero-setup dev opened signed in, personas, key-gated one-click owner entry, /setup at 1440 and 390, stop, export, reset, import and deploy dry run.')
}finally{
 await browser?.close()
 if(dev&&dev.exitCode==null&&!dev.signalCode){try{execFileSync('node',['node_modules/@runeditrun/rer/bin/rer.mjs','dev','--stop'],{cwd:clone,env,stdio:'ignore'})}catch{process.kill(-dev.pid,'SIGTERM')}}
 await rm(clone,{recursive:true,force:true});await rm(bin,{recursive:true,force:true})
}

// Canonical local entry uses the checkout key and Base's one-click owner page.
// Native production email-link consumption is covered by operator-auth and runtime.
async function firstRun(origin,open){
 const desktop=await browser.newPage({viewport:{width:1440,height:1000}})
 await desktop.goto(open)
 await desktop.waitForURL(origin+'/setup')
 await desktop.getByRole('heading',{name:'Finish setup'}).waitFor()
 assert.ok(await desktop.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal scroll at 1440')
 await desktop.goto(origin+'/app');await desktop.waitForURL(origin+'/setup')
 const keyless=await fetch(origin+'/__dev/outbox')
 assert.equal(keyless.status,404,'the outbox answers nothing without the dev key')
 assert.equal((await fetch(origin+'/auth/dev/enter?as=owner',{redirect:'manual'})).status,404,'dev sign-in answers nothing without the dev key')
 const phone=await browser.newPage({viewport:{width:390,height:844}})
 await phone.goto(open)
 await phone.waitForURL(origin+'/setup')
 await phone.goto(origin+'/signin')
 await phone.getByRole('link',{name:'Continue as owner',exact:true}).click()
 await phone.waitForURL(origin+'/setup')
 await phone.getByRole('heading',{name:'Finish setup'}).waitFor()
 assert.ok(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal scroll at 390')
 await phone.getByRole('checkbox').check()
 await phone.getByRole('button',{name:'Finish setup'}).click()
 await phone.waitForURL(origin+'/app')
 await desktop.goto(origin+'/setup');await desktop.waitForURL(origin+'/app')
 // The personas are real operators admitted to the product with their own role.
 for(const [as,role,mode] of [['admin','admin','member'],['member','member','member'],['guest','member','guest']]){
  await desktop.goto(`${origin}/auth/dev/enter?as=${as}&returnTo=/app`);await desktop.waitForURL(origin+'/app')
  const me=await desktop.evaluate(async()=>(await fetch('/api/me')).json())
  assert.deepEqual({name:me.name,role:me.role,mode:me.mode},{name:'Dev '+as,role,mode},`${as} persona is admitted with its own role and mode`)
 }
 await desktop.goto(`${origin}/auth/dev/enter?as=owner&returnTo=/app`);await desktop.waitForURL(origin+'/app')
 await desktop.close();await phone.close()
}
