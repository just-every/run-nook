import {allowedGrant} from '../../team/access'
import {notifySettings} from '../../notify/preferences'
import {pushSnapshot} from '../../push/run'
import type {Context} from './context'
import {read} from './read'
import {conversationProjection} from './workspace-projection'

// A fresh, request-scoped bundle removes browser round trips. Each reader still
// checks current session/membership in its data snapshot. Continuations stay
// bounded at their existing public endpoints.
export async function workspaceSnapshot(c:Context,query:URLSearchParams){
 const [user,conversations,users,attention,notify,pushSync,data]=await Promise.all([
  read(c,'me'),namedConversations(c),read(c,'users'),read(c,'attention'),
  notifySettings(c),pushSnapshot(c.env,c.uid),
  query.get('conversation')?conversationProjection(c,query):null,
 ])
 await c.check()
 return {user,conversations,users,attention,notify,pushSync,data}
}
async function namedConversations(c:Context){
 const list=await read(c,'conversations')
 const roster=await c.rows(`SELECT r.conversation,a.id,a.name,EXISTS(SELECT 1 FROM nook_members m WHERE m.conversation=r.conversation AND m.user=r.user AND ${allowedGrant('m.user','m.conversation')}) AS active FROM nook_dm_roster r JOIN nook_actor_history a ON a.id=r.user JOIN nook_members mine ON mine.conversation=r.conversation AND mine.user=? WHERE r.conversation IN (SELECT value FROM json_each(?)) AND ${allowedGrant('mine.user','mine.conversation')} ORDER BY r.conversation,a.id LIMIT 50000`,[c.uid,JSON.stringify(list.map((item:any)=>item.id))])
 const participants=new Map<string,any[]>()
 for(const {conversation,...person} of roster){const people=participants.get(conversation)??[];people.push(person);participants.set(conversation,people)}
 return list.map((item:any)=>item.kind==='dm'?{...item,participants:participants.get(item.id)??[]}:item)
}
