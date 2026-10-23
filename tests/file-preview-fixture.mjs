import {zipFixture} from './slack-import/fixture.mjs'
import {importDoorClient} from './import-door-support.mjs'
import assert from 'node:assert/strict'
// Synthetic arbitrary-type files enter through the existing, reviewed importer.
// Native upload admission is deliberately unchanged by the preview feature.
export async function importedPreviewFiles({origin,owner,member,files}){
 const base=typeof origin==='function'?origin():origin,actors={syntheticnook1:owner.user.id,syntheticnook2:member.user.id}
 const rows=[{type:'version',version:1,info:{generator:'mattermost-server',version:'12.0.0',created:'2026-10-01T00:00:00Z'}},{type:'team',team:{name:'syntheticnook',type:'I'}},{type:'channel',channel:{team:'syntheticnook',name:'previews',type:'P'}},...Object.keys(actors).map(username=>({type:'user',user:{username,teams:[{name:'syntheticnook',channels:[{name:'previews'}]}]}})),{type:'post',post:{team:'syntheticnook',channel:'previews',user:'syntheticnook1',create_at:1720000000000,message:'Synthetic preview attachments',reactions:[],attachments:files.map(file=>({path:file.name}))}}]
 const bytes=zipFixture([['import.jsonl',rows.map(row=>JSON.stringify(row)).join('\n')],...files.map(file=>['data/'+file.name,Buffer.from(file.bytes)])])
 const door=importDoorClient({origin:base,owner,source:'mattermost',users:async()=>[owner,member].map(actor=>({...actor.user,active:true,mode:'member'}))}),source=await door.inspect(bytes),review={namespace:'synthetic-nook-preview-'+crypto.randomUUID(),actors,roles:{},acceptedOmissions:[]}
 let plan=await door.plan(source,review);if(plan.needsOmissionReview){review.acceptedOmissions=[plan.omissionDigest];plan=await door.plan(source,review)}await door.finish(plan)
 const conversation=(await door.status(plan)).destinations[0].id,response=await fetch(base+`/api/conversations/${conversation}/messages`,{headers:{cookie:owner.cookie}});assert.equal(response.status,200);const messages=await response.json()
 return {conversation,files:messages.flatMap(message=>message.attachments)}
}
