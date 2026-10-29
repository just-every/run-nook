import type { ResourceDefinition } from '../base/modules/agent-door/types.ts'
import { nativeContext, nativeCall } from './context'
import type { StorageBindings } from '../platform/storage/context'
import { read, outcome } from '../platform/storage/read'
import { channelDetails } from '../team/channel-lifecycle.server'
import { getNote } from '../notes/read'
import { uploadStatus } from '../files/resumable.server'
import { download } from '../platform/storage/files'

export const resourceTemplates=['conversations','messages','outcomes','files','notes','schedules','audit'].map(area=>`nook://${area}/{id}`)
export function nookResources(env:StorageBindings):ResourceDefinition[]{
 return resourceTemplates.map(uriTemplate=>({
  uriTemplate,name:uriTemplate.split('/')[2],scope:'nook:read',classes:['standard'],
  classify:()=>[{class:'standard',facts:{measure:1}}],
  async read(uri,who){
   return nativeCall(async()=>{
    const c=await nativeContext(env,who),url=new URL(uri),id=decodeURIComponent(url.pathname.slice(1));let json:unknown
    if(url.hostname==='conversations')json=await channelDetails(c,id)
    else if(url.hostname==='messages')json=await read(c,'message',id)
    else if(url.hostname==='outcomes')json=await outcome(c,id)
    else {
     const table={files:'nook_attachment_history',notes:'nook_notes',schedules:'nook_schedules',audit:'nook_audit'}[url.hostname]
     if(!table)return null
     if(url.hostname==='audit'&&(!['owner','admin'].includes(c.operator.role)||!await c.one("SELECT 1 FROM nook_access WHERE user=? AND mode='member' AND active=1",[c.uid])))return null
     const row=await c.one(`SELECT ${url.hostname==='files'?'id,conversation,author,message,name,mime,size,state,expires,created':url.hostname==='audit'?'id,scope AS conversation,actor,kind,at,outcome,version,reason,count':url.hostname==='schedules'?'id,conversation,user,state,version,local_at,zone,next_due,reason':'id,conversation'} FROM ${table} WHERE id=?`,[id])
     if(!row)return null
     await c.check(row.conversation)
     if(url.hostname==='files'){
      // Native status owns unshared uploads, including reservations. Completed
      // files also pass native download admission; discard its stream unread.
      if(row.message||(await uploadStatus(c,id)).file){
       const file=await download(c,id);await file.body.cancel()
      }
     }
     if(url.hostname==='schedules'&&row.user!==c.uid)return null
     json=url.hostname==='notes'?await getNote(c,row.conversation,id):row
    }
    if(json&&typeof json==='object'&&('deleted' in json&&json.deleted||'erased' in json&&json.erased))return null
    return {json,untrusted:true}
   }).catch(()=>null)
  },
 }))
}
