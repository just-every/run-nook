import {Context} from '../platform/storage/context'
import {fail} from '../family/team-chat/domain'
import {channelDetails} from './channel-lifecycle.server'
import {channelManagement} from './channel-policy'
import {allowedGrant} from './access'
import {canPost,adminPoster} from './posting-policy'

export async function postingPermissions(c:Context,id:string){
 const [policy,people,rights,history,overrides]=await Promise.all([
  c.one('SELECT level,replies FROM nook_posting_policy WHERE conversation=?',[id],id),
  c.rows('SELECT user FROM nook_posting_people WHERE conversation=? ORDER BY user',[id],id),
  c.one(`SELECT ${canPost('?','?', 'NULL')} AS root,${canPost('?','?', "'thread'")} AS reply,${adminPoster('?')} AS override`,[id,c.uid,id,c.uid,c.uid],id),
  c.rows('SELECT a.version,a.created,a.actor,p.level,p.replies,p.people FROM nook_posting_changes p JOIN nook_channel_actions a ON a.id=p.action WHERE a.conversation=? ORDER BY a.version DESC LIMIT 25',[id],id),
  c.rows("SELECT id,author AS actor,created FROM nook_messages WHERE conversation=? AND deleted=0 AND json_valid(payload) AND json_extract(payload,'$.adminOverride')=1 ORDER BY sequence DESC LIMIT 25",[id],id),
 ])
 return {level:policy?.level??'everyone',replies:policy?.replies??'everyone',people:people.map(p=>p.user),canPost:!!rights.root,canReply:!!rights.reply,canOverride:!!rights.override,history,overrides}
}
export async function updatePosting(c:Context,id:string,input:Record<string,any>){
 if(Object.keys(input).some(k=>!['version','level','replies','people'].includes(k))||!Number.isSafeInteger(input.version)||!['everyone','admins','managers','selected'].includes(input.level)||!['everyone','same'].includes(input.replies)||!Array.isArray(input.people)||input.people.length>1000||input.people.some((p:any)=>typeof p!=='string')||new Set(input.people).size!==input.people.length||input.level!=='selected'&&input.people.length)fail(400,'Choose a posting level, reply policy and named people')
 const channel=await channelDetails(c,id)
 if(!channel.canManage)fail(403,'Only the channel manager or a current member owner or admin may change posting permissions')
 if(channel.version!==input.version)fail(409,'Channel changed; reload')
 const eligible=`NOT EXISTS(SELECT 1 FROM json_each(?) person WHERE NOT EXISTS(SELECT 1 FROM nook_members member JOIN oa_operators operator ON operator.id=member.user WHERE member.conversation=? AND member.user=person.value AND operator.status='active' AND ${allowedGrant('member.user','member.conversation')}))`
 if(!await c.one(`SELECT 1 WHERE ${eligible}`,[JSON.stringify(input.people),id],id))fail(400,'Choose current channel members')
 const action=crypto.randomUUID(),now=new Date().toISOString()
 await c.batch([
  c.sql('INSERT INTO nook_posting_policy VALUES(?,?,?) ON CONFLICT(conversation) DO UPDATE SET level=excluded.level,replies=excluded.replies',id,input.level,input.replies),
  c.sql('DELETE FROM nook_posting_people WHERE conversation=?',id),c.sql('INSERT INTO nook_posting_people SELECT ?,value FROM json_each(?)',id,JSON.stringify(input.people)),
  c.sql('UPDATE nook_conversations SET version=version+1 WHERE id=?',id),...c.event(id,'channel',action),
  c.sql("INSERT INTO nook_channel_actions SELECT ?,id,version,seq,'update',?,NULL,? FROM nook_conversations WHERE id=?",action,c.uid,now,id),
  c.sql('INSERT INTO nook_posting_changes VALUES(?,?,?,?)',action,input.level,input.replies,input.people.length),
 ],id,`EXISTS(SELECT 1 FROM nook_conversations WHERE id=? AND version=? AND kind<>'dm') AND ${channelManagement('?','?')} AND ${eligible}`,[id,input.version,c.uid,id,JSON.stringify(input.people),id])
 await c.hint();return {...await postingPermissions(c,id),version:input.version+1}
}
