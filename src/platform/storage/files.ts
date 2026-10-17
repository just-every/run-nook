import {erasedIntent} from '../../team/erasure/intent.mjs'
import {fullMember} from '../../team/access'
import {fail,text} from '../../family/team-chat/domain'
import {Context} from './context'
import {attachmentColumns} from './read'
import {erase} from '../../team/erasure/service'
export const MAX_FILE_BYTES=25*1024*1024
export async function inspectBytes(nameValue:any,mime:any,bytes:Uint8Array){const name=text(nameValue,120);if(/[\u0000-\u001f\u007f/\\<>:"|?*]/.test(nameValue))fail(400,'Invalid filename');if(!['text/plain','image/png','image/jpeg','application/pdf'].includes(mime))fail(415,'Unsupported file type');if(bytes.length<1||bytes.length>MAX_FILE_BYTES)fail(413,'File requires 1–26214400 bytes');const starts=(v:number[])=>v.every((x,i)=>bytes[i]===x);if(mime==='image/png'&&!starts([137,80,78,71,13,10,26,10])||mime==='image/jpeg'&&!starts([255,216,255])||mime==='application/pdf'&&!starts([37,80,68,70,45]))fail(415,'File signature mismatch');if(mime==='text/plain'){try{new TextDecoder('utf-8',{fatal:true}).decode(bytes)}catch{fail(415,'Plain text must be UTF-8')}if(bytes.includes(0))fail(415,'Plain text contains binary bytes')}const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as Uint8Array<ArrayBuffer>))).map(x=>x.toString(16).padStart(2,'0')).join('');return {name,mime,size:bytes.length,sha256}}
export async function readUpload(request:Request){const reader=request.body?.getReader(),chunks:Uint8Array[]=[];let size=0;if(!reader)fail(400,'File body required');while(true){const {value,done}=await reader!.read();if(done)break;size+=value.length;if(size>MAX_FILE_BYTES){await reader!.cancel();fail(413,'File exceeds 25 MiB')}chunks.push(value)}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}chunks.length=0;let name;try{name=decodeURIComponent(request.headers.get('x-filename')??'')}catch{fail(400,'Invalid filename encoding')}return {bytes,name,mime:request.headers.get('content-type'),intent:request.headers.get('x-upload-intent')}}
export async function upload(c:Context,conversation:string,input:Record<string,any>){let bytes=input.bytes as Uint8Array;if(!bytes){if(typeof input.data!=='string'||input.data.length>Math.ceil(MAX_FILE_BYTES/3)*4||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input.data))fail(400,'Canonical base64 required');const raw=atob(input.data);if(btoa(raw)!==input.data)fail(400,'Canonical base64 required');bytes=Uint8Array.from(raw,x=>x.charCodeAt(0))}const file=await inspectBytes(input.name,input.mime,bytes),intent=input.intent===undefined?crypto.randomUUID():text(input.intent,128);await c.writable(conversation);const digest=await erasedIntent(c.uid,intent);if(await c.one('SELECT 1 FROM nook_erased_attachments WHERE intent_digest=?',[digest],conversation))fail(409,'Upload intent was erased');let row=await c.one('SELECT * FROM nook_attachments WHERE author=? AND intent=?',[c.uid,intent],conversation);
 if(!row){if((await c.one("SELECT count(*) AS n FROM nook_attachments WHERE author=? AND state IN ('reserved','staged')",[c.uid],conversation)).n>=50)fail(429,'Too many staged uploads; remove unused uploads');const id=crypto.randomUUID(),key='private/'+crypto.randomUUID();try{await c.writeBatch([c.sql("INSERT INTO nook_attachments(id,conversation,author,message,name,mime,size,sha256,expires,state,created,object_key,intent) VALUES(?,?,?,NULL,?,?,?,?,?,'reserved',?,?,?)",id,conversation,c.uid,file.name,file.mime,file.size,file.sha256,Date.now()+86400000,new Date().toISOString(),key,intent)],conversation,`NOT EXISTS(SELECT 1 FROM nook_erased_attachments WHERE intent_digest=?) AND (SELECT count(*) FROM nook_attachments WHERE author=? AND state IN ('reserved','staged'))<50`,[digest,c.uid])}catch(error){row=await c.one('SELECT * FROM nook_attachments WHERE author=? AND intent=?',[c.uid,intent],conversation);if(!row)throw error}row??=await c.one('SELECT * FROM nook_attachments WHERE id=?',[id],conversation)}
 if(row.conversation!==conversation||row.name!==file.name||row.mime!==file.mime||row.size!==file.size||row.sha256!==file.sha256)fail(409,'Upload intent changed');if(row.state==='deleted'||row.expires<=Date.now()&&row.state!=='attached')fail(409,'Upload expired');
 if(row.state==='reserved')await putReserved(c,row,bytes,'staged');
 return c.one(`SELECT ${attachmentColumns} FROM nook_attachments WHERE id=?`,[row.id],conversation)
}
export async function download(c:Context,id:string){const row=await c.one(`SELECT * FROM nook_attachments WHERE id=? AND state IN ('staged','attached') AND (state='attached' OR (author=? AND expires>CAST(unixepoch('subsec')*1000 AS INTEGER))) AND EXISTS(SELECT 1 FROM nook_members WHERE conversation=nook_attachments.conversation AND user=?)`,[id,c.uid,c.uid]);if(!row)fail(404,'Attachment unavailable');const object=await c.env.FILES.get(row.object_key);if(!object||object.size!==row.size||object.customMetadata?.sha256!==row.sha256)fail(503,'File integrity unavailable');await c.check(row.conversation);const current=await c.one("SELECT id FROM nook_attachments WHERE id=? AND state IN ('staged','attached') AND sha256=? AND (state='attached' OR (author=? AND expires>CAST(unixepoch('subsec')*1000 AS INTEGER)))",[id,row.sha256,c.uid],row.conversation);if(!current)fail(404,'Attachment unavailable');return {metadata:{name:row.name,mime:row.mime,size:row.size},body:object!.body}}
export async function remove(c:Context,id:string){if(await c.one('SELECT id FROM nook_import_files WHERE attachment=?',[id]))fail(403,'Imported history files are immutable');const receipt=await erase(c,'attachment',id,{confirmation:'ERASE'},true);return {...await c.one(`SELECT ${attachmentColumns} FROM nook_attachment_history WHERE id=?`,[id]),receipt}}

export async function recoverDeletes(env:{DB:D1Database;FILES:R2Bucket}){
 const rows=await env.DB.prepare('SELECT object_key FROM nook_object_deletes d WHERE NOT EXISTS(SELECT 1 FROM nook_upload_attempts p WHERE p.object_key=d.object_key) AND NOT EXISTS(SELECT 1 FROM nook_attachments a WHERE a.object_key=d.object_key) ORDER BY created LIMIT 25').all<{object_key:string}>();
 for(const row of rows.results){try{
  const guard=crypto.randomUUID();
  await env.DB.batch([
   env.DB.prepare('INSERT INTO nook_guard VALUES(?,CASE WHEN NOT EXISTS(SELECT 1 FROM nook_upload_attempts WHERE object_key=?) AND NOT EXISTS(SELECT 1 FROM nook_attachments WHERE object_key=?) THEN 1 ELSE 0 END)').bind(guard,row.object_key,row.object_key),
   env.DB.prepare("UPDATE nook_import_objects SET state='deleting' WHERE object_key=?").bind(row.object_key),
   env.DB.prepare('DELETE FROM nook_guard WHERE id=?').bind(guard)
  ]);
  await env.FILES.delete(row.object_key);
  await env.DB.batch([env.DB.prepare("UPDATE nook_import_objects SET state='deleted' WHERE object_key=?").bind(row.object_key),env.DB.prepare('DELETE FROM nook_object_deletes WHERE object_key=?').bind(row.object_key)])
 }catch{await env.DB.prepare('UPDATE nook_object_deletes SET attempts=attempts+1 WHERE object_key=?').bind(row.object_key).run()}}
}

export async function putReserved(c:Context,row:any,bytes:Uint8Array,finalState:'staged'|'attached'){
 const attempt=crypto.randomUUID(),admission=finalState==='attached'?` AND ${fullMember('?')}`:'',admissionValues=finalState==='attached'?[c.uid]:[];
 await c.writeBatch([c.sql('INSERT INTO nook_upload_attempts VALUES(?,?,?)',attempt,row.object_key,Date.now())],row.conversation,`EXISTS(SELECT 1 FROM nook_attachments WHERE id=? AND object_key=? AND state IN ('reserved','staged','attached') AND (state='attached' OR expires>CAST(unixepoch('subsec')*1000 AS INTEGER)))${admission}`,[row.id,row.object_key,...admissionValues]);
 let durable=false;
 try{
  const object=await c.env.FILES.head(row.object_key);
  if(object&&(object.size!==row.size||object.customMetadata?.sha256!==row.sha256))fail(409,'Reserved object mismatch');
  if(!object)await c.env.FILES.put(row.object_key,bytes,{httpMetadata:{contentType:row.mime},customMetadata:{sha256:row.sha256}});
  durable=true;
  await c.writeBatch([c.sql("UPDATE nook_attachments SET state=? WHERE id=? AND state='reserved'",finalState,row.id),c.sql('DELETE FROM nook_upload_attempts WHERE id=?',attempt)],row.conversation,`EXISTS(SELECT 1 FROM nook_attachments WHERE id=? AND object_key=? AND state IN ('reserved','staged','attached') AND (state='attached' OR expires>CAST(unixepoch('subsec')*1000 AS INTEGER)))${admission}`,[row.id,row.object_key,...admissionValues]);
 }catch(error){
  // A successfully completed put no longer has a late writer. An uncertain put
  // keeps its durable attempt until paused reconciliation can retire it safely.
  if(durable){await c.sql('DELETE FROM nook_upload_attempts WHERE id=?',attempt).run();await recoverDeletes(c.env)}
  throw error;
 }
}
