import {browseChannels} from '../../team/channels.server'
import {Fault} from '../../family/team-chat/domain'
import {allowedGrant} from '../../team/access'
import {notifySettings} from '../../notify/preferences'
import {authorizedPushSnapshot} from '../../push/snapshot'
import type {Context} from './context'
import {read} from './read'
import {conversationProjection} from './workspace-projection'
import {attentionSignature} from './workspace-signature'

// A fresh, request-scoped bundle removes browser round trips. Each reader still
// checks current session/membership in its data snapshot. Continuations stay
// bounded at their existing public endpoints.
export async function workspaceSnapshot(c:Context,query:URLSearchParams){
 const identity=read(c,'me')
 const [user,conversations,users,attention,notify,pushSync,projection,signature,channelPage]=await Promise.all([
  identity,namedConversations(c),read(c,'users'),read(c,'attention'),
  notifySettings(c),authorizedPushSnapshot(c),
  query.get('conversation')?conversationProjection(c,query).then(data=>({data,error:null})).catch((error:unknown)=>{if(error instanceof Fault&&[403,404].includes(error.status))return {data:null,error:{status:error.status,message:error.message}};throw error}):null,
  c.one(attentionSignature,[c.uid,c.uid]),
  (query.get('view')??'channels')==='channels'?identity.then(user=>user.mode==='member'?browseChannels(c):null):null,
 ])
 // Every returned database projection carries its own current SQL fence.
 return {user,conversations,users,attention,notify,pushSync,channelPage,data:projection?.data??null,dataError:projection?.error??null,signature:signature.v}
}
export async function readAcknowledgement(c:Context,id:string){
 const [conversations,pushSync]=await Promise.all([read(c,'conversations'),authorizedPushSnapshot(c,id)])
 return {user:c.uid,conversation:id,conversations,pushSync}
}
async function namedConversations(c:Context){
 const list=await read(c,'conversations')
 const dms=list.filter((item:any)=>item.kind==='dm')
 if(!dms.length)return list
 const roster=await c.rows(`SELECT r.conversation,a.id,a.name,EXISTS(SELECT 1 FROM nook_members m WHERE m.conversation=r.conversation AND m.user=r.user AND ${allowedGrant('m.user','m.conversation')}) AS active FROM nook_dm_roster r JOIN nook_actor_history a ON a.id=r.user JOIN nook_members mine ON mine.conversation=r.conversation AND mine.user=? WHERE r.conversation IN (SELECT value FROM json_each(?)) AND ${allowedGrant('mine.user','mine.conversation')} ORDER BY r.conversation,a.id LIMIT 50000`,[c.uid,JSON.stringify(dms.map((item:any)=>item.id))])
 const participants=new Map<string,any[]>()
 for(const {conversation,...person} of roster){const people=participants.get(conversation)??[];people.push(person);participants.set(conversation,people)}
 return list.map((item:any)=>item.kind==='dm'?{...item,participants:participants.get(item.id)??[]}:item)
}
