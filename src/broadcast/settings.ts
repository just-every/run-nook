import type {Context} from '../platform/storage/context'
import {fail} from '../family/team-chat/domain'
import {fullMember,visibleIdentity} from '../team/access'
import {channelManagement} from '../team/channel-policy'
import {canBroadcast,effectiveScope,literal} from './policy'
const owner=(user:string)=>`EXISTS(SELECT 1 FROM oa_operators o WHERE o.id=${user} AND o.role='owner' AND o.status='active' AND ${fullMember('o.id')})`
export async function broadcastPolicy(c:Context,scope:string){
 if(scope){if(!await c.one("SELECT 1 FROM nook_conversations WHERE id=? AND kind<>'dm'",[scope],scope))fail(400,'Broadcast policies apply to channels only')}else if(!await c.one(`SELECT 1 WHERE ${owner('?')}`,[c.uid]))fail(403,'Only an owner can manage workspace broadcasts')
 const [p,people,history,eligible,defaults]=await Promise.all([
  c.one('SELECT * FROM nook_broadcast_policy WHERE scope=?',[scope],scope||undefined),
  c.rows('SELECT user FROM nook_broadcast_people WHERE scope=? ORDER BY user',[scope],scope||undefined),
  c.rows('SELECT a.*,o.name AS actorName FROM nook_broadcast_actions a LEFT JOIN nook_actor_history o ON o.id=a.actor WHERE a.scope=? ORDER BY a.version DESC LIMIT 25',[scope],scope||undefined),
  scope?c.rows(`SELECT o.id,o.display_name AS name FROM nook_members m JOIN oa_operators o ON o.id=m.user WHERE m.conversation=? AND o.status='active' ORDER BY o.display_name`,[scope],scope):c.rows(`SELECT o.id,o.display_name AS name FROM oa_operators o WHERE o.status='active' AND ${fullMember('o.id')} AND ${visibleIdentity(literal(c.uid),'o.id')} ORDER BY o.display_name`),
  scope?Promise.resolve([]):c.rows("SELECT d.conversation AS id,c.name FROM nook_default_channels d JOIN nook_conversations c ON c.id=d.conversation WHERE c.kind='channel' AND d.mandatory=1 AND NOT EXISTS(SELECT 1 FROM nook_channel_settings s WHERE s.conversation=c.id AND s.archived=1) ORDER BY c.name"),
 ])
 const permitted=scope?!!await c.one(`SELECT 1 WHERE ${channelManagement('?','?')}`,[c.uid,scope],scope):true
 const effective=scope?await c.one(`SELECT COALESCE((SELECT level FROM nook_broadcast_policy WHERE scope=${effectiveScope(literal(scope))}),'everyone') AS level,${canBroadcast(literal(scope),literal(c.uid))} AS allowed`,[],scope):null
 return {version:p?.version??0,level:p?.level??(scope?'inherit':'everyone'),everyoneChannel:p?.everyone_channel??null,people:people.map(r=>r.user),history,eligible,defaults,canManage:permitted,effectiveLevel:effective?.level??p?.level??'everyone',canBroadcast:!!effective?.allowed}
}
export async function updateBroadcastPolicy(c:Context,scope:string,input:Record<string,any>){
 if(Object.keys(input).some(k=>!['version','level','people','everyoneChannel'].includes(k))||!Number.isSafeInteger(input.version)||!['everyone','admins','selected',...(scope?['inherit']:[])].includes(input.level)||!Array.isArray(input.people)||input.people.length>1000||input.people.some((id:any)=>typeof id!=='string')||new Set(input.people).size!==input.people.length||input.level!=='selected'&&input.people.length||!scope&&input.everyoneChannel!==null&&typeof input.everyoneChannel!=='string'||scope&&input.everyoneChannel!=null)fail(400,'Choose a broadcast policy and named people; groups and app grants are unavailable')
 const current=await broadcastPolicy(c,scope)
 if(!current.canManage)fail(403,'Only the channel manager or a current member owner or admin may change this policy')
 if(current.version!==input.version)fail(409,'Broadcast policy changed; reload')
 if(input.people.some((id:string)=>!current.eligible.some(p=>p.id===id)))fail(400,'Choose current people in this audience')
 const everyoneChannel=scope?null:input.everyoneChannel
 if(everyoneChannel&&!current.defaults.some(d=>d.id===everyoneChannel))fail(400,'Designate an active mandatory public default channel for @everyone')
 const validPerson=scope?`EXISTS(SELECT 1 FROM nook_members m JOIN oa_operators o ON o.id=m.user WHERE m.conversation=${literal(scope)} AND m.user=j.value AND o.status='active')`:`EXISTS(SELECT 1 FROM oa_operators o WHERE o.id=j.value AND o.status='active' AND ${fullMember('o.id')})`
 await c.batch([
  c.sql('INSERT INTO nook_broadcast_policy VALUES(?,?,?,?) ON CONFLICT(scope) DO UPDATE SET version=excluded.version,level=excluded.level,everyone_channel=excluded.everyone_channel',scope,input.version+1,input.level,everyoneChannel),
  ...(!scope&&everyoneChannel?[c.sql(`INSERT OR IGNORE INTO nook_members SELECT ?,o.id FROM oa_operators o WHERE o.status='active' AND ${fullMember('o.id')}`,everyoneChannel)]:[]),
  c.sql('DELETE FROM nook_broadcast_people WHERE scope=?',scope),c.sql('INSERT INTO nook_broadcast_people SELECT ?,value FROM json_each(?)',scope,JSON.stringify(input.people)),
  c.sql('INSERT INTO nook_broadcast_actions VALUES(?,?,?,?,?,?,?,?)',crypto.randomUUID(),scope,input.version+1,c.uid,input.level,input.people.length,everyoneChannel,new Date().toISOString()),
 ],scope||undefined,`${scope?channelManagement(literal(c.uid),literal(scope)):owner(literal(c.uid))} AND COALESCE((SELECT version FROM nook_broadcast_policy WHERE scope=?),0)=? AND NOT EXISTS(SELECT 1 FROM json_each(?) j WHERE NOT (${validPerson})) AND (? IS NULL OR EXISTS(SELECT 1 FROM nook_default_channels d JOIN nook_conversations v ON v.id=d.conversation WHERE d.conversation=? AND v.kind='channel' AND d.mandatory=1 AND NOT EXISTS(SELECT 1 FROM nook_channel_settings s WHERE s.conversation=v.id AND s.archived=1)))`,[scope,input.version,JSON.stringify(input.people),everyoneChannel,everyoneChannel])
 await c.hint();return broadcastPolicy(c,scope)
}
export async function readIgnore(c:Context,id:string){return {ignore:!!await c.one('SELECT 1 FROM nook_broadcast_ignores WHERE user=? AND conversation=?',[c.uid,id],id)}}
export async function updateIgnore(c:Context,id:string,input:Record<string,any>){
 if(Object.keys(input).join()!=='ignore'||typeof input.ignore!=='boolean')fail(400,'Choose whether to ignore broadcasts')
 await c.batch([input.ignore?c.sql('INSERT OR IGNORE INTO nook_broadcast_ignores VALUES(?,?)',c.uid,id):c.sql('DELETE FROM nook_broadcast_ignores WHERE user=? AND conversation=?',c.uid,id)],id)
 await c.hint();return readIgnore(c,id)
}
