import type {Context} from '../platform/storage/context'
import {message} from '../platform/storage/read'
import {canPost} from '../team/posting-policy'
import {fullMember,allowedGrant} from '../team/access'
import {fail,text} from '../family/team-chat/domain'
import {forwardProjection,effectiveBody} from './projection'
type Destination={conversation:string;thread:string|null}
export const policy=async(c:Context)=>await c.one<{mode:string;version:number}>('SELECT mode,version FROM nook_forward_policy WHERE id=1')??{mode:'allow',version:0}
export const digest=async(value:unknown)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)))),b=>b.toString(16).padStart(2,'0')).join('')
async function confirmation(c:Context,value:unknown){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(c.env.SESSION_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(JSON.stringify(value)))),b=>b.toString(16).padStart(2,'0')).join('')}
export async function previewForward(c:Context,input:Record<string,unknown>){
 const id=text(input.source,128),original=await message(c,id);if(original.deleted||original.erased||await c.one("SELECT 1 FROM nook_notification_sharing WHERE conversation=? AND state<>'local'",[original.conversation]))fail(404,'Message unavailable')
 const mode=input.mode;if(!['link','show'].includes(String(mode)))fail(400,'Choose Link only or Show message')
 const note=input.note===undefined?'':text(input.note,2000).trim(),rules=await policy(c);if(rules.mode==='blocked'||mode==='show'&&rules.mode==='link-only')fail(403,'Forwarding policy refuses this mode')
 if(!Array.isArray(input.destinations)||!input.destinations.length||input.destinations.length>20)fail(400,'Choose 1 to 20 destinations')
 const destinations:Destination[]=(input.destinations as any[]).map((d:any)=>({conversation:text(d?.conversation,128),thread:d?.thread?text(d.thread,128):null}));if(new Set(destinations.map(d=>JSON.stringify(d))).size!==destinations.length)fail(400,'Choose each destination once')
 const sourceMembers=await c.rows<{user:string}>(`SELECT user FROM nook_members m WHERE conversation=? AND ${allowedGrant('m.user','m.conversation')} ORDER BY m.user`,[original.conversation],original.conversation),sourceAudience=new Set(sourceMembers.map(m=>m.user)),audiences=[]
 for(const d of destinations){
  await c.writable(d.conversation);if(!await c.one(`SELECT 1 WHERE ${canPost('?','?','?')} AND NOT EXISTS(SELECT 1 FROM nook_notification_sharing WHERE conversation=? AND state<>'local')`,[d.conversation,d.thread,c.uid,d.conversation],d.conversation))fail(403,'Destination refuses posting')
  if(d.thread){const root=await message(c,d.thread);if(root.conversation!==d.conversation||root.parent||root.deleted)fail(404,'Thread unavailable')}
  const members=await c.rows<{user:string;name:string}>(`SELECT m.user,a.name FROM nook_members m JOIN nook_actors a ON a.id=m.user WHERE m.conversation=? AND ${allowedGrant('m.user','m.conversation')} ORDER BY m.user`,[d.conversation],d.conversation),room=await c.one('SELECT name,kind FROM nook_conversations WHERE id=?',[d.conversation],d.conversation)
  audiences.push({...d,name:room.name,kind:room.kind,members:members.map(m=>m.user),newReaders:members.filter(m=>!sourceAudience.has(m.user)).map(m=>({id:m.user,name:m.name}))})
 }
 const shown=(await forwardProjection(c,[{...original}],original.conversation))[0],files=original.attachments.filter((f:any)=>f.state==='attached').map((f:any)=>({id:f.id,sha256:f.sha256,name:f.name,size:f.size})),binding={user:c.uid,source:id,sourceVersion:original.version,sourceAudience:sourceMembers.map(m=>m.user),sourceBody:await digest({body:original.body,forward:shown.forward??null}),mode,note,policy:rules.version,audiences,files}
 await c.check(original.conversation)
 return {original,rules,destinations,audiences,files,binding,confirmation:await confirmation(c,binding),mode:mode as 'link'|'show',note}
}
