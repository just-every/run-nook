import {fail} from '../family/team-chat/domain'
import {Context} from '../platform/storage/context'
import {download} from '../platform/storage/files'
import {safeImageType} from './image-format.mjs'
export async function preview(c:Context,id:string){
 const file=await download(c,id);if(!['text/plain','image/png','image/jpeg'].includes(file.metadata.mime))fail(415,'This file is available as a download')
 const isText=file.metadata.mime==='text/plain'
 let bytes:Uint8Array,mime:string
 if(isText){
  // Text previews are opt-in and bounded. A snippet's actual attachment retains
  // every original UTF-8 byte; only this labelled preview may be shortened.
  const reader=file.body.getReader(),chunks:Uint8Array[]=[];let length=0
  try{while(length<65536){const {value,done}=await reader.read();if(done)break;const chunk=value.subarray(0,65536-length);chunks.push(chunk);length+=chunk.length}}finally{await reader.cancel()}
  bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
  mime='text/plain; charset=utf-8'
 }else{
  bytes=new Uint8Array(await new Response(file.body).arrayBuffer());mime=safeImageType(bytes)??fail(415,'Image cannot be safely previewed');if(mime!==file.metadata.mime)fail(415,'Image cannot be safely previewed')
 }
 // Recheck after consuming private R2 bytes, so removal during I/O denies them.
 const row=await c.one("SELECT conversation FROM nook_attachments WHERE id=? AND state IN ('staged','attached') AND (state='attached' OR (author=? AND expires>CAST(unixepoch('subsec')*1000 AS INTEGER)))",[id,c.uid]);if(!row)fail(404,'Attachment unavailable');await c.check(row.conversation)
 const truncated=isText&&file.metadata.size>bytes.length
 const body=isText?new TextDecoder('utf-8',{fatal:true}).decode(bytes,{stream:truncated}):Uint8Array.from(bytes).buffer
 return new Response(body,{headers:{'Content-Type':mime,'Content-Disposition':'inline','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox",...(isText?{'X-Nook-Preview-Truncated':String(truncated)}:{})}})
}
