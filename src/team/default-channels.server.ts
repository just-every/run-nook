import {initialNotificationStatements} from './notification-defaults.server';
import {fail} from '../family/team-chat/domain'
import type {Context} from '../platform/storage/context'
import {fullMember} from './access'

const management=(user:string)=>`EXISTS(SELECT 1 FROM oa_operators o WHERE o.id=${user} AND o.status='active' AND o.role IN ('owner','admin') AND ${fullMember('o.id')})`
const policyVersion=`COALESCE((SELECT version FROM nook_default_policy WHERE id=1),0)`
const eligible=(conversation:string)=>`EXISTS(SELECT 1 FROM nook_conversations c WHERE c.id=${conversation} AND c.kind='channel' AND NOT EXISTS(SELECT 1 FROM nook_channel_settings s WHERE s.conversation=c.id AND s.archived=1))`
export const mandatoryDefault=(conversation:string)=>`EXISTS(SELECT 1 FROM nook_default_channels d WHERE d.conversation=${conversation} AND d.mandatory=1)`
export const designatedDefault=(conversation:string)=>`EXISTS(SELECT 1 FROM nook_default_channels d WHERE d.conversation=${conversation})`

export async function defaultChannels(c:Context){
 if(!await c.one(`SELECT 1 WHERE ${management('?')}`,[c.uid]))fail(403,'Default channels are managed by workspace owners and admins')
 const settings=await c.one(`SELECT ${policyVersion} AS version WHERE ${management('?')}`,[c.uid])
 if(!settings)fail(403,'Default-channel management authority changed')
 const [channels,history]=await Promise.all([
  c.rows(`SELECT c.id,c.name,COALESCE(d.mandatory,0) AS mandatory,CASE WHEN d.conversation IS NULL THEN 0 ELSE 1 END AS enabled FROM nook_conversations c LEFT JOIN nook_default_channels d ON d.conversation=c.id WHERE c.kind='channel' AND NOT EXISTS(SELECT 1 FROM nook_channel_settings s WHERE s.conversation=c.id AND s.archived=1) AND ${management('?')} ORDER BY c.name,c.id`,[c.uid]),
  c.rows(`SELECT a.id,a.version,a.conversation,c.name,a.enabled,a.mandatory,a.actor,o.display_name AS actorName,a.created FROM nook_default_actions a JOIN nook_conversations c ON c.id=a.conversation LEFT JOIN oa_operators o ON o.id=a.actor WHERE ${management('?')} ORDER BY a.version DESC,a.conversation LIMIT 50`,[c.uid]),
 ])
 if((await c.one(`SELECT ${policyVersion} AS version`)).version!==settings.version)fail(409,'Default-channel policy changed; reload before saving')
 return {version:settings.version,canChangeMandatory:c.session.operator.role==='owner',channels,history}
}
export async function updateDefaultChannels(c:Context,input:Record<string,any>){
 if(Object.keys(input).some(key=>!['version','channels'].includes(key))||!Number.isSafeInteger(input.version)||input.version<0||!Array.isArray(input.channels)||input.channels.length>50)fail(400,'Choose up to 50 default public channels and the current policy version')
 const selected=input.channels as {id:string;mandatory:boolean}[]
 if(selected.some(row=>!row||Object.keys(row).sort().join()!=='id,mandatory'||typeof row.id!=='string'||!row.id||row.id.length>128||typeof row.mandatory!=='boolean')||new Set(selected.map(row=>row.id)).size!==selected.length)fail(400,'Choose distinct default public channels')
 const current=await defaultChannels(c)
 if(current.version!==input.version)fail(409,'Default-channel policy changed; reload before saving')
 const before=new Map(current.channels.filter(row=>row.enabled).map(row=>[row.id,!!row.mandatory])),after=new Map(selected.map(row=>[row.id,row.mandatory]))
 const changes=[...new Set([...before.keys(),...after.keys()])].filter(id=>before.has(id)!==after.has(id)||before.get(id)!==after.get(id))
 const mandatoryChanged=changes.some(id=>!!before.get(id)!==!!after.get(id))
 if(mandatoryChanged&&!current.canChangeMandatory)fail(403,'Only an owner may make a default channel mandatory or remove that requirement')
 if(selected.some(row=>!current.channels.some(channel=>channel.id===row.id)))fail(400,'Defaults must be active public channels; private conversations and DMs cannot be selected')
 const ids=JSON.stringify(selected.map(row=>row.id)),revision=input.version+1,created=new Date().toISOString()
 await c.batch([
  ...(changes.length?[
   c.sql('INSERT INTO nook_default_policy VALUES(1,?) ON CONFLICT(id) DO UPDATE SET version=excluded.version',revision),
   c.sql('DELETE FROM nook_default_channels'),
   ...selected.map(row=>c.sql('INSERT INTO nook_default_channels VALUES(?,?)',row.id,+row.mandatory)),
   ...changes.map(id=>c.sql('INSERT INTO nook_default_actions VALUES(?,?,?,?,?,?,?)',crypto.randomUUID(),revision,id,after.has(id)?1:0,after.get(id)?1:0,c.uid,created)),
  ]:[]),
 ],undefined,`${management('?')} AND ${policyVersion}=? AND (?=0 OR EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner')) AND NOT EXISTS(SELECT 1 FROM json_each(?) j WHERE NOT (${eligible('j.value')}))`,[c.uid,input.version,+mandatoryChanged,c.uid,ids])
 await c.hint();return defaultChannels(c)
}

