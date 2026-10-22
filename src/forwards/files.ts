import type {Context} from '../platform/storage/context'
import {fail} from '../family/team-chat/domain'
import {putReserved} from '../platform/storage/files'
// Source bytes were explicitly selected by an authorized member. Preserve the
// validated source MIME even for an imported file outside native upload types.
export async function copyFiles(c:Context,destination:string,sourceFiles:any[],intent:string){
 const copies=[]
 for(const file of sourceFiles.filter(f=>f.state==='attached')){
  const row=await c.one("SELECT * FROM nook_attachments WHERE id=? AND state='attached'",[file.id],file.conversation);if(!row)fail(409,'Source file changed; preview again')
  const object=await c.env.FILES.get(row.object_key);if(!object||object.size!==row.size||object.customMetadata?.sha256!==row.sha256)fail(503,'Source file unavailable')
  const bytes=new Uint8Array(await object!.arrayBuffer()),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');if(hash!==row.sha256)fail(503,'Source file integrity unavailable')
  const uploadIntent='forward:'+intent+':'+destination+':'+row.id
  let copy=await c.one('SELECT * FROM nook_attachments WHERE author=? AND intent=? AND conversation=?',[c.uid,uploadIntent,destination],destination)
  if(!copy){const id=crypto.randomUUID(),key='private/'+crypto.randomUUID();await c.writeBatch([c.sql("INSERT INTO nook_attachments(id,conversation,author,message,name,mime,size,sha256,expires,state,created,object_key,intent) VALUES(?,?,?,NULL,?,?,?,?,?,'reserved',?,?,?)",id,destination,c.uid,row.name,row.mime,row.size,row.sha256,Date.now()+86400000,new Date().toISOString(),key,uploadIntent)],destination);copy=await c.one('SELECT * FROM nook_attachments WHERE id=?',[id],destination)}
  if(copy.conversation!==destination||copy.sha256!==row.sha256||copy.name!==row.name||copy.mime!==row.mime||copy.size!==row.size)fail(409,'Source file changed; use a new forward intent')
  if(copy.state==='reserved')await putReserved(c,copy,bytes,'staged')
  copies.push({id:copy.id,source:row.id,sha256:row.sha256})
 }
 return copies
}
