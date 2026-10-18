import {fail} from '../family/team-chat/domain'
import {authority,type Context,type StorageBindings} from '../platform/storage/context'
import {erasedIntent} from '../team/erasure/intent.mjs'

type Template={schedule:string;attachment:string;position:number;name:string;mime:string;size:number;sha256:string;object_key:string}
type FileRow={id:string;conversation:string;author:string;state:string;object_key:string|null;name:string;mime:string;size:number;sha256:string|null;intent:string;expires:number}
function attachmentIds(ids:unknown):asserts ids is string[]{
 if(!Array.isArray(ids)||ids.length>5||ids.some(id=>typeof id!=='string'||!id.length||id.length>128)||new Set(ids).size!==ids.length)fail(400,'Choose up to five distinct scheduled attachments')
}
const eraseMetadata="state='deleted',message=NULL,position=NULL,name='',mime='application/octet-stream',size=0,sha256=NULL,object_key=NULL"

/** Returned statements belong inside the caller's version-fenced schedule batch.
 * The schedule must exist before these statements execute. No R2 write occurs. */
export async function prepareScheduleFiles(c:Context,schedule:string,conversation:string,ids:string[]):Promise<{statements:D1PreparedStatement[];fence:string;values:any[]}>{
 attachmentIds(ids)
 const existing=await c.rows<Template>('SELECT f.* FROM nook_schedule_files f JOIN nook_schedules s ON s.id=f.schedule WHERE f.schedule=? AND s.user=? AND s.conversation=?',[schedule,c.uid,conversation],conversation)
 const byId=new Map(existing.map(row=>[row.attachment,row])),incoming=new Map<string,FileRow>()
 for(const id of ids){
  if(byId.has(id))continue
  const row=await c.one<FileRow>("SELECT * FROM nook_attachments WHERE id=? AND author=? AND conversation=? AND state='staged' AND object_key IS NOT NULL AND expires>CAST(unixepoch('subsec')*1000 AS INTEGER)",[id,c.uid,conversation],conversation)
  if(!row)fail(400,'Scheduled attachment must be your unexpired staged upload in this conversation')
  incoming.set(id,row!)
 }
 const statements:D1PreparedStatement[]=[],fences:string[]=[],values:any[]=[]
 // Fence the complete old list, including order and byte identity, against an
 // erasure or another edit between this read and the committing transaction.
 fences.push('(SELECT count(*) FROM nook_schedule_files WHERE schedule=?)=?');values.push(schedule,existing.length)
 for(const row of existing){
  fences.push('EXISTS(SELECT 1 FROM nook_schedule_files WHERE schedule=? AND attachment=? AND position=? AND object_key=? AND sha256=?)')
  values.push(schedule,row.attachment,row.position,row.object_key,row.sha256)
 }
 for(const row of incoming.values()){
  fences.push("EXISTS(SELECT 1 FROM nook_attachments WHERE id=? AND author=? AND conversation=? AND state='staged' AND object_key=? AND sha256=? AND expires>CAST(unixepoch('subsec')*1000 AS INTEGER))")
  values.push(row.id,c.uid,conversation,row.object_key,row.sha256)
 }
 // Delete/reinsert bindings so swapping positions cannot violate the unique
 // ordered binding. Inventory triggers run within the same transaction.
 for(const row of existing)if(!ids.includes(row.attachment))statements.push(c.sql('INSERT OR IGNORE INTO nook_object_deletes(object_key,created) VALUES(?,?)',row.object_key,Date.now()))
 statements.push(c.sql('DELETE FROM nook_schedule_files WHERE schedule=?',schedule))
 for(let position=0;position<ids.length;position++){
  const id=ids[position],old=byId.get(id),upload=incoming.get(id),row=old??upload!
  // Transfer the existing bytes: the upload intent remains a tombstone rather
  // than becoming a second usable staged upload with the same object key.
  if(upload)statements.push(c.sql(`UPDATE nook_attachments SET ${eraseMetadata} WHERE id=?`,id))
  statements.push(c.sql('INSERT INTO nook_schedule_files(schedule,attachment,position,name,mime,size,sha256,object_key) VALUES(?,?,?,?,?,?,?,?)',schedule,id,position,row.name,row.mime,row.size,row.sha256,row.object_key))
 }
 return {statements,fence:fences.join(' AND '),values}
}

async function digest(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),byte=>byte.toString(16).padStart(2,'0')).join('')}
async function guarded(env:StorageBindings,guard:string,values:any[],statements:D1PreparedStatement[]){
 const key=crypto.randomUUID()
 await env.DB.batch([env.DB.prepare(`INSERT INTO nook_guard VALUES(?,CASE WHEN ${authority} AND (${guard}) THEN 1 ELSE 0 END)`).bind(key,...values),...statements,env.DB.prepare('DELETE FROM nook_guard WHERE id=?').bind(key)])
}
function matches(row:FileRow,template:Template,schedule:any,intent:string,key:string){return row.author===schedule.user&&row.conversation===schedule.conversation&&row.intent===intent&&row.object_key===key&&row.name===template.name&&row.mime===template.mime&&row.size===template.size&&row.sha256===template.sha256}

/** Copies each template to a normal private native upload. The supplied guard
 * must fence the complete active occurrence, actor, audience and posting rules.
 * The caller also fences returned staged IDs in its final message transaction. */
