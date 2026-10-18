import type {Context} from '../platform/storage/context'
import {fail,text} from '../family/team-chat/domain'
import {allowedGrant} from '../team/access'
export async function personalWorkspace(c:Context){
 const [sections,installations]=await Promise.all([
  c.rows(`SELECT p.conversation,p.section,p.position FROM nook_personal_conversations p JOIN nook_members m ON m.conversation=p.conversation AND m.user=p.user WHERE p.user=? AND ${allowedGrant('m.user','m.conversation')} ORDER BY p.position,p.conversation`,[c.uid]),
  c.rows('SELECT origin,label FROM nook_personal_installations WHERE user=? ORDER BY label,origin',[c.uid]),
 ])
 return {sections,installations}
}
export async function updatePersonalWorkspace(c:Context,input:Record<string,unknown>){
 if(typeof input.conversation==='string'){
  if(Object.keys(input).some(key=>!['conversation','section','position'].includes(key)))fail(400,'Unsupported sidebar setting')
  const section=typeof input.section==='string'&&input.section.length<=80?input.section.trim():fail(400,'Section names hold up to 80 characters'),position=input.position??0
  if(!Number.isSafeInteger(position)||(position as number)<0||(position as number)>100000)fail(400,'Choose a valid sidebar position')
  await c.batch([section?c.sql('INSERT INTO nook_personal_conversations VALUES(?,?,?,?) ON CONFLICT(user,conversation) DO UPDATE SET section=excluded.section,position=excluded.position',c.uid,input.conversation,section,position):c.sql('DELETE FROM nook_personal_conversations WHERE user=? AND conversation=?',c.uid,input.conversation)],input.conversation)
 }else if(typeof input.origin==='string'){
  if(Object.keys(input).some(key=>!['origin','label','remove'].includes(key)))fail(400,'Unsupported workspace setting')
  let origin:string
  try{const url=new URL(input.origin);if(url.username||url.password||url.pathname!=='/'||url.search||url.hash||url.protocol!=='https:'&&!(url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname)))throw Error();origin=url.origin}catch{return fail(400,'Use an HTTPS installation origin (or a local loopback origin)')}
  const label=input.remove?'':text(input.label,80)
  await c.batch([input.remove?c.sql('DELETE FROM nook_personal_installations WHERE user=? AND origin=?',c.uid,origin):c.sql('INSERT INTO nook_personal_installations VALUES(?,?,?) ON CONFLICT(user,origin) DO UPDATE SET label=excluded.label',c.uid,origin,label)])
 }else fail(400,'Choose a conversation or installation')
 await c.hint();return personalWorkspace(c)
}
