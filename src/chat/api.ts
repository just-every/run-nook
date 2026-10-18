import type {Attention,FileRecord,LocationState,MessageWindow,Outcome,Page,Projection,WorkspaceSnapshot,Replay} from './types'
export class ApiError extends Error { constructor(public status:number,message:string,public broadcast?:import('../broadcast/ConfirmBroadcast').BroadcastPreview,public code?:string){super(message)} }
export async function api<T>(path:string,data?:unknown,method=data===undefined?'GET':'POST'):Promise<T> {
 const response=await fetch('/api/'+path,{method,headers:data===undefined?undefined:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data),cache:'no-store'})
 return responseValue<T>(response)
}
async function responseValue<T>(response:Response):Promise<T>{
 const value=await response.json() as T & {error?:string;code?:string;broadcast?:import('../broadcast/ConfirmBroadcast').BroadcastPreview}
 if(!response.ok)throw new ApiError(response.status,value.error||'The request could not be completed.',value.broadcast,value.code)
 return value
}
export function attachmentMime(file:File){
 const mime=file.type||({txt:'text/plain',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',pdf:'application/pdf'} as Record<string,string>)[file.name.split('.').pop()!.toLowerCase()]
 if(!['text/plain','image/png','image/jpeg','application/pdf'].includes(mime))throw new ApiError(415,'Unsupported file type')
 return mime
}
export async function uploadAttachment(conversation:string,file:File,intent:string):Promise<FileRecord>{
 const mime=attachmentMime(file)
 const response=await fetch(`/api/conversations/${conversation}/attachments`,{method:'POST',headers:{'Content-Type':mime,'X-Filename':encodeURIComponent(file.name),'X-Upload-Intent':intent},body:file,cache:'no-store'})
 return responseValue<FileRecord>(response)
}
export async function messageWindow(conversation:string,options:{before?:string|null;thread?:string|null;around?:string|null;firstUnread?:boolean}={}):Promise<MessageWindow>{
 const query=new URLSearchParams({limit:'50'})
 for(const key of ['before','thread','around'] as const)if(options[key])query.set(key,options[key]!)
 if(options.firstUnread)query.set('firstUnread','1')
 return api<MessageWindow>(`conversations/${conversation}/messages/window?${query}`)
}
export function windowKey(route:LocationState){
 // Automatic reply/thread positioning belongs to the same implicit landing.
 // Keep its replay frontier and target across that navigation, so an erasure
 // racing a read acknowledgement cannot turn an implicit target into a 404.
 return route.landing?[route.conversation,'landing'].join(':'):[route.conversation,route.thread,route.focus,route.before,route.threadBefore,'default'].join(':')
}
async function replay(conversation:string,after:number){
 let cursor=after,newMessageCount=0,erased=false
 for(;;){const page=await api<Replay>(`conversations/${conversation}/replay?after=${cursor}`);if(page.cursor<cursor||page.hasMore&&page.cursor===cursor)throw Error('Conversation updates could not be read. Reopen the conversation.');for(const event of page.events){if(event.kind==='message')newMessageCount++;if(event.kind==='erasure')erased=true}cursor=page.cursor;if(!page.hasMore)return {cursor,newMessageCount,erased}}
}
export async function workspace(route:LocationState,previous:Projection|null):Promise<WorkspaceSnapshot>{
 const events=previous?await replay(previous.conversation,previous.frontier):null
 const query=routeQuery(route)
 if(previous?.rootWindow.target&&!events?.erased)query.set('target',previous.rootWindow.target.id)
 const next=await api<WorkspaceSnapshot & {attention:Attention & Page<Attention['items'][number]>}>('workspace?'+query)
 return completeSnapshot({...next,data:next.data?{...next.data,key:windowKey(route),newMessageCount:events?.newMessageCount??0,frontier:events?.cursor??next.data.frontier}:null})
}
function routeQuery(route:LocationState){
 const query=new URLSearchParams({view:route.view})
 for(const key of ['conversation','thread','focus','panel','before','threadBefore'] as const)if(route[key])query.set(key,route[key]!)
 if(route.landing)query.set('landing','1')
 if(window.matchMedia('(max-width: 850px)').matches)query.set('mobile','1')
 return query
}
export async function sendWorkspace(route:LocationState,input:unknown){
 const query=routeQuery(route);query.set('workspace','1')
 const result=await api<{workspace:WorkspaceSnapshot}>(`conversations/${route.conversation}/messages?${query}`,input),next=result.workspace
 return completeSnapshot({...next,data:next.data?{...next.data,key:windowKey(route)}:null})
}
export async function completeSnapshot(next:WorkspaceSnapshot){
 const [attention,outcomes]=await Promise.all([attentionPages(next.attention as Attention & Page<Attention['items'][number]>),next.data?outcomeHistory(next.data.conversation,next.data.outcomes):[]])
 return {...next,attention,data:next.data?{...next.data,outcomes}:null}
}
async function outcomeHistory(conversation:string,first:Outcome[]):Promise<Outcome[]>{
 if(first.length<1000)return first
 const items:Outcome[]=[...first];let after=first.at(-1)!.id
 for(;;){const page=await api<Outcome[]>(`conversations/${conversation}/outcomes?after=${encodeURIComponent(after)}`);items.push(...page);if(page.length<1000)return items;const next=page.at(-1)!.id;if(next===after)throw Error('Decision history could not be read.');after=next}
}
async function attentionPages(first:Attention & Page<Attention['items'][number]>):Promise<Attention>{
 const items:Attention['items']=[];let after='',deferredCount=0,observedAt=Infinity,dndUntil:number|null=null,nextWakeAt:number|null=null
 for(;;){
  const page=after?await api<Attention & Page<Attention['items'][number]>>('attention?after='+encodeURIComponent(after)):first
  observedAt=Math.min(observedAt,page.observedAt);items.push(...page.items);deferredCount+=page.deferredCount;dndUntil=page.dndUntil
  if(page.nextWakeAt!==null)nextWakeAt=nextWakeAt===null?page.nextWakeAt:Math.min(nextWakeAt,page.nextWakeAt)
  if(!page.hasMore)return {items,reminders:first.reminders,deferredCount,observedAt,dndUntil,nextWakeAt}
  if(page.cursor===after)throw Error('Attention could not be read.');after=page.cursor
 }
}
