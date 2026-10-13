import assert from 'node:assert/strict'
import {execFileSync,spawn} from 'node:child_process'
import {mkdtemp,readFile,rm,stat,writeFile} from 'node:fs/promises'
import {createServer} from 'node:net'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {chromium} from '@playwright/test'

// Run README's "Run it on your computer" commands in a fresh clone, in order.
// Two lines are not executed literally: `verify` (this test is part of it) and
// the real deploy (it needs an owner account; tests/owner-deploy.test.mjs covers
// it). Setup receives `--port`, as the README offers, so the clone cannot
// collide with another local app.
const root=resolve(import.meta.dirname,'..')
const readme=await readFile(join(root,'README.md'),'utf8')
const section=readme.match(/^## Run it on your computer\n([\s\S]*?)(?=^## )/m)?.[1]
assert.ok(section,'README keeps its local section')
const lines=[...section.matchAll(/^```sh\n([\s\S]*?)^```/gm)].flatMap(match=>match[1].replace(/\\\n\s*/g,' ').split('\n')).map(line=>line.replace(/\s+#.*$/,'').trim()).filter(Boolean)
for(const verb of ['setup','dev','outbox','verify','export','reset','import','deploy'])assert.ok(lines.some(line=>line.startsWith('rer '+verb)),'README documents '+verb)

const freePort=()=>new Promise((ok,bad)=>{const server=createServer();server.once('error',bad);server.listen(0,'127.0.0.1',()=>{const {port}=server.address();server.close(()=>ok(port))})})
const port=await freePort(),clone=await mkdtemp(join(tmpdir(),'nook-readme-')),bin=await mkdtemp(join(tmpdir(),'nook-readme-bin-'))
// README says `rer VERB`. The global rer runs the checkout's own pinned
// dispatcher, so the journey's `rer` does exactly that.
await writeFile(join(bin,'rer'),'#!/bin/sh\nexec node scripts/rer.mjs "$@"\n',{mode:0o755})
// The clone is a different checkout: it takes its own local operation, not verify's.
const {RER_LOCAL_OPERATION:_,...env}={...process.env,PATH:bin+':'+process.env.PATH,CI:'true',WRANGLER_SEND_METRICS:'false',RER_SERVER_JOURNEY:'1'}
const run=line=>execFileSync('bash',['-e','-c',line],{cwd:clone,env,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:20*60_000})
let dev,browser
try{
 execFileSync('git',['clone','--quiet','--no-hardlinks',root,clone])
 for(const line of lines){
  if(line==='rer verify'||(/^CLOUDFLARE_ACCOUNT_ID=/.test(line)))continue
  if(line==='rer dev'){
   dev=spawn('bash',['-c',line],{cwd:clone,env,stdio:['ignore','pipe','pipe'],detached:true});let output=''
   dev.stdout.on('data',chunk=>output+=chunk);dev.stderr.on('data',chunk=>output+=chunk)
   const ready=await new Promise((ok,bad)=>{const timer=setInterval(()=>{const url=/RER_READY (http:\/\/\S+)/.exec(output)?.[1];if(url){clearInterval(timer);ok(url)}else if(dev.exitCode!=null){clearInterval(timer);bad(Error('dev exited: '+output))}},250);setTimeout(()=>{clearInterval(timer);bad(Error('dev never became ready: '+output))},10*60_000)})
   assert.equal(ready,`http://127.0.0.1:${port}`,'dev reuses the port setup saved')
   assert.match(output,/RER_SIGNED_IN you@example\.com/)
   assert.doesNotMatch(output,/RER_SIGN_IN /,'dev identity prints no outbox sign-in line')
   const open=/RER_OPEN (http:\/\/\S+)/.exec(output)?.[1]
   assert.ok(open,'dev prints the link that signs the browser in')
   browser=await chromium.launch({channel:'chromium'})
   await firstRun(ready,open)
   continue
  }
  const command=line.startsWith('rer setup ')?line+' --port '+port:line
  if(line==='rer export --output exports/nook.rer')assert.equal(dev.exitCode!=null||dev.signalCode!=null,true,'the app is stopped before export')
  const output=run(command)
  if(line.startsWith('rer setup '))assert.match(output,/RER_SETUP_READY/)
  if(line==='rer outbox')assert.match(output,new RegExp(`RER_SIGN_IN http://127.0.0.1:${port}/__dev/outbox`))
  if(line==='rer dev --stop')await new Promise(ok=>dev.exitCode!=null||dev.signalCode?ok():dev.once('exit',ok))
 }
 assert.equal((await stat(join(clone,'exports/nook.rer'))).mode&0o077,0,'the archive is owner-only')
 // Export again after reset and import: the restored installation holds the same records.
 run('rer export --output exports/after-import.rer')
 const digest=async name=>JSON.parse((await readFile(join(clone,'exports',name),'utf8')).trim().split('\n').at(-1)).contentHash
 assert.equal(await digest('after-import.rer'),await digest('nook.rer'),'export, import and export again carry identical content')
 console.log('README-JOURNEY passed: fresh clone, setup, dev opened signed in, personas, key-gated outbox email link, /setup at 1440 and 390, stop, export, reset, import and deploy dry run.')
}finally{
 await browser?.close()
 if(dev&&dev.exitCode==null&&!dev.signalCode){try{execFileSync('node',['scripts/rer.mjs','dev','--stop'],{cwd:clone,env,stdio:'ignore'})}catch{process.kill(-dev.pid,'SIGTERM')}}
 await rm(clone,{recursive:true,force:true});await rm(bin,{recursive:true,force:true})
}

// The kept end-to-end email-link test. Dev identity signs the desktop browser in through a real dev
// session (the link `dev` prints) and reaches /setup; the phone signs in the way a person does: the
// owner's ordinary link is mailed to the key-gated outbox, opened, confirmed, and finishes setup.
// The outbox does not exist for a request without the checkout's dev key.
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
 const link=/RER_OPEN (http:\/\/\S+)/.exec(run('rer outbox --owner-email you@example.com'))?.[1]
 assert.ok(link,'outbox prints the link that opens the key-gated outbox')
 const phone=await browser.newPage({viewport:{width:390,height:844}})
 await phone.goto(link)
 await phone.waitForURL(origin+'/__dev/outbox')
 await phone.locator('article').first().getByRole('link').first().click()
 await phone.getByRole('link',{name:'Open this link',exact:true}).first().click()
 await phone.getByRole('button',{name:'Confirm',exact:true}).click()
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