export async function materializeOccurrenceFiles(env:StorageBindings,schedule:any,guard:string,guardValues:any[]):Promise<string[]>{
 const ids=JSON.parse(schedule.payload).attachments;attachmentIds(ids)
 const templates=(await env.DB.prepare('SELECT * FROM nook_schedule_files WHERE schedule=? ORDER BY position').bind(schedule.id).all<Template>()).results
 if(templates.length!==ids.length||templates.some((row,index)=>row.attachment!==ids[index]||row.position!==index))fail(409,'Scheduled attachment bindings changed; review the message')
 const result:string[]=[],copies=await Promise.all(templates.map(async template=>({template,hash:await digest(JSON.stringify([schedule.id,schedule.version,schedule.local_at,template.attachment]))})))
 try{for(const {template,hash} of copies){
  const id='scheduled-file:'+hash,intent='scheduled-template:'+template.attachment+':'+hash,objectPath='private/scheduled/'+hash
  const sql=(statement:string,...values:any[])=>env.DB.prepare(statement).bind(...values)
  const templateGuard='EXISTS(SELECT 1 FROM nook_schedule_files WHERE schedule=? AND attachment=? AND object_key=? AND sha256=?)'
  const current=`(${guard}) AND ${templateGuard} AND NOT EXISTS(SELECT 1 FROM nook_erased_attachments WHERE intent_digest=?)`,currentValues=[...guardValues,schedule.id,template.attachment,template.object_key,template.sha256,await erasedIntent(schedule.user,intent)]
  await guarded(env,`${current} AND (EXISTS(SELECT 1 FROM nook_attachments WHERE id=?) OR (SELECT count(*) FROM nook_attachments WHERE author=? AND state IN ('reserved','staged'))<50)`,[...currentValues,id,schedule.user],[sql("INSERT INTO nook_attachments(id,conversation,author,message,name,mime,size,sha256,expires,state,created,object_key,intent) VALUES(?,?,?,NULL,?,?,?,?,?,'reserved',?,?,?) ON CONFLICT(id) DO NOTHING",id,schedule.conversation,schedule.user,template.name,template.mime,template.size,template.sha256,Date.now()+86_400_000,new Date().toISOString(),objectPath,intent)])
  const row=await sql('SELECT * FROM nook_attachments WHERE id=?',id).first<FileRow>()
  if(!row||!matches(row,template,schedule,intent,objectPath)||!['reserved','staged'].includes(row.state)||row.expires<=Date.now())fail(409,'Scheduled attachment copy is unavailable; review the message')
  const copyGuard=`${current} AND EXISTS(SELECT 1 FROM nook_attachments WHERE id=? AND object_key=? AND state IN ('reserved','staged') AND expires>CAST(unixepoch('subsec')*1000 AS INTEGER))`,copyValues=[...currentValues,id,objectPath],attempt=crypto.randomUUID()
  await guarded(env,copyGuard,copyValues,[sql('INSERT INTO nook_upload_attempts VALUES(?,?,?)',attempt,objectPath,Date.now())])
  let uncertainPut=false
  try{
   const object=await env.FILES.head(objectPath)
   if(object&&(object.size!==template.size||object.customMetadata?.sha256!==template.sha256))fail(409,'Scheduled attachment copy integrity mismatch')
   if(!object){
    const source=await env.FILES.get(template.object_key)
    if(!source||source.size!==template.size||source.customMetadata?.sha256!==template.sha256)fail(503,'Scheduled attachment bytes are unavailable or changed')
    uncertainPut=true
    await env.FILES.put(objectPath,source!.body,{httpMetadata:{contentType:template.mime},customMetadata:{sha256:template.sha256}})
    uncertainPut=false
   }
   await guarded(env,copyGuard,copyValues,[sql("UPDATE nook_attachments SET state='staged' WHERE id=? AND state='reserved'",id),sql('DELETE FROM nook_upload_attempts WHERE id=?',attempt)])
  }catch(error){
   // A failed/uncertain put leaves a durable attempt. Never expire that marker:
   // paused reconciliation must rule out a late writer before deleting bytes.
   if(!uncertainPut)await sql('DELETE FROM nook_upload_attempts WHERE id=?',attempt).run()
   throw error
  }
  result.push(id)
 }}catch(error){throw Object.assign(error instanceof Error?error:new Error('Scheduled attachment copy failed',{cause:error}),{occurrenceFileIds:copies.map(copy=>'scheduled-file:'+copy.hash)})}
 return result
}

/** Safe after a failed or uncertain send: attached files are never touched.
 * Upload attempts remain until existing paused reconciliation resolves them. */
export async function cleanupOccurrenceFiles(env:StorageBindings,ids:string[]):Promise<void>{
 attachmentIds(ids)
 if(ids.some(id=>!/^scheduled-file:[a-f0-9]{64}$/.test(id)))fail(400,'Invalid scheduled attachment copy')
 if(!ids.length)return
 const list=JSON.stringify(ids)
 await env.DB.batch([
  env.DB.prepare("INSERT OR IGNORE INTO nook_object_deletes(object_key,created) SELECT object_key,? FROM nook_attachments WHERE id IN (SELECT value FROM json_each(?)) AND state IN ('reserved','staged') AND object_key IS NOT NULL").bind(Date.now(),list),
  env.DB.prepare(`UPDATE nook_attachments SET ${eraseMetadata} WHERE id IN (SELECT value FROM json_each(?)) AND state IN ('reserved','staged')`).bind(list),
 ])
}