const pending=(user:string)=>`EXISTS(SELECT 1 FROM nook_default_admissions a WHERE a.user=${user} AND a.state='pending')`
const blocked=(user:string)=>`EXISTS(SELECT 1 FROM nook_default_channels d WHERE NOT (${eligible('d.conversation')}) OR (NOT EXISTS(SELECT 1 FROM nook_members m WHERE m.conversation=d.conversation AND m.user=${user}) AND (SELECT count(*) FROM nook_members m WHERE m.conversation=d.conversation)>=1000))`
// Called only after Context has proved current session AND product admission.
export async function initializeDefaultChannels(c:Context){
 const admission=await c.one('SELECT state FROM nook_default_admissions WHERE user=?',[c.uid])
 if(!admission){
  // Older restored archives have no marker table rows. They retain their exact
  // grants; a missing marker is never evidence of a new invitation.
  await c.batch([c.sql("INSERT OR IGNORE INTO nook_default_admissions VALUES(?,'complete')",c.uid)])
  return
 }
 if(admission.state!=='pending')return
 if(!await c.one(`SELECT 1 WHERE ${fullMember('?')}`,[c.uid]))return
 const version=(await c.one(`SELECT ${policyVersion} AS version`)).version
 const notification=await initialNotificationStatements(c);
 const channels=await c.rows('SELECT conversation FROM nook_default_channels ORDER BY conversation')
 const guard=`COALESCE((SELECT version FROM nook_notification_defaults WHERE id=1),0)=${notification.version} AND ${policyVersion}=? AND ${fullMember('?')} AND (NOT (${pending('?')}) OR NOT (${blocked('?')}))`
 const missing=`${pending('?')} AND NOT EXISTS(SELECT 1 FROM nook_members WHERE conversation=? AND user=?)`
 try{
  await c.batch([
   ...channels.flatMap(({conversation:id})=>[
    c.sql(`UPDATE nook_conversations SET seq=seq+1 WHERE id=? AND ${missing}`,id,c.uid,id,c.uid),
    c.sql(`INSERT INTO nook_events SELECT id,seq,'membership',?,? FROM nook_conversations WHERE id=? AND ${missing}`,c.uid,c.uid,id,c.uid,id,c.uid),
    c.sql(`INSERT OR IGNORE INTO nook_members SELECT ?,? WHERE ${pending('?')}`,id,c.uid,c.uid),
   ]),
   ...notification.statements,
   c.sql("UPDATE nook_default_admissions SET state='complete' WHERE user=?",c.uid),
  ],undefined,guard,[version,c.uid,c.uid,c.uid])
 }catch(error){
  if(await c.one(`SELECT 1 WHERE ${pending('?')} AND ${blocked('?')}`,[c.uid,c.uid]))fail(409,'A default channel is full or unavailable. No default channels were joined. Ask an owner to update the default channels, then try again.')
  throw error
 }
 if(channels.length)await c.hint()
}
