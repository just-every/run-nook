import {Context} from '../platform/storage/context'
import {allowedGrant} from '../team/access'
import {publishedImport} from '../imports/projection'
import {fail} from '../family/team-chat/domain'

// Only native messages actually sent by this account. Imported authorship is
// historical provenance, never evidence that this person sent it in Nook.
export async function sentMessages(c:Context,after=''){
 let position:{created:string;id:string}|null=null
 if(after){
  if(typeof after!=='string'||after.length>1024)fail(400,'Invalid sent-message cursor')
  try{position=JSON.parse(atob(after))}catch{fail(400,'Invalid sent-message cursor')}
  if(!position||typeof position.created!=='string'||!Number.isFinite(Date.parse(position.created))||typeof position.id!=='string'||!position.id||position.id.length>128)fail(400,'Invalid sent-message cursor')
 }
 const since=new Date(Date.now()-30*86400000).toISOString()
 const rows=await c.rows(`SELECT m.id,m.conversation,m.parent,m.body,m.created,m.version,v.name,v.kind
 FROM nook_messages m JOIN nook_conversations v ON v.id=m.conversation JOIN nook_members member ON member.conversation=m.conversation AND member.user=?
 WHERE m.author=? AND m.deleted=0 AND m.created>=? AND ${allowedGrant('member.user','member.conversation')}
 AND NOT EXISTS(SELECT 1 FROM nook_import_channels ch JOIN nook_imports j ON j.id=ch.job WHERE ch.conversation=m.conversation AND (j.state<>'complete' OR NOT (${publishedImport})))
 ${position?'AND (m.created,m.id)<(?,?)':''}
 ORDER BY m.created DESC,m.id DESC LIMIT 51`,[c.uid,c.uid,since,...(position?[position.created,position.id]:[])])
 const items=rows.slice(0,50),last=items.at(-1)
 return {items,hasMore:rows.length>50,cursor:last?btoa(JSON.stringify({created:last.created,id:last.id})):after,since}
}
