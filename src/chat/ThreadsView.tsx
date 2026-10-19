import {useEffect,useState} from 'react'
import {api,messageWindow} from './api'
import type {Conversation,FollowSource,Message,MessageWindow,Person} from './types'
import {conversationName} from './Navigation'
import {Composer} from './Composer'
import {usePrivateScope} from './usePrivateScope'
import {Avatar} from './Avatar'
import {NookMark} from '../brand/NookMark'
import '../app-style/threads.css'

type ThreadItem={root:Message;conversation:Conversation;source:FollowSource;unread:number;latestReplyAt:string;lastSequence:number}
type ThreadPage={items:ThreadItem[];cursor:string|null;hasMore:boolean}
const excerpt=(body:string)=>{const characters=Array.from(body);return characters.length>360?characters.slice(0,360).join('')+'…':body}
const sourceText:Record<FollowSource,string>={explicit:'You followed this thread',authored:'You started this thread',replied:'You replied',mentioned:'You were mentioned',dm:'Direct conversation',all:'All thread replies in this conversation'}
type Props={onEditLast?:(message:Message)=>void;user:Person;conversations:Conversation[];revision:number;privateSignal:AbortSignal;refresh:()=>Promise<void>;beginWrite:()=>()=>void;onOpen:(conversation:string,focus:string,thread:string)=>void;onError:(error:unknown)=>void}

export function ThreadsView(props:Props){
 const {revision,privateSignal,onError}=props
 const [page,setPage]=useState<ThreadPage|null>(null),[busy,setBusy]=useState(false),[expanded,setExpanded]=useState<string|null>(null)
 const current=usePrivateScope(privateSignal,'threads')
 useEffect(()=>{let cancelled=false;setBusy(true);void api<ThreadPage>('threads').then(next=>{if(!cancelled&&current())setPage(next)}).catch(error=>{if(!cancelled&&current())onError(error)}).finally(()=>{if(!cancelled&&current())setBusy(false)});return()=>{cancelled=true}},[revision,current,onError])
 const more=async()=>{if(!page?.cursor||busy||!current())return;setBusy(true);try{const next=await api<ThreadPage>('threads?after='+encodeURIComponent(page.cursor));if(current())setPage({...next,items:[...page.items,...next.items.filter(item=>!page.items.some(old=>old.root.id===item.root.id))]})}catch(error){if(current())onError(error)}finally{if(current())setBusy(false)}}
 return <section className="page-content threads-page"><div className="page-column">
  <p className="muted threads-intro">Replies to conversations you’re part of, together in one place.</p>
  <div role="status" className="sr-only">{busy?'Loading threads':`${page?.items.length??0} followed threads`}</div>
  {page?.items.filter(item=>props.conversations.some(c=>c.id===item.root.conversation)).map(item=><ThreadCard key={item.root.id} {...props} item={item} expanded={expanded===item.root.id} toggle={()=>setExpanded(expanded===item.root.id?null:item.root.id)}/>)}
  {page&&!page.items.length&&<div className="empty-state"><NookMark/><h2>A place for the replies</h2><p>Threads you start, reply to, follow or are mentioned in appear here. Muted conversations show only threads you explicitly follow.</p></div>}
  {page?.hasMore&&<button className="soft-button" disabled={busy} onClick={()=>void more()}>Load more threads</button>}
 </div></section>
}

function ThreadCard({item,expanded,toggle,user,conversations,privateSignal,refresh,beginWrite,onOpen,onError,onEditLast}:Props&{item:ThreadItem;expanded:boolean;toggle:()=>void}){
 const [window,setWindow]=useState<MessageWindow|null>(null),[members,setMembers]=useState<Person[]>([]),[busy,setBusy]=useState(false)
 const current=usePrivateScope(privateSignal,'threads:'+item.root.id)
 const conversation=conversations.find(c=>c.id===item.root.conversation)??item.conversation
 useEffect(()=>{let cancelled=false;if(!expanded)return;void Promise.all([messageWindow(item.root.conversation,{thread:item.root.id}),api<Person[]>(`conversations/${item.root.conversation}/members`)]).then(([messages,people])=>{if(!cancelled&&current()){setWindow(messages);setMembers(people)}}).catch(error=>{if(!cancelled&&current())onError(error)});return()=>{cancelled=true}},[expanded,item.root.id,item.lastSequence,current,onError])
 const act=async(path:string,input:unknown)=>{setBusy(true);try{await api(path,input);if(current())await refresh()}catch(error){if(current())onError(error)}finally{if(current())setBusy(false)}}
 const send=async(input:unknown)=>{await api(`conversations/${item.root.conversation}/messages`,input)}
 const name=conversationName(conversation,user)
 return <article className="thread-card" aria-label={'Thread in '+name}>
  <div className="thread-context"><button className="text-button" onClick={()=>onOpen(item.root.conversation,item.root.id,item.root.id)}>{conversation.kind==='dm'?'':'# '}{name}</button>{item.unread>0&&<span className="count">{item.unread} unread {item.unread===1?'reply':'replies'}</span>}</div>
  <div className="thread-author"><Avatar person={{id:item.root.author??'former',name:item.root.authorName}} size={28}/><strong>{item.root.authorName}</strong><time dateTime={item.root.created}>{new Date(item.root.created).toLocaleDateString(undefined,{month:'short',day:'numeric'})}</time></div>
  <p className="message-body thread-excerpt">{item.root.deleted?'Message deleted':excerpt(item.root.body)}</p>
  <p className="thread-source">{sourceText[item.source]}</p>
  <div className="thread-actions"><button className="soft-button" aria-expanded={expanded} onClick={toggle}>{expanded?'Close replies':conversation.archived?'View replies':'Reply in thread'}</button>{item.unread>0&&<button className="soft-button" disabled={busy} onClick={()=>void act(`messages/${item.root.id}/read`,{seq:item.lastSequence,conversation:item.root.conversation})}>Mark thread read</button>}<button className="text-button" disabled={busy} onClick={()=>void act(`messages/${item.root.id}/follow`,{follow:false})}>Unfollow thread</button></div>
  {expanded&&<div className="thread-inline">{window?<><div className="thread-inline-replies">{window.hasMore&&<button className="text-button" onClick={()=>onOpen(item.root.conversation,item.root.id,item.root.id)}>Open earlier replies</button>}{window.items.map(reply=><div className="thread-inline-message" key={reply.id}><strong>{reply.authorName}</strong><p className="message-body">{reply.deleted?'Message deleted':reply.body}</p></div>)}{!window.items.length&&<p className="muted">No replies yet.</p>}</div>{!conversation.archived&&!item.root.deleted&&<Composer onEditLast={onEditLast} restricted={conversation.canReply===false||conversation.canReply===0} user={user} conversation={item.root.conversation} name={name} parent={item.root.id} members={members} privateSignal={privateSignal} viewCurrent={current} beginWrite={beginWrite} sendMessage={send} onSent={refresh} onError={onError}/>}</>:<p className="muted">Loading replies…</p>}</div>}
 </article>
}
