import assert from 'node:assert/strict'
import {chromium,expect} from '@playwright/test'
import {invite,signIn} from './auth-support.mjs'
import {keyed,devKey} from './dev-key.mjs'
import {runErasureBrowser} from './erasure-browser.mjs'

// All fixtures enter through the installation's invitation, conversation,
// binary upload and message routes; there are no replacement app responses.
export async function runErasureJourney({origin,ownerCookie,destination}){
 const browser=await keyed(chromium).launch({headless:true})
 const tag=crypto.randomUUID().slice(0,8)
 const request=async(cookie,path,data)=>{
  const response=await fetch(origin+path,{method:'POST',headers:{cookie,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(data)})
  assert.equal(response.status,200,path);return response.json()
 }
 const adminName=`ErasureAdmin${tag}`,email=adminName.toLowerCase()+'@example.test'
 try{
  const channels=await(await fetch(origin+'/api/conversations',{headers:{cookie:ownerCookie}})).json()
  const welcome=channels.find(c=>c.kind==='channel');assert.ok(welcome)
  await request(ownerCookie,'/api/team/invitations',{email,role:'admin',mode:'member',scopes:[welcome.id]})
  const invited=await fetch(origin+'/auth/invite',{method:'POST',headers:{cookie:ownerCookie,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email,displayName:adminName,role:'admin',returnTo:'/app'})})
  assert.equal(invited.status,202)
  const admin=await signIn(origin,email,{requestLink:false}),viewer=await invite(origin,ownerCookie,`ErasureViewer${tag}`)
  const makeMember=async label=>{
   const memberName=`ErasureMember${tag}${label}`,member=await invite(origin,ownerCookie,memberName)
   const channel=await request(ownerCookie,'/api/conversations',{name:`Erasure room ${tag} ${label}`,kind:'channel'})
   for(const person of [member,admin,viewer])await request(ownerCookie,`/api/conversations/${channel.id}/members`,{user:person.user.id})
   const messageBody=`Channel erasure ${tag} ${label}`
   await request(member.cookie,`/api/conversations/${channel.id}/messages`,{body:messageBody,intent:crypto.randomUUID()})
   const dm=await request(member.cookie,'/api/conversations',{kind:'dm',participants:[viewer.user.id]})
   const dmBody=`Private erasure ${tag} ${label}`,dmFile=`private-${tag}-${label}.txt`
   const uploaded=await fetch(origin+`/api/conversations/${dm.id}/attachments`,{method:'POST',headers:{cookie:member.cookie,Origin:origin,'Content-Type':'text/plain','X-Filename':encodeURIComponent(dmFile),'X-Upload-Intent':crypto.randomUUID()},body:'Private erasure fixture bytes'})
   assert.equal(uploaded.status,200);const file=await uploaded.json()
   const dmMessage=await request(member.cookie,`/api/conversations/${dm.id}/messages`,{body:dmBody,intent:crypto.randomUUID(),attachments:[file.id]})
   return {memberId:member.user.id,memberName,channel:channel.id,messageBody,dm:dm.id,dmBody,dmFile,dmMessage:dmMessage.id}
  }
  // Delay a real pending erasure acknowledgement at the network edge. The
  // accepted server work must complete even when Escape closes the modal.
  const pauseErasure=async(page,memberId)=>{
   let release,receipt,arrived=false,finished
   const gate=new Promise(resolve=>{release=resolve}),done=new Promise(resolve=>{finished=resolve})
   const pattern='**/api/erasures'
   const handler=async route=>{
    const req=route.request()
    if(req.method()!=='POST'||req.postDataJSON().target!==memberId){await route.continue();return}
    try{
     const response=await route.fetch();assert.equal(response.status(),200)
     receipt=await response.json();assert.equal(receipt.state,'pending','server accepted real pending work')
     arrived=true;await gate;await route.fulfill({response})
    }finally{finished()}
   }
   await page.route(pattern,handler)
   return {
    pending:()=>expect.poll(()=>arrived,{timeout:30000}).toBe(true),
    release,
    complete:async()=>{
     await done;await page.unroute(pattern,handler)
     await expect.poll(async()=>{
      const response=await fetch(origin+`/api/erasures/${receipt.id}`,{headers:{cookie:ownerCookie}})
      assert.equal(response.status,200);return (await response.json()).state
     },{timeout:60000}).toBe('complete')
    }
   }
  }
  return await runErasureBrowser({browser,origin,devKey,ownerCookie,adminCookie:admin.cookie,viewerCookie:viewer.cookie,makeMember,pauseErasure,destination})
 }finally{await browser.close()}
}
