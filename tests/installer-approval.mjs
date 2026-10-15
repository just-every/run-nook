import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {keyHeaders} from './dev-key.mjs'

// Start the installer through its public launcher, as an owner does.
export function launchInstaller(root,args,env){
 return new Promise((ok,bad)=>{
  const child=spawn(process.execPath,['scripts/install.mjs','--no-open',...args],{cwd:root,env,stdio:['ignore','pipe','pipe']})
  let out=''
  const fail=()=>bad(Error('Installer did not start: '+out))
  child.stderr.on('data',chunk=>out+=chunk);child.once('error',bad);child.once('exit',fail)
  child.stdout.on('data',chunk=>{out+=chunk;const origin=/installer: (http:\/\/\S+)/.exec(out)?.[1];if(!origin)return
   child.off('exit',fail)
   ok({origin,async state(){return (await fetch(origin+'/api/state',{headers:await installerHeaders(origin)})).json()},close:()=>new Promise(done=>{if(child.exitCode!=null||child.signalCode)return done();child.once('exit',()=>done());child.kill('SIGTERM')})})
  })
 })
}

async function installerHeaders(origin){
 const page=await fetch(origin),html=await page.text()
 assert.equal(page.status,200)
 const token=html.match(/name="installer-token" content="([a-f0-9]+)"/)?.[1]
 assert.ok(token,'installer page supplies its approval token')
 return {origin,cookie:page.headers.get('set-cookie').split(';')[0],'x-installer-token':token,'content-type':'application/json'}
}

// Exercise the same page/session, draft and approval doors as the local wizard.
export async function approveInstaller(installer,input,{phase='complete'}={}){
 const headers=await installerHeaders(installer.origin)
 assert.equal((await fetch(installer.origin+'/api/draft',{method:'POST',headers,body:JSON.stringify(input)})).status,200)
 const first=await fetch(installer.origin+'/api/start',{method:'POST',headers,body:JSON.stringify(input)})
 assert.equal(first.status,202,'one concrete installation approval: '+await first.text())
 assert.equal((await fetch(installer.origin+'/api/start',{method:'POST',headers,body:JSON.stringify(input)})).status,409,'a duplicate approval does not create another install')
 let state
 for(let i=0;i<4800;i++){
  const response=await fetch(installer.origin+'/api/state',{headers});assert.equal(response.status,200)
  state=await response.json()
  if(state.phase!=='running')break
  await new Promise(ok=>setTimeout(ok,250))
 }
 assert.equal(state.phase,phase,state.error)
 if(phase==='failed'){assert.ok(state.error);return state}
 const origin=new URL(state.appUrl).origin
 const signInPage=await (await fetch(origin+'/signin',{headers:keyHeaders})).text()
 assert.ok(signInPage.includes(input.WORKSPACE_NAME));assert.ok(signInPage.includes(input.PRIMARY_COLOR))
 assert.equal(new URL(state.appUrl).hostname,'127.0.0.1');assert.equal(new URL(state.appUrl).protocol,'http:')
 return origin
}
