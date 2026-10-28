import type {Context} from '../platform/storage/context'
import {fail} from '../family/team-chat/domain'
import {allowedGrant} from '../team/access'
// Installation links saved on the account by earlier versions are read only:
// the client carries them into its device-kept "Your workspaces" list (NOOK-137).
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
 }else fail(400,'Choose a conversation')
 await c.hint();return personalWorkspace(c)
}
