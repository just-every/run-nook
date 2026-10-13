import type {Attention,FileRecord,LocationState,MessageWindow,Outcome,Page,Projection,Replay} from './types'
const mobileFirstUnreadLanding=true
export class ApiError extends Error { constructor(public status:number,message:string){super(message)} }
export async function api<T>(path:string,data?:unknown,method=data===undefined?'GET':'POST'):Promise<T> {
 const response=await fetch('/api/'+path,{method,headers:data===undefined?undefined:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data),cache:'no-store'})
 return responseValue<T>(response)
}
async function responseValue<T>(response:Response):Promise<T>{
 const value=await response.json() as T & {error?:string}
 if(!response.ok)throw new ApiError(response.status,value.error||'The request could not be completed.')
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
// Drain replay without retaining an unbounded event array. Hints never supply data.
export async function replay(conversation:string,after:number){
 let cursor=after,newMessageCount=0;const kinds=new Set<string>()
 for(;;){
  const page=await api<Replay>(`conversations/${conversation}/replay?after=${cursor}`)
  if(page.cursor<cursor||(page.hasMore&&page.cursor===cursor))throw Error('Conversation updates could not be read. Reopen the conversation.')
  for(const event of page.events){kinds.add(event.kind);if(event.kind==='message')newMessageCount++}
  cursor=page.cursor
  if(!page.hasMore)return {cursor,kinds,newMessageCount}
 }
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
export async function projection(conversation:string,route:LocationState,previous:Projection|null,readSeq:number,unread:number):Promise<Projection>{
 const events=previous?await replay(conversation,previous.frontier):null
 const erased=events?.kinds.has('erasure')??false
 const messageChanged=!previous||previous.rootWindow.readSeq!==readSeq||events?.kinds.has('message')||events?.kinds.has('edit')||events?.kinds.has('delete')||events?.kinds.has('attachment-delete')||erased
 const explicitPosition=!route.landing&&Boolean(route.thread||route.focus||route.panel==='outcomes'||route.before||route.threadBefore)
 const mobileFirstUnread=mobileFirstUnreadLanding&&route.landing&&(!previous||erased)&&route.view==='chat'&&!explicitPosition&&unread>0&&window.matchMedia('(max-width: 850px)').matches
 // Erasure invalidates an implicit target. Explicit links retain their normal
 // unavailable-message response; they never silently move to another message.
 const retainedTarget=mobileFirstUnreadLanding&&route.landing&&!erased&&!explicitPosition?previous?.rootWindow.target?.id??route.focus:null
 const rootOptions=route.before?{before:route.before}:explicitPosition&&route.focus&&!route.thread&&route.panel!=='outcomes'?{around:route.focus}:retainedTarget?{around:retainedTarget}:mobileFirstUnread?{firstUnread:true}:{}
 const [rootWindow,outcomes,members,roster,preferences]=await Promise.all([
  messageChanged?messageWindow(conversation,rootOptions):Promise.resolve(previous!.rootWindow),
  !previous||events?.kinds.has('outcome')||events?.kinds.has('edit')||events?.kinds.has('delete')||events?.kinds.has('erasure')?outcomeHistory(conversation):Promise.resolve(previous.outcomes),
  api<Projection['members']>(`conversations/${conversation}/members`),
  api<Projection['roster']>(`conversations/${conversation}/roster`),
  api<Projection['preferences']>(`conversations/${conversation}/preferences`),
 ])
 // Implicit reply landing follows the newly authorized target after erasure,
 // rather than issuing a request for the previous, now unavailable reply.
 const thread=route.landing?rootWindow.target?.parent?rootWindow.target.root:null:route.thread
 const threadOptions={thread,before:route.threadBefore,around:route.threadBefore?null:route.landing?rootWindow.target?.id:route.focus}
 const threadWindow=thread?(messageChanged?await messageWindow(conversation,threadOptions):previous!.threadWindow):null
 // A new view starts at its authorized window snapshot, not at event zero. Later
 // updates exhaust replay from this frontier before refreshing bounded windows.
 const frontier=events?.cursor??Math.min(rootWindow.frontier,threadWindow?.frontier??rootWindow.frontier)
 return {key:windowKey(route),conversation,rootWindow,threadWindow,outcomes,members,roster,preferences,frontier,newMessageCount:events?.newMessageCount??0}
}
async function outcomeHistory(conversation:string):Promise<Outcome[]>{
 const items:Outcome[]=[];let after=''
 for(;;){const page=await api<Outcome[]>(`conversations/${conversation}/outcomes?after=${encodeURIComponent(after)}`);items.push(...page);if(page.length<1000)return items;const next=page.at(-1)!.id;if(next===after)throw Error('Decision history could not be read.');after=next}
}
export async function attentionPages():Promise<Attention>{
 const items:Attention['items']=[];let after='',deferredCount=0,observedAt=Infinity,dndUntil:number|null=null,nextWakeAt:number|null=null
 for(;;){
  const page=await api<Attention & Page<Attention['items'][number]>>('attention?after='+encodeURIComponent(after))
  observedAt=Math.min(observedAt,page.observedAt);items.push(...page.items);deferredCount+=page.deferredCount;dndUntil=page.dndUntil
  if(page.nextWakeAt!==null)nextWakeAt=nextWakeAt===null?page.nextWakeAt:Math.min(nextWakeAt,page.nextWakeAt)
  if(!page.hasMore)return {items,deferredCount,observedAt,dndUntil,nextWakeAt}
  if(page.cursor===after)throw Error('Attention could not be read.');after=page.cursor
 }
}
