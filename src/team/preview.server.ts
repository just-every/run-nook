import {readSlackZip,ZIP_LIMITS} from '../imports/zip.mjs'
import {fail} from '../family/team-chat/domain'
import {Context} from '../platform/storage/context'
import {download} from '../platform/storage/files'
import {safeImageType} from './image-format.mjs'
export async function preview(c:Context,id:string){
 const file=await download(c,id);if(!['text/plain','text/csv','application/zip','image/png','image/jpeg'].includes(file.metadata.mime)&&!(file.metadata.mime==='application/octet-stream'&&/\.zip$/i.test(file.metadata.name)))fail(415,'This file is available as a download')
 const isZip=file.metadata.mime==='application/zip'||/\.zip$/i.test(file.metadata.name)&&['application/octet-stream','text/plain'].includes(file.metadata.mime),isText=!isZip&&['text/plain','text/csv'].includes(file.metadata.mime)
 let bytes:Uint8Array,mime:string,listing:string|undefined
 if(isText){
  // Text previews are opt-in and bounded. A snippet's actual attachment retains
  // every original UTF-8 byte; only this labelled preview may be shortened.
  const reader=file.body.getReader(),chunks:Uint8Array[]=[];let length=0
  try{while(length<65536){const {value,done}=await reader.read();if(done)break;const chunk=value.subarray(0,65536-length);chunks.push(chunk);length+=chunk.length}}finally{await reader.cancel()}
  bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
  mime='text/plain; charset=utf-8'
 }else if(isZip){
  bytes=new Uint8Array(await new Response(file.body).arrayBuffer());mime='text/plain; charset=utf-8'
  try{const archive=readSlackZip(bytes,{...ZIP_LIMITS,entries:200});listing=[...archive.directories].map(name=>name+'/ · directory').concat([...archive.files].map(([name,value])=>name+' · '+value.length+' bytes')).join('\n')||'Empty ZIP archive'}catch{fail(415,'ZIP preview unavailable: malformed archive or preview bounds exceeded')}
  bytes=new TextEncoder().encode(listing)
 }else{
  bytes=new Uint8Array(await new Response(file.body).arrayBuffer());mime=safeImageType(bytes)??fail(415,'Image cannot be safely previewed');if(mime!==file.metadata.mime)fail(415,'Image cannot be safely previewed')
 }
 // Recheck after consuming private R2 bytes, so removal during I/O denies them.
 const row=await c.one("SELECT conversation FROM nook_attachments WHERE id=? AND state IN ('staged','attached') AND (state='attached' OR (author=? AND expires>CAST(unixepoch('subsec')*1000 AS INTEGER)))",[id,c.uid]);if(!row)fail(404,'Attachment unavailable');await c.check(row.conversation)
 const truncated=isText&&file.metadata.size>bytes.length||isZip&&bytes.length>65536
 if(isZip&&truncated)bytes=bytes.subarray(0,65536)
 const body=isText||isZip?new TextDecoder('utf-8',{fatal:true}).decode(bytes,{stream:truncated}):Uint8Array.from(bytes).buffer
 return new Response(body,{headers:{'Content-Type':mime,'Content-Disposition':'inline','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox",...(isText||isZip?{'X-Nook-Preview-Truncated':String(truncated)}:{})}})
}
