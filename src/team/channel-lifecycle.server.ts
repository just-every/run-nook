import {fail,text} from '../family/team-chat/domain'
import {Context} from '../platform/storage/context'
import {fullMember} from './access'
import {channelDeparture} from './channel-departure'
import {channelColumns,channelManagement,channelManager} from './channel-policy'
import {designatedDefault,mandatoryDefault} from './default-channels.server'

export async function channelDetails(c:Context,id:string){
 text(id,128)
 const channel=await c.one(`SELECT c.id,c.name,c.kind,c.owner,${channelColumns()},${channelManagement('?','c.id')} AS manage FROM nook_conversations c WHERE c.id=?`,[c.uid,id],id)
 if(!channel)fail(404,'Channel unavailable')
 const policy=await c.one(`SELECT ${designatedDefault('?')} AS defaultChannel,${mandatoryDefault('?')} AS mandatory`,[id,id],id)
 const remainingManager=channel.archived&&await c.one(`SELECT 1 FROM nook_members remaining WHERE remaining.conversation=? AND remaining.user<>? AND ${channelManagement('remaining.user','remaining.conversation')} LIMIT 1`,[id,c.uid],id)
 const leaveReason=channel.kind==='dm'?'Direct conversation participants are fixed':policy.mandatory?'This is a mandatory default channel. An owner must remove its mandatory requirement before you can leave.':channel.kind==='private'&&channel.manager===c.uid?'Transfer management before leaving this private channel':channel.archived&&!remainingManager?'Restore this channel or transfer management before leaving its last manager position':null
 const canManage=channel.kind!=='dm'&&!!channel.manage
 const transferCandidates=canManage?await c.rows(`SELECT o.id,o.display_name AS name FROM nook_members m JOIN oa_operators o ON o.id=m.user WHERE m.conversation=? AND o.status='active' AND ${fullMember('o.id')} AND o.id IS NOT ? ORDER BY o.id LIMIT 50`,[id,channel.manager],id):[]
 const {manage,...data}=channel
 return {...data,defaultChannel:!!policy.defaultChannel,mandatory:!!policy.mandatory,archiveReason:policy.defaultChannel?'Remove this channel from Team → Default channels before archiving it.':null,archived:!!channel.archived,canManage,canLeave:leaveReason===null,leaveReason,transferCandidates,actions:{update:canManage,transfer:canManage,archive:canManage&&!channel.archived&&!policy.defaultChannel,restore:canManage&&!!channel.archived,leave:leaveReason===null}}
}
function version(input:Record<string,any>,keys:string[]){
 if(Object.keys(input).some(key=>!['version',...keys].includes(key)))fail(400,'Unsupported channel setting')
 if(!Number.isSafeInteger(input.version)||input.version<1)fail(400,'Version required')
}
function action(c:Context,id:string,kind:string,subject:string|null=null){
 const aid=crypto.randomUUID()
 return [...c.event(id,'channel',aid),c.sql('INSERT INTO nook_channel_actions SELECT ?,id,version,seq,?,?,?,? FROM nook_conversations WHERE id=?',aid,kind,c.uid,subject,new Date().toISOString(),id)]
}
async function current(c:Context,id:string,input:Record<string,any>,manage=true){
 const channel=await channelDetails(c,id)
 if(channel.kind==='dm')fail(403,'Direct conversation participants are fixed')
 if(manage&&!channel.canManage)fail(403,'Only the channel manager or a current member owner or admin may manage this channel')
 if(channel.version!==input.version)fail(409,'Channel changed; reload')
 return channel
}
const revision=`EXISTS(SELECT 1 FROM nook_conversations WHERE id=? AND kind<>'dm' AND version=?)`
export async function updateChannel(c:Context,id:string,input:Record<string,any>){
 version(input,['name','topic']);if(input.name===undefined&&input.topic===undefined)fail(400,'Choose a channel setting')
 const name=input.name===undefined?null:text(input.name,80)
 if(input.topic!==undefined&&(typeof input.topic!=='string'||input.topic.length>500))fail(400,'Topic must be at most 500 characters')
 const topic=input.topic===undefined?null:input.topic.trim()
 await current(c,id,input)
 await c.batch([c.sql('INSERT INTO nook_channel_settings(conversation,manager,topic) SELECT id,owner,COALESCE(?,\'\') FROM nook_conversations WHERE id=? ON CONFLICT(conversation) DO UPDATE SET topic=COALESCE(?,topic)',topic,id,topic),c.sql('UPDATE nook_conversations SET name=COALESCE(?,name),version=version+1 WHERE id=?',name,id),...action(c,id,'update')],id,`${revision} AND ${channelManagement('?','?')}`,[id,input.version,c.uid,id])
 await c.hint();return channelDetails(c,id)
}
export async function transferChannel(c:Context,id:string,input:Record<string,any>){
 version(input,['user']);const user=text(input.user,128),channel=await current(c,id,input)
 if(channel.manager===user)fail(409,'This person already manages the channel')
 const eligible=`EXISTS(SELECT 1 FROM nook_members m JOIN oa_operators o ON o.id=m.user WHERE m.conversation=? AND m.user=? AND o.status='active' AND ${fullMember('o.id')})`
 if(!await c.one(`SELECT 1 WHERE ${eligible}`,[id,user],id))fail(400,'Choose an active full current channel member')
 await c.batch([c.sql('INSERT INTO nook_channel_settings(conversation,manager) VALUES(?,?) ON CONFLICT(conversation) DO UPDATE SET manager=excluded.manager',id,user),c.sql('UPDATE nook_conversations SET version=version+1 WHERE id=?',id),...action(c,id,'transfer',user)],id,`${revision} AND ${channelManagement('?','?')} AND ${eligible}`,[id,input.version,c.uid,id,id,user])
 await c.hint();return channelDetails(c,id)
}
export async function archiveChannel(c:Context,id:string,input:Record<string,any>){
 version(input,['archived']);if(typeof input.archived!=='boolean')fail(400,'archived must be boolean')
 const channel=await current(c,id,input)
 if(channel.archived===input.archived)return channel
 if(input.archived&&channel.defaultChannel)fail(409,'Remove this channel from Team → Default channels before archiving it')
 await c.batch([...(input.archived?[c.sql("UPDATE nook_invite_plans SET state='cancelled' WHERE state='prepared' AND EXISTS(SELECT 1 FROM json_each(nook_invite_plans.scopes) WHERE value=?)",id)]:[]),c.sql('INSERT INTO nook_channel_settings(conversation,manager,archived) SELECT id,owner,? FROM nook_conversations WHERE id=? ON CONFLICT(conversation) DO UPDATE SET archived=excluded.archived',+input.archived,id),c.sql('UPDATE nook_conversations SET version=version+1 WHERE id=?',id),...action(c,id,input.archived?'archive':'restore')],id,`${revision} AND ${channelManagement('?','?')} AND (?=0 OR NOT (${designatedDefault('?')}))`,[id,input.version,c.uid,id,+input.archived,id])
 await c.hint();return channelDetails(c,id)
}
export async function leaveChannel(c:Context,id:string,input:Record<string,any>){
 version(input,[]);const channel=await current(c,id,input,false)
 if(!channel.canLeave)fail(409,channel.leaveReason!)
 await c.batch([
  c.sql(`INSERT INTO nook_channel_settings(conversation,manager) SELECT leaving.id,NULL FROM nook_conversations leaving WHERE leaving.id=? AND ${channelManager('leaving.id')}=? ON CONFLICT(conversation) DO UPDATE SET manager=NULL`,id,c.uid),
  c.sql('UPDATE nook_conversations SET version=version+1 WHERE id=?',id),...action(c,id,'leave'),
  ...channelDeparture(c,id,c.uid),c.sql('DELETE FROM nook_members WHERE conversation=? AND user=?',id,c.uid)
 ],id,`${revision} AND NOT (${mandatoryDefault('?')}) AND NOT (EXISTS(SELECT 1 FROM nook_channel_settings WHERE conversation=? AND archived=1) AND NOT EXISTS(SELECT 1 FROM nook_members remaining WHERE remaining.conversation=? AND remaining.user<>? AND ${channelManagement('remaining.user','remaining.conversation')})) AND NOT EXISTS(SELECT 1 FROM nook_conversations leaving WHERE leaving.id=? AND leaving.kind='private' AND ${channelManager('leaving.id')}=?)`,[id,input.version,id,id,id,c.uid,id,c.uid])
 await c.hint();return {id,left:true}
}
