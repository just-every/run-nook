import {fail} from '../family/team-chat/domain'
import {Context} from '../platform/storage/context'
import {download} from '../platform/storage/files'
import {safeImageType} from './image-format.mjs'
export async function preview(c:Context,id:string){
 const file=await download(c,id);if(!['image/png','image/jpeg'].includes(file.metadata.mime))fail(415,'This file is available as a download')
 const bytes=new Uint8Array(await new Response(file.body).arrayBuffer()),mime=safeImageType(bytes)??fail(415,'Image cannot be safely previewed');if(mime!==file.metadata.mime)fail(415,'Image cannot be safely previewed')
 // Recheck after consuming private R2 bytes, so removal during I/O denies them.
 const row=await c.one("SELECT conversation FROM nook_attachments WHERE id=? AND state IN ('staged','attached') AND (state='attached' OR (author=? AND expires>CAST(unixepoch('subsec')*1000 AS INTEGER)))",[id,c.uid]);if(!row)fail(404,'Attachment unavailable');await c.check(row.conversation)
 return new Response(bytes,{headers:{'Content-Type':mime,'Content-Disposition':'inline','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}})
}
