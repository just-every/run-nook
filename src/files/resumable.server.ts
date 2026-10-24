import {context,type Context,type StorageBindings} from '../platform/storage/context';
import {attachmentColumns} from '../platform/storage/read';
import {readFilePolicy,enforceFilePolicy,filePolicyVersion} from './policy.server';
import {erasedIntent} from '../team/erasure/intent.mjs';
import {fail,text,Fault} from '../family/team-chat/domain';
import {sha256} from '@noble/hashes/sha2.js';
export const LARGE_FILE_LIMIT=1024*1024*1024,PART_SIZE=8*1024*1024;
const hex=(bytes:Uint8Array)=>Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
async function owned(c:Context,id:string){const row=await c.one('SELECT a.*,u.multipart_id FROM nook_attachments a LEFT JOIN nook_multipart_uploads u ON u.attachment=a.id WHERE a.id=? AND a.author=?',[id,c.uid]);if(!row)fail(404,'Upload unavailable');await c.check(row.conversation);if(row.state==='deleted'||row.state==='reserved'&&row.expires<=Date.now())fail(409,'Upload expired');return row}
export async function declareUpload(c:Context,conversation:string,input:any){
 const name=text(input.name,120),intent=text(input.intent,128),mime=text(input.mime,255);
 if(/[\u0000-\u001f\u007f/\\<>:"|?*]/.test(name)||!Number.isSafeInteger(input.size)||input.size<1||input.size>LARGE_FILE_LIMIT||!/^[a-f0-9]{64}$/.test(input.sha256)||!/^[-a-zA-Z0-9!#$&^_.+]+\/[-a-zA-Z0-9!#$&^_.+]+$/.test(mime))fail(400,'Declare a filename, MIME type, SHA-256 and size from 1 byte to 1 GiB');
 await c.writable(conversation);const policy=await readFilePolicy(c.db);enforceFilePolicy(policy,name,input.size);
 const digest=await erasedIntent(c.uid,intent);if(await c.one('SELECT 1 FROM nook_erased_attachments WHERE intent_digest=?',[digest],conversation))fail(409,'Upload intent was erased');
 let row=await c.one('SELECT id FROM nook_attachments WHERE author=? AND intent=?',[c.uid,intent],conversation);
 if(!row){const id=crypto.randomUUID();await c.writeBatch([c.sql("INSERT INTO nook_attachments(id,conversation,author,message,name,mime,size,sha256,expires,state,created,object_key,intent) VALUES(?,?,?,NULL,?,?,?,?,?,'reserved',?,?,?)",id,conversation,c.uid,name,mime,input.size,input.sha256,Date.now()+86400000,new Date().toISOString(),'private/'+crypto.randomUUID(),intent)],conversation,`NOT EXISTS(SELECT 1 FROM nook_erased_attachments WHERE intent_digest=?) AND (SELECT count(*) FROM nook_attachments WHERE author=? AND state IN ('reserved','staged'))<50 AND ${filePolicyVersion}=?`,[digest,c.uid,policy.version]);row={id};}
 await c.writeBatch([c.sql("INSERT OR IGNORE INTO nook_multipart_uploads SELECT id,object_key,NULL,expires FROM nook_attachments WHERE id=? AND state='reserved'",row.id)],conversation);
 const current=await owned(c,row.id);if(current.name!==name||current.mime!==mime||current.size!==input.size||current.sha256!==input.sha256||current.conversation!==conversation)fail(409,'Upload intent changed');
 await c.hint();return uploadStatus(c,row.id);
}
export async function uploadStatus(c:Context,id:string){const row=await owned(c,id),parts=await c.rows('SELECT part,size,sha256 FROM nook_multipart_parts WHERE attachment=? ORDER BY part',[id],row.conversation);return {id:row.id,state:row.state,partSize:PART_SIZE,parts,file:row.state==='reserved'?null:await c.one(`SELECT ${attachmentColumns} FROM nook_attachments WHERE id=?`,[id],row.conversation)}}
async function attempt(c:Context,row:any){const id=crypto.randomUUID();await c.writeBatch([c.sql('INSERT INTO nook_upload_attempts VALUES(?,?,?)',id,row.object_key,Date.now())],row.conversation,"EXISTS(SELECT 1 FROM nook_attachments WHERE id=? AND state='reserved' AND expires>?) AND NOT EXISTS(SELECT 1 FROM nook_upload_attempts WHERE object_key=?)",[row.id,Date.now(),row.object_key]);return id}
export async function uploadPart(c:Context,id:string,part:number,bytes:Uint8Array){
 const row=await owned(c,id);await c.writable(row.conversation);if(row.state!=='reserved')return uploadStatus(c,id);
 const count=Math.ceil(row.size/PART_SIZE),expected=part===count?row.size-(count-1)*PART_SIZE:PART_SIZE;
 if(!Number.isSafeInteger(part)||part<1||part>count||bytes.length!==expected)fail(400,'Upload the next complete chunk with its declared size');
 const checksum=hex(sha256(bytes)),prior=await c.one('SELECT * FROM nook_multipart_parts WHERE attachment=? AND part=?',[id,part],row.conversation);
 if(prior){if(prior.sha256!==checksum||prior.size!==bytes.length)fail(409,'Chunk intent changed');return uploadStatus(c,id)}
 const next=(await c.one('SELECT count(*) AS n FROM nook_multipart_parts WHERE attachment=?',[id],row.conversation)).n+1;if(part!==next)fail(409,'Upload chunks in order');
 const policy=await readFilePolicy(c.db);enforceFilePolicy(policy,row.name,row.size);
 const claim=await attempt(c,row);let durable=false;
 try{
  let multipart=row.multipart_id;
  if(!multipart){const created=await c.env.FILES.createMultipartUpload(row.object_key,{httpMetadata:{contentType:row.mime},customMetadata:{sha256:row.sha256}});multipart=created.uploadId;await c.writeBatch([c.sql('UPDATE nook_multipart_uploads SET multipart_id=? WHERE attachment=?',multipart,id)],row.conversation,'EXISTS(SELECT 1 FROM nook_attachments WHERE id=? AND state=\'reserved\')',[id]);}
  const receipt=await c.env.FILES.resumeMultipartUpload(row.object_key,multipart).uploadPart(part,bytes);
  durable=true;
  await c.writeBatch([c.sql('INSERT INTO nook_multipart_parts VALUES(?,?,?,?,?)',id,part,bytes.length,checksum,receipt.etag),c.sql('DELETE FROM nook_upload_attempts WHERE id=?',claim)],row.conversation,"EXISTS(SELECT 1 FROM nook_attachments WHERE id=? AND state='reserved') AND (SELECT count(*) FROM nook_multipart_parts WHERE attachment=?)=?",[id,id,part-1]);
 }catch(error){if(durable)await c.sql('DELETE FROM nook_upload_attempts WHERE id=?',claim).run();throw error}
 return uploadStatus(c,id);
}
export async function completeUpload(c:Context,id:string){
 const row=await owned(c,id);if(row.state!=='reserved')return uploadStatus(c,id);await c.writable(row.conversation);
 const parts=await c.rows('SELECT part,etag,size FROM nook_multipart_parts WHERE attachment=? ORDER BY part',[id],row.conversation);
 if(parts.length!==Math.ceil(row.size/PART_SIZE)||parts.reduce((n,p)=>n+p.size,0)!==row.size||!row.multipart_id)fail(409,'Upload has missing chunks');
 const claim=await attempt(c,row);let durable=false;
 try{
  if(!await c.env.FILES.head(row.object_key))await c.env.FILES.resumeMultipartUpload(row.object_key,row.multipart_id).complete(parts.map(p=>({partNumber:p.part,etag:p.etag})));
  const object=await c.env.FILES.get(row.object_key);if(!object||object.size!==row.size)fail(409,'Completed file size changed');
  const hash=sha256.create(),reader=object!.body.getReader();for(;;){const {done,value}=await reader!.read();if(done)break;hash.update(value)}
  if(hex(hash.digest())!==row.sha256)fail(409,'Completed file checksum changed');durable=true;
  await c.writeBatch([c.sql("UPDATE nook_attachments SET state='staged' WHERE id=? AND state='reserved'",id),c.sql('DELETE FROM nook_multipart_parts WHERE attachment=?',id),c.sql('DELETE FROM nook_multipart_uploads WHERE attachment=?',id),c.sql('DELETE FROM nook_upload_attempts WHERE id=?',claim)],row.conversation,"EXISTS(SELECT 1 FROM nook_attachments WHERE id=? AND state='reserved' AND expires>?)",[id,Date.now()]);
 }catch(error){if(durable)await c.sql('DELETE FROM nook_upload_attempts WHERE id=?',claim).run();throw error}
 return uploadStatus(c,id);
}
export async function expireMultipart(env:Pick<StorageBindings,'DB'|'FILES'>){
 const rows=(await env.DB.prepare('SELECT u.* FROM nook_multipart_uploads u WHERE (u.expires<=? OR NOT EXISTS(SELECT 1 FROM nook_attachments a WHERE a.id=u.attachment)) AND NOT EXISTS(SELECT 1 FROM nook_upload_attempts p WHERE p.object_key=u.object_key) LIMIT 25').bind(Date.now()).all<any>()).results;
 for(const row of rows){try{if(row.multipart_id)await env.FILES.resumeMultipartUpload(row.object_key,row.multipart_id).abort()}catch(error){if(!/NoSuchUpload|does not exist|not found/i.test(String(error)))continue}
  await env.DB.batch([env.DB.prepare('DELETE FROM nook_multipart_parts WHERE attachment=?').bind(row.attachment),env.DB.prepare('DELETE FROM nook_multipart_uploads WHERE attachment=?').bind(row.attachment),env.DB.prepare("INSERT OR IGNORE INTO nook_object_deletes(object_key,created) SELECT object_key,? FROM nook_attachments WHERE id=? AND state='reserved'").bind(Date.now(),row.attachment),env.DB.prepare("DELETE FROM nook_attachments WHERE id=? AND state='reserved'").bind(row.attachment)]);
 }
}
export async function resumableRoute(env:StorageBindings,request:Request):Promise<Response|null>{
 const path=new URL(request.url).pathname,declare=path.match(/^\/api\/conversations\/([^/]+)\/uploads$/),operation=path.match(/^\/api\/uploads\/([^/]+)(?:\/(complete|parts)(?:\/(\d+))?)?$/);if(!declare&&!operation)return null;
 try{const c=await context(env,request.headers);await c.check();if(request.method!=='GET'&&request.headers.get('Origin')!==new URL(request.url).origin)fail(403,'Origin required');
  let result;
  if(declare&&request.method==='POST'){const body=await request.text();if(body.length>4096)fail(413,'Declaration too large');result=await declareUpload(c,declare[1],JSON.parse(body));}
  else if(operation&&request.method==='GET'&&!operation[2])result=await uploadStatus(c,operation[1]);
  else if(operation&&operation[2]==='parts'&&request.method==='PUT'){const row=await owned(c,operation[1]);await c.writable(row.conversation);const reader=request.body?.getReader();if(!reader)fail(400,'Chunk bytes required');const chunks:Uint8Array[]=[];let size=0;for(;;){const {done,value}=await reader!.read();if(done)break;size+=value.length;if(size>PART_SIZE){await reader!.cancel();fail(413,'Chunk exceeds 8 MiB')}chunks.push(value)}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}result=await uploadPart(c,operation[1],Number(operation[3]),bytes);}
  else if(operation&&operation[2]==='complete'&&request.method==='POST')result=await completeUpload(c,operation[1]);else fail(405,'Upload method unavailable');
  return Response.json(result,{headers:{'Cache-Control':'no-store'}});
 }catch(error){return Response.json({error:error instanceof Error?error.message:'Upload failed'},{status:error instanceof Fault?error.status:409,headers:{'Cache-Control':'no-store'}})}
}
