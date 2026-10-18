import {ApiError} from './api'
import type {Conversation,Message} from './types'
import type {TeamRequest} from '../team/types'
import type {RecentVisit} from './recent-navigation'

export type QuickThread={root:Message;unread:number;visited?:boolean}
export async function followedThreads(request:TeamRequest,signal:AbortSignal){
 const items:QuickThread[]=[],seen=new Set<string>();let after=''
 for(;;){
  const page=await request<{items:QuickThread[];hasMore:boolean;cursor:string}>('/api/threads?limit=100'+(after?'&after='+encodeURIComponent(after):''),{signal})
  items.push(...page.items)
  if(!page.hasMore)return items
  if(!page.cursor||seen.has(page.cursor))throw Error('Followed threads could not be fully read. Reopen the switcher.')
  seen.add(page.cursor);after=page.cursor
 }
}
export async function visitedThreads(visits:RecentVisit[],conversations:Conversation[],signal:AbortSignal){
 const available=new Set(conversations.map(c=>c.id)),pending=visits.filter(v=>v.key.startsWith('t:')&&v.conversation&&available.has(v.conversation)),items:QuickThread[]=[]
 let next=0
 await Promise.all(Array.from({length:Math.min(4,pending.length)},async()=>{
  while(next<pending.length){
   const visit=pending[next++]
   // An expected revoked/deleted visit is omitted locally. Sending its denial
   // through the workspace mutation handler would retire unrelated open views.
   const response=await fetch('/api/messages/'+encodeURIComponent(visit.key.slice(2)),{signal,credentials:'same-origin',cache:'no-store'})
   if(response.status===403||response.status===404)continue
   if(!response.ok)throw new ApiError(response.status,'Recent threads could not be checked. Reopen the switcher.')
   const root=await response.json() as Message
   if(root.id===visit.key.slice(2)&&root.conversation===visit.conversation&&!root.parent&&!root.deleted)items.push({root,unread:0,visited:true})
  }
 }))
 return items
}
