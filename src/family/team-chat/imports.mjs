// Immutable external history. The repository commits this policy in its D1 CAS.
import {randomUUID} from 'node:crypto'
import {Fault} from './fault.mjs'
import {validateImportCapture,importDigest} from './import-capture.mjs'
const fail=(status,message)=>{throw new Fault(status,message)}
const active=(s,u)=>s.users.some(x=>x.id===u.id&&x.active)||fail(401,'Sign in required')
const acl=(s,u,id)=>s.conversations.find(c=>c.id===id&&c.members.includes(u.id))||fail(403,'Conversation access denied')
const planDigest=(owner,captureDigest)=>importDigest({policy:'immutable-new-private-v1',owner,captureDigest})
export const importedBytes=s=>s.imports.reduce((n,j)=>n+j.capture.files.reduce((n,f)=>n+f.size,0),0)
export function importPlan(s,u,capture){
 active(s,u);const checked=validateImportCapture(capture)
 for(const c of checked.channels.values()){
  if(!c.audience.includes(u.id))fail(400,'Import owner must be in exact audience')
  for(const uid of c.audience)if(!s.users.some(x=>x.id===uid&&x.active))fail(400,'Import audience unavailable')
 }
 for(const a of checked.actors.values())if(a.association&&!s.users.some(x=>x.id===a.association&&x.active))fail(400,'Import association unavailable')
 return {mode:'authenticated-new-private-plan',planDigest:planDigest(u.id,checked.captureDigest),captureDigest:checked.captureDigest,immutable:true,sourceAuthenticityVerified:false,counts:{channels:checked.channels.size,actors:checked.actors.size,records:checked.records.size,files:checked.files.size,bytes:checked.total},destinations:[...checked.channels.values()].map(c=>({sourceId:c.sourceId,name:c.destinationName,kind:'private',audience:[...c.audience]}))}
}
function receipt(s,u,j){active(s,u);for(const c of j.channels)acl(s,u,c.id);return {id:j.id,planDigest:j.planDigest,captureDigest:j.captureDigest,immutable:true,channels:j.channels}}
export function applyImport(s,u,input){
 if(!input||Object.keys(input).sort().join()!=='capture,intent,planDigest'||typeof input.intent!=='string'||!/^[A-Za-z0-9_.-]{1,128}$/.test(input.intent))fail(400,'Import intent/approval invalid')
 active(s,u);const checked=validateImportCapture(input.capture),expected=planDigest(u.id,checked.captureDigest)
 if(input.planDigest!==expected)fail(409,'Import approval changed')
 const old=s.imports.find(j=>j.owner===u.id&&j.intent===input.intent)
 if(old){if(old.planDigest!==expected||old.captureDigest!==checked.captureDigest)fail(409,'Import intent changed');return receipt(s,u,old)}
 importPlan(s,u,input.capture)
 if(s.attachments.reduce((n,a)=>n+a.size,0)+importedBytes(s)+checked.total>16*1024*1024)fail(413,'Workspace media quota exceeded')
 const keys=new Set(s.imports.flatMap(j=>j.capture.records.map(r=>r.key)))
 for(const r of checked.records.values())if(keys.has(r.key))fail(409,'Source history already imported with another intent')
 const j={id:randomUUID(),owner:u.id,intent:input.intent,planDigest:expected,captureDigest:checked.captureDigest,created:new Date().toISOString(),capture:structuredClone(input.capture),channels:input.capture.channels.map(c=>({sourceId:c.sourceId,id:randomUUID()})),records:input.capture.records.map(r=>({key:r.key,id:randomUUID()})),files:input.capture.files.map(f=>({message:f.message,sourceId:f.sourceId,id:randomUUID()}))}
 for(const c of input.capture.channels){s.conversations.push({id:j.channels.find(x=>x.sourceId===c.sourceId).id,name:c.destinationName,kind:'private',owner:u.id,seq:0,members:[...c.audience]})}
 s.imports.push(j);return receipt(s,u,j)
}
function order(a,b){const [ai,af]=a.sourceTimestamp.split('.'),[bi,bf]=b.sourceTimestamp.split('.'),x=ai.replace(/^0+(?=\d)/,''),y=bi.replace(/^0+(?=\d)/,'');return x.length-y.length||(x<y?-1:x>y?1:0)||(af<bf?-1:af>bf?1:0)||a.key.localeCompare(b.key)}
function projection(j,r){const actor=j.capture.actors.find(a=>a.sourceId===r.sourceActor);return {id:j.records.find(x=>x.key===r.key).id,conversation:j.channels.find(c=>c.sourceId===r.channel).id,body:r.body,immutable:true,provenance:{namespace:j.capture.sourceNamespace,key:r.key,actor:r.sourceActor,label:actor.sourceRecord.name??r.sourceActor,association:actor.association,timestamp:r.sourceTimestamp,sourceRecord:r.sourceRecord},parent:r.threadRoot?j.records.find(x=>x.key===r.threadRoot).id:null,attachments:j.capture.files.filter(f=>f.message===r.key).map(f=>({id:j.files.find(x=>x.message===f.message&&x.sourceId===f.sourceId).id,source_id:f.sourceId,name:f.name,mime:f.mime,size:f.size,sha256:f.sha256}))}}
export function importedHistory(s,u,id,{after='',limit=100}={}){
 active(s,u);acl(s,u,id);if(typeof after!=='string'||!Number.isSafeInteger(limit)||limit<1||limit>1000)fail(400,'Invalid imported history page')
 const j=s.imports.find(j=>j.channels.some(c=>c.id===id)),channel=j?.channels.find(c=>c.id===id),all=j?j.capture.records.filter(r=>r.channel===channel.sourceId).sort(order).map(r=>projection(j,r)):[]
 let offset=0;if(after){offset=all.findIndex(r=>r.id===after)+1;if(!offset)fail(400,'Imported history cursor unavailable')}
 const records=all.slice(offset,offset+limit);return {records,cursor:records.at(-1)?.id??after,hasMore:offset+records.length<all.length}
}
export function searchImportedHistory(s,u,q){active(s,u);if(typeof q!=='string'||!q.trim()||q.length>128)fail(400,'Invalid imported search');return s.imports.flatMap(j=>j.capture.records.filter(r=>s.conversations.some(c=>c.id===j.channels.find(c=>c.sourceId===r.channel).id&&c.members.includes(u.id))&&r.body.toLowerCase().includes(q.trim().toLowerCase())).map(r=>({j,r}))).sort((a,b)=>order(b.r,a.r)).slice(0,100).map(({j,r})=>{const value=projection(j,r);delete value.provenance.sourceRecord;delete value.attachments;return value})}
export function importedFile(s,u,id){active(s,u);const j=s.imports.find(j=>j.files.some(f=>f.id===id))||fail(404,'Imported file missing'),binding=j.files.find(f=>f.id===id),f=j.capture.files.find(f=>f.message===binding.message&&f.sourceId===binding.sourceId),r=j.capture.records.find(r=>r.key===f.message);acl(s,u,j.channels.find(c=>c.sourceId===r.channel).id);return {metadata:{name:f.name,mime:f.mime},bytes:Buffer.from(f.data,'base64')}}
