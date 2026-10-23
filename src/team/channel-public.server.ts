import {fail,text} from '../family/team-chat/domain'
import {messageAttentionInput} from '../family/team-chat/attention'
import {messageStatements} from '../platform/storage/message-statements'
import type {Context} from '../platform/storage/context'
import {fullMember} from './access'
import {channelManager} from './channel-policy'
import {canPost} from './posting-policy'
import {channelDetails} from './channel-lifecycle.server'

export const publicHistoryDisclosure='All history becomes visible workspace-wide and cannot be re-hidden.'
const scopeRevision="COALESCE((SELECT revision FROM nook_exit_changes WHERE conversation=?),0)"
const identityRevision='(SELECT revision FROM nook_exit_clock WHERE id=1)'
// Imported custody and converted direct audiences retain their original scope.
// A retained erased body is never released by a channel visibility change.
const custody=(scope:string)=>`EXISTS(SELECT 1 FROM nook_import_channels WHERE conversation=${scope}) OR EXISTS(SELECT 1 FROM nook_group_conversions WHERE destination=${scope}) OR EXISTS(SELECT 1 FROM nook_erased_messages e JOIN nook_retained_message_bodies b ON b.id=e.id WHERE e.conversation=${scope})`
async function snapshot(c:Context,id:string){
 text(id,128)
 const row=await c.one(`SELECT c.id,c.kind,c.version,c.seq,${channelManager('c.id')} AS manager,${scopeRevision} AS historyRevision,${identityRevision} AS identityRevision,
 (SELECT count(*) FROM nook_messages WHERE conversation=c.id AND deleted=0) AS messages,
 (SELECT count(*) FROM nook_attachments a JOIN nook_messages m ON m.id=a.message WHERE a.conversation=c.id AND a.state='attached' AND m.deleted=0) AS files,
 (SELECT min(created) FROM nook_messages WHERE conversation=c.id AND deleted=0) AS earliest,
 (SELECT count(*) FROM nook_notes WHERE conversation=c.id AND deleted=0) AS notes,
 (SELECT count(*) FROM oa_operators o WHERE o.status='active' AND ${fullMember('o.id')}) AS audience,
 (SELECT count(*) FROM oa_operators o WHERE o.status='active' AND ${fullMember('o.id')} AND NOT EXISTS(SELECT 1 FROM nook_members m WHERE m.conversation=c.id AND m.user=o.id)) AS gainingAccess,
 (${custody('c.id')}) AS restricted FROM nook_conversations c WHERE c.id=?`,[id,id],id)
 if(!row||row.kind!=='private')fail(403,'Only a private channel can become public; direct conversations cannot be converted here')
 if(row.manager!==c.uid)fail(403,'Only the current channel manager may make this channel public')
 if(row.restricted)fail(409,'This channel has imported, direct-conversation or retained-erasure custody; public conversion is unavailable')
 await c.writable(id)
 if(!await c.one(`SELECT 1 WHERE ${canPost('?','?','NULL')}`,[id,c.uid],id))fail(403,'The channel manager must have posting permission for the conversion notice')
 return row
}
async function token(row:Record<string,unknown>){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(row)))),x=>x.toString(16).padStart(2,'0')).join('')}
export async function publicChannelPreview(c:Context,id:string){
 const row=await snapshot(c,id)
 return {version:await token(row),messages:row.messages,files:row.files,notes:row.notes,earliest:row.earliest,audience:row.audience,gainingAccess:row.gainingAccess,audienceLabel:'Every current full workspace member',disclosure:publicHistoryDisclosure,custody:'Erased content is excluded. Retained-erasure, imported and direct-conversation custody cannot be converted.'}
}
export async function makeChannelPublic(c:Context,id:string,input:Record<string,any>){
 if(Object.keys(input).sort().join()!=='confirmed,preview'||input.confirmed!==true||typeof input.preview!=='string')fail(400,'Explicit confirmation of the current history preview is required')
 const row=await snapshot(c,id)
 if(input.preview!==await token(row))fail(409,'History or membership changed; preview the current history again')
 const now=new Date().toISOString(),mid=crypto.randomUUID(),intent=crypto.randomUUID(),body='System notice: This channel is now public. '+publicHistoryDisclosure,attention=messageAttentionInput({}),payload=JSON.stringify({body,parent:null,attachments:[],...attention})
 await c.writeBatch([
  c.sql("UPDATE nook_conversations SET kind='channel',version=version+1 WHERE id=?",id),
  ...messageStatements(c,{id,mid,body,parent:null,ids:[],attention,intent,payload,now,resolveBroadcasts:false}),
  c.sql("INSERT INTO nook_audit VALUES(?,?, 'channel-public',?,'channel.public',?,?,?,'confirmed',1)",crypto.randomUUID(),c.uid,Date.parse(now),id,row.version+1,publicHistoryDisclosure),
 ],id,`EXISTS(SELECT 1 FROM nook_conversations WHERE id=? AND kind='private' AND version=? AND seq=?) AND ${channelManager('?')}=? AND ${scopeRevision}=? AND ${identityRevision}=? AND ${canPost('?','?','NULL')}`,[id,row.version,row.seq,id,c.uid,id,row.historyRevision,row.identityRevision,id,c.uid])
 await c.hint();return channelDetails(c,id)
}
