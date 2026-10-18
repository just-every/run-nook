import {fail} from '../family/team-chat/domain'
import type {Context} from '../platform/storage/context'
import {assertJob} from './store'
import {jobFence} from './policy'

export async function sha256(bytes:Uint8Array){
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as Uint8Array<ArrayBuffer>))).map(b=>b.toString(16).padStart(2,'0')).join('')
}
export async function fileBytes(c:Context,job:string,id:string){
 await assertJob(c,job)
 const row=await c.one(`SELECT a.id,a.name,a.mime,a.size,a.sha256,a.object_key,a.conversation FROM nook_attachments a JOIN nook_exit_scopes es ON es.conversation=a.conversation AND es.job=? JOIN nook_exit_jobs ej ON ej.id=es.job WHERE a.id=? AND a.state='attached' AND a.message IS NOT NULL AND ej.owner=? AND ${jobFence}`,[job,id,c.uid])
 if(!row)fail(404,'Export file unavailable')
 const object=await c.env.FILES.get(row.object_key)
 if(!object||object.size!==row.size)fail(503,`Export incomplete: file ${id} has unavailable bytes. Restore its source bytes and resume, or start a new export after correcting the source.`)
 const bytes=new Uint8Array(await object!.arrayBuffer())
 if(await sha256(bytes)!==row.sha256)fail(503,`Export incomplete: file ${id} failed its SHA-256 checksum. No successful completeness report was issued.`)
 // Recheck membership, erasure and metadata after the object read and hash.
 await assertJob(c,job)
 const live=await c.one("SELECT 1 FROM nook_attachments WHERE id=? AND object_key=? AND sha256=? AND state='attached'",[id,row.object_key,row.sha256])
 if(!live)fail(409,'Export file changed')
 await assertJob(c,job)
 return {metadata:row,bytes}
}
