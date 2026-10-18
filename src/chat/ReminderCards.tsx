import type {SavedItem} from './collection-types'
export function ReminderCards({items,hasMore,onOpen,mutate}:{items:SavedItem[];hasMore:boolean;onOpen:(conversation:string,message?:string|null,thread?:string|null)=>void;mutate:(path:string,input:unknown)=>Promise<unknown>}){
 const act=(id:string,action:string)=>void mutate(`attention/saved:${id}`,{action,...(action==='snooze'?{until:Date.now()+3600000}:{})}).catch(()=>{})
 return <>{items.filter(item=>!item.unavailable).map(item=>!item.unavailable&&<article className="attention-card" key={item.id} data-reminder={item.id}>
  <div className="attention-context">{item.conversationName} · Your reminder</div>
  {item.kind==='message'?<p className="message-body">{item.message.body}</p>:item.kind==='attachment'?<a href={`/api/attachments/${encodeURIComponent(item.attachment.id)}/download`} download={item.attachment.name}>{item.attachment.name}</a>:<a href={item.url} target="_blank" rel="noopener noreferrer">{item.url}</a>}
  <div className="card-actions">{item.kind!=='link'&&<button className="soft-button" onClick={()=>onOpen(item.conversation,item.kind==='message'?item.message.id:item.attachment.message,item.kind==='message'?item.message.parent:null)}>Open in conversation</button>}<button className="soft-button" onClick={()=>act(item.id,'done')}>Dismiss reminder</button><button className="soft-button" onClick={()=>act(item.id,'snooze')}>Remind me in an hour</button></div>
 </article>)}{hasMore&&<p className="muted">More reminders are due. Open Saved from You to see and manage the full list.</p>}</>
}
