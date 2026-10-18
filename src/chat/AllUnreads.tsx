import {useEffect,useState} from 'react'
import {api} from './api'
import type {Conversation,Message,Person} from './types'
import {conversationName} from './Navigation'
import {usePrivateScope} from './usePrivateScope'
import '../app-style/threads.css'

type Messages={items:Message[];cursor:string;hasMore:boolean}
type UnreadItem=Messages&{conversation:Conversation}
type UnreadPage={items:UnreadItem[];cursor:string;hasMore:boolean}
type Props={user:Person;conversations:Conversation[];revision:number;privateSignal:AbortSignal;onOpen:(conversation:string,message:string,thread:string|null)=>void;onError:(error:unknown)=>void;mark:(conversation?:string)=>void;busy:boolean}
export function AllUnreads({user,conversations,revision,privateSignal,onOpen,onError,mark,busy}:Props){
 const [page,setPage]=useState<UnreadPage|null>(null),[loading,setLoading]=useState(false)
 const current=usePrivateScope(privateSignal,'unreads')
 useEffect(()=>{let cancelled=false;setLoading(true);void api<UnreadPage>('unreads').then(value=>{if(!cancelled&&current())setPage(value)}).catch(e=>{if(!cancelled&&current())onError(e)}).finally(()=>{if(!cancelled&&current())setLoading(false)});return()=>{cancelled=true}},[revision,current,onError])
 const more=async(item?:UnreadItem)=>{setLoading(true);try{if(item){const next=await api<Messages>('unreads?conversation='+item.conversation.id+'&after='+item.cursor);if(current())setPage(previous=>previous&&({...previous,items:previous.items.map(row=>row===item?{...row,...next,items:[...row.items,...next.items]}:row)}))}else if(page){const next=await api<UnreadPage>('unreads?after='+page.cursor);if(current())setPage({...next,items:[...page.items,...next.items]})}}catch(e){if(current())onError(e)}finally{if(current())setLoading(false)}}
 return <section className="page-content threads-page"><div className="page-column"><div className="thread-actions"><p className="muted">Unread messages in sidebar order. Reading this list does not mark them read.</p><button className="soft-button" disabled={busy||!conversations.some(c=>c.unread>0)} onClick={()=>mark()}>Mark all read</button></div><p className="sr-only" role="status">{loading?'Loading unread messages':''}</p>
 {page?.items.map(item=><article className="thread-card" key={item.conversation.id} aria-label={'Unread in '+conversationName(conversations.find(c=>c.id===item.conversation.id)??item.conversation,user)}><div className="thread-context"><h2>{conversationName(conversations.find(c=>c.id===item.conversation.id)??item.conversation,user)}</h2><button className="soft-button" disabled={busy} onClick={()=>mark(item.conversation.id)}>Mark conversation read</button></div>{item.items.map(message=><div className="thread-inline-message" key={message.id}><strong>{message.authorName}</strong><time dateTime={message.created}> · {new Date(message.created).toLocaleString()}</time><p className="message-body">{message.body}</p><button className="text-button" onClick={()=>onOpen(message.conversation,message.id,message.parent)}>Open {message.parent?'reply':'message'}</button></div>)}{item.hasMore&&<button className="soft-button" disabled={loading} onClick={()=>void more(item)}>More unread messages</button>}</article>)}
 {page&&!page.items.length&&<div className="empty-state"><h2>You’re all caught up</h2><p>New unread messages will appear here. Attention and accepted work stay separate.</p></div>}{page?.hasMore&&<button className="soft-button" disabled={loading} onClick={()=>void more()}>More unread conversations</button>}
 </div></section>
}
