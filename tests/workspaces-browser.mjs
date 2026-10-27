// NOOK-017 "Your workspaces": two local installations on separate origins
// (127.0.0.1 and localhost, so their cookies stay apart as on real hosts).
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
const workspaceName=JSON.parse(await readFile(new URL('../src/branding.json',import.meta.url),'utf8')).name
import {spawn} from 'node:child_process'
import {mkdtemp,mkdir,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {resolve} from 'node:path'
import {chromium,expect} from '@playwright/test'
import {signIn} from './auth-support.mjs'
import {devKey} from './dev-key.mjs'
import {mailRuntime} from './mail-runtime.mjs'
import {freePort} from './worker-ports.mjs'

const root=process.cwd(),destination=resolve(root,'evidence/workspaces'),states=[],workers=[]
const ownerEmail='ana@example.test'
const wrangler=(args,state)=>new Promise((ok,bad)=>{const child=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js',...args],{cwd:root,env:{...process.env,WRANGLER_LOG_PATH:resolve(state,'wrangler.log'),WRANGLER_SEND_METRICS:'false',CI:'true'},stdio:['ignore','pipe','pipe']});let out='';child.stdout.on('data',c=>out+=c);child.stderr.on('data',c=>out+=c);child.once('error',bad);child.once('exit',code=>code===0?ok(out):bad(Error(out)))})
async function installation(host,name,channel){
 const state=await mkdtemp(resolve(tmpdir(),'nook-workspaces-'));states.push(state)
 await wrangler(['d1','migrations','apply','DB','--local','--persist-to',state,'--config','dist/server/wrangler.json'],state)
 const origin=`http://${host}:${await freePort()}`,setupToken=crypto.randomUUID()+crypto.randomUUID()
 const worker=await mailRuntime({root,state,origin,bindings:{OWNER_EMAIL:ownerEmail,SESSION_SECRET:crypto.randomUUID()+crypto.randomUUID(),SETUP_TOKEN:setupToken,RER_DEV_KEY:devKey}});workers.push(worker)
 const claimed=await fetch(origin+'/auth/bootstrap',{method:'POST',redirect:'manual',headers:{origin,'content-type':'application/json'},body:JSON.stringify({token:setupToken,displayName:name,returnTo:'/app'})});assert.equal(claimed.status,303,'owner claim')
 const owner=await signIn(origin,ownerEmail)
 const setup=await fetch(origin+'/setup',{method:'POST',redirect:'manual',headers:{cookie:owner.cookie,origin,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'});assert.equal(setup.status,303,'first run finished')
 const room=await fetch(origin+'/api/conversations',{method:'POST',headers:{cookie:owner.cookie,origin,'content-type':'application/json'},body:JSON.stringify({name:channel,kind:'channel'})});assert.equal(room.status,200)
 return {origin,owner,name,channel:await room.json(),worker}
}
const cookieFor=(origin,session)=>{const at=session.indexOf('=');return {name:session.slice(0,at),value:session.slice(at+1),url:origin}}

try{
 await mkdir(destination,{recursive:true})
 const a=await installation('127.0.0.1','Ana Rivera','acme-launch'),b=await installation('localhost','Ana R.','beta-launch')
 // A link saved on the account by an earlier Nook version joins the device list.
 await a.worker.db.prepare('INSERT INTO nook_personal_installations VALUES(?,?,?)').bind(a.owner.user.id,'https://legacy.example.com','Legacy workspace').run()
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{for(const width of [1440,390]){
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width,height:width===390?844:1000}})
  try{
   const sessionA=width===1440?a.owner.cookie:(await signIn(a.origin,ownerEmail)).cookie,sessionB=width===1440?b.owner.cookie:(await signIn(b.origin,ownerEmail)).cookie
   await context.addCookies([cookieFor(a.origin,sessionA),cookieFor(b.origin,sessionB)])
   const page=await context.newPage(),shot=name=>page.screenshot({animations:'disabled',path:resolve(destination,`${name}-${width}.png`)})
   // The menu sits in the sidebar at desktop width and on the You page on a phone.
   const menu=async()=>{if(width===1440){const details=page.locator('details.workspaces-menu');if(!await details.evaluate(d=>d.open))await details.locator('summary').click();return details}await page.getByRole('navigation',{name:'Workspace'}).getByRole('button',{name:'You',exact:true}).click();return page.locator('section.workspaces-section')}
   const entries=async scope=>(await scope.getByRole('list',{name:'Your workspaces'}).locator('strong').allTextContents())
   const draftA='Hold the Acme launch note until legal signs off.'

   await page.goto(a.origin+'/app?conversation='+a.channel.id)
   await page.getByRole('textbox',{name:'Message acme-launch',exact:true}).fill(draftA)
   let list=await menu()
   // Account-carried links arrive after mount; composer readiness is unrelated.
   await expect(list.getByRole('link').filter({hasText:'Another workspace'})).toBeVisible()
   assert.deepEqual(await entries(list),[workspaceName,'Another workspace'],'this installation and the carried account link')
   await expect(list.getByText('This workspace · Ana Rivera',{exact:true})).toBeVisible()
   await shot('a-menu')
   // Add the second installation by address: it opens on its own origin.
   await list.getByLabel('Workspace URL',{exact:true}).fill(b.origin)
   await list.getByRole('button',{name:'Open',exact:true}).click()
   await page.waitForURL(url=>url.origin===b.origin&&url.pathname==='/app')
   const prompt=page.getByRole('region',{name:'Add workspaces'})
   await expect(prompt).toContainText(`from ${workspaceName}`)
   assert.equal(new URL(page.url()).hash,'','the handoff fragment is removed from the address')
   await shot('b-handoff')
   await prompt.getByRole('button',{name:'Add',exact:true}).click()
   await expect(prompt).toHaveCount(0)
   list=await menu()
   assert.deepEqual(await entries(list),[workspaceName,workspaceName,'Another workspace'])
   await expect(list.getByText('Signed in as Ana Rivera',{exact:true})).toBeVisible()
   await shot('b-menu')
   // A known source can hand off a new entry without repeating its own name.
   const incoming={from:a.origin,entries:[{origin:a.origin,account:'',seen:Date.now()+1},{origin:'https://synthetic-nook-workspace.test',name:'Customer notes',account:'',seen:Date.now()}],removed:{}}
   await page.goto(b.origin+'/app?view=people')
   await page.goto(b.origin+'/app#nook-workspaces='+encodeURIComponent(JSON.stringify(incoming)))
   await expect(prompt).toContainText(`from ${workspaceName}`)
   await prompt.getByRole('button',{name:'Not now',exact:true}).click()
   // Drafts stay with their installation.
   await page.goto(b.origin+'/app?conversation='+b.channel.id)
   await expect(page.getByRole('textbox',{name:'Message beta-launch',exact:true})).toHaveValue('')
   assert.ok(!(await page.evaluate(()=>Object.values(localStorage).join('\n'))).includes(draftA),'no draft from the other installation on this origin')
   await page.getByRole('textbox',{name:'Message beta-launch',exact:true}).fill('Beta notes stay here.')
   // Open the first installation from the second one's menu.
   list=await menu()
   await list.getByRole('link').filter({hasText:'Signed in as Ana Rivera'}).click()
   await page.waitForURL(url=>url.origin===a.origin&&url.pathname==='/app')
   await expect(page.getByRole('region',{name:'Add workspaces'})).toHaveCount(0)
   list=await menu()
   assert.deepEqual(await entries(list),[workspaceName,workspaceName,'Another workspace'])
   await expect(list.getByText('Signed in as Ana R.',{exact:true})).toBeVisible()
   // Removing forgets one entry on this device, across a reload.
   await list.getByRole('button',{name:`Remove ${workspaceName}`,exact:true}).click()
   assert.deepEqual(await entries(list),[workspaceName,'Another workspace'])
   await page.reload();list=await menu()
   assert.deepEqual(await entries(list),[workspaceName,'Another workspace'],'removal survives reload')
   await shot('a-removed')
   await page.goto(a.origin+'/app?conversation='+a.channel.id)
   await expect(page.getByRole('textbox',{name:'Message acme-launch',exact:true})).toHaveValue(draftA)
   assert.ok(!(await page.evaluate(()=>Object.values(localStorage).join('\n'))).includes('Beta notes stay here.'))
   // Sign-in is separate: signing out of one installation leaves the other signed in.
   await page.goto(b.origin+'/app?view=you')
   await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.waitForURL(url=>url.origin===b.origin&&url.pathname==='/signin')
   const signedOut=await page.request.get(b.origin+'/api/me');assert.equal(signedOut.status(),401)
   await page.goto(a.origin+'/app');await expect(page.locator('.workspace#primary')).toBeVisible()
   assert.equal((await page.request.get(a.origin+'/api/me')).status(),200,'the other installation stays signed in')
   console.log(`PASS NOOK-017 Your workspaces menu across two installations at ${width}`)
  }finally{await context.close()}
 }}finally{await browser.close()}
 console.log('PASS NOOK-017 Your workspaces menu lists, opens, forgets and isolates two local installations at 1440 and 390')
}finally{
 for(const worker of workers)await worker.close()
 for(const state of states)await rm(state,{recursive:true,force:true})
}
