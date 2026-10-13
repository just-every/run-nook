import {validateImportCapture,importDigest} from './import-capture.mjs'
const check=(ok,message)=>{if(!ok)throw Error(message)}
const keys=(v,names)=>v&&Object.keys(v).sort().join()===names.sort().join()
export const importTables=['history_imports','imported_channels','imported_actors','imported_records','imported_files']
export function validateImports(s){
 const ids=new Set([...s.messages,...s.attachments].map(x=>x.id)),sources=new Set(),intents=new Set(),jobs=new Set(),destinations=new Set();let bytes=s.attachments.reduce((n,a)=>n+a.size,0)
 for(const j of s.imports){
  check(keys(j,['id','owner','intent','planDigest','captureDigest','created','capture','channels','records','files'])&&typeof j.id==='string'&&!jobs.has(j.id)&&s.users.some(u=>u.id===j.owner)&&typeof j.intent==='string'&&/^[A-Za-z0-9_.-]{1,128}$/.test(j.intent)&&Number.isFinite(Date.parse(j.created)),'Invalid import receipt');jobs.add(j.id)
  const intent=j.owner+'|'+j.intent;check(!intents.has(intent),'Duplicate import intent');intents.add(intent)
  const capture=j.capture,checked=validateImportCapture(capture)
  check(checked.captureDigest===j.captureDigest&&importDigest({policy:'immutable-new-private-v1',owner:j.owner,captureDigest:checked.captureDigest})===j.planDigest,'Imported provenance digest mismatch')
  for(const [field,expected]of [['channels',capture.channels],['records',capture.records],['files',capture.files]])check(Array.isArray(j[field])&&j[field].length===expected.length,'Invalid import bindings')
  const channelKeys=new Set(),recordKeys=new Set(),fileKeys=new Set()
  for(const c of j.channels){const original=capture.channels.find(x=>x.sourceId===c.sourceId),target=s.conversations.find(x=>x.id===c.id);check(keys(c,['sourceId','id'])&&original&&!channelKeys.has(c.sourceId)&&!destinations.has(c.id)&&target?.kind==='private'&&target.owner===j.owner&&original.audience.includes(j.owner)&&original.audience.every(id=>s.users.some(u=>u.id===id)),'Imported destination invalid');channelKeys.add(c.sourceId);destinations.add(c.id)}
  for(const a of capture.actors)check(a.association===null||s.users.some(u=>u.id===a.association),'Imported association invalid')
  for(const r of j.records){check(keys(r,['key','id'])&&checked.records.has(r.key)&&!recordKeys.has(r.key)&&!sources.has(r.key)&&typeof r.id==='string'&&r.id&&!ids.has(r.id),'Imported record identity invalid');recordKeys.add(r.key);sources.add(r.key);ids.add(r.id)}
  for(const f of j.files){const key=f.message+':'+f.sourceId;check(keys(f,['message','sourceId','id'])&&checked.files.has(key)&&!fileKeys.has(key)&&typeof f.id==='string'&&f.id&&!ids.has(f.id),'Imported file identity invalid');fileKeys.add(key);ids.add(f.id)}
  bytes+=checked.total
 }
 check(bytes<=16*1024*1024,'Restored media quota exceeded')
}
export function mapRootImports(rows){
 for(const t of importTables)check(Array.isArray(rows[t]),'Missing import archive table')
 const columns={history_imports:['id','owner','intent','source_namespace','preview_digest','capture_digest','plan_digest','source_receipts','created'],imported_channels:['job','source_id','conversation','destination_name','audience','source_record'],imported_actors:['job','source_id','association','source_record'],imported_records:['id','job','conversation','source_key','source_channel','source_actor','source_timestamp','thread_root','body','source_record','files'],imported_files:['id','job','conversation','message','source_id','name','mime','size','sha256','data']}
 for(const t of importTables)for(const r of rows[t])check(keys(r,columns[t])&&(t==='history_imports'||rows.history_imports.some(j=>j.id===r.job)),'Invalid imported archive columns/reference')
 return rows.history_imports.map(j=>{
  const channels=rows.imported_channels.filter(c=>c.job===j.id),actors=rows.imported_actors.filter(a=>a.job===j.id),records=rows.imported_records.filter(r=>r.job===j.id),files=rows.imported_files.filter(f=>f.job===j.id)
  for(const r of records)check(channels.some(c=>c.source_id===r.source_channel&&c.conversation===r.conversation),'Imported message scope invalid')
  for(const f of files)check(records.some(r=>r.id===f.message&&r.conversation===f.conversation),'Imported file scope invalid')
  const capture={version:1,mode:'private-source-capture',targetAuthorityVerified:false,sourceNamespace:j.source_namespace,previewDigest:j.preview_digest,sourceReceipts:JSON.parse(j.source_receipts),channels:channels.map(c=>({sourceId:c.source_id,destinationName:c.destination_name,audience:JSON.parse(c.audience),sourceRecord:JSON.parse(c.source_record)})),actors:actors.map(a=>({sourceId:a.source_id,association:a.association,sourceRecord:JSON.parse(a.source_record)})),records:records.map(r=>({key:r.source_key,channel:r.source_channel,sourceActor:r.source_actor,sourceTimestamp:r.source_timestamp,threadRoot:r.thread_root,body:r.body,sourceRecord:JSON.parse(r.source_record),files:JSON.parse(r.files)})),files:files.map(f=>({message:records.find(r=>r.id===f.message).source_key,sourceId:f.source_id,name:f.name,mime:f.mime,size:f.size,sha256:f.sha256,data:f.data}))}
  return {id:j.id,owner:j.owner,intent:j.intent,created:j.created,planDigest:j.plan_digest,captureDigest:j.capture_digest,capture,channels:channels.map(c=>({sourceId:c.source_id,id:c.conversation})),records:records.map(r=>({key:r.source_key,id:r.id})),files:files.map(f=>({message:records.find(r=>r.id===f.message).source_key,sourceId:f.source_id,id:f.id}))}
 })
}
