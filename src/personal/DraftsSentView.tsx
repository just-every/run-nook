import {useEffect,useState} from 'react'
import {api} from '../chat/api'
import {conversationName} from '../chat/Navigation'
import type {Conversation,Page,Person} from '../chat/types'
import {usePrivateScope} from '../chat/usePrivateScope'
import {ScheduledView} from '../scheduled/ScheduledView'
import {localDrafts,type LocalDraft} from './local-drafts'
import '../app-style/threads.css'
import './personal.css'
type Sent={id:string;conversation:string;parent:string|null;body:string;created:string;name:string;kind:string}
type Props={user:Person;conversations:Conversation[];revision:number;privateSignal:AbortSignal;onError:(e:unknown)=>void;onOpen:(conversation:string,message:string|null,thread:string|null)=>void;refresh:()=>Promise<void>}
export function DraftsSentView(props:Props){
 const [section,setSection]=useState<'drafts'|'scheduled'|'sent'>('drafts')
 return <><nav className="personal-tabs" aria-label="Drafts and sent sections">{(['drafts','scheduled','sent'] as const).map(value=><button className="soft-button" key={value} aria-pressed={section===value} onClick={()=>setSection(value)}>{value==='drafts'?'Drafts':value==='scheduled'?'Scheduled':'Sent'}</button>)}</nav>{section==='scheduled'?<ScheduledView {...props} onOpen={(conversation,message,thread)=>props.onOpen(conversation,message,thread)}/>:section==='drafts'?<DraftList {...props}/>:<SentList {...props}/>}</>
}
function DraftList({user,conversations,onOpen,onError}:Props){
 const [items,setItems]=useState<LocalDraft[]>([])
 useEffect(()=>{const update=()=>{try{setItems(localDrafts(user.id,new Set(conversations.map(c=>c.id))))}catch(e){setItems([]);onError(e)}};update();window.addEventListener('storage',update);return()=>window.removeEventListener('storage',update)},[user.id,conversations,onError])
 return <section className="page-content threads-page"><div className="page-column">{!!items.length&&<p className="muted">Drafts saved in this browser.</p>}{items.filter(item=>conversations.some(c=>c.id===item.scope.conversation)).map(({scope,draft})=>{const conversation=conversations.find(c=>c.id===scope.conversation)!;return <article className="thread-card" key={scope.conversation+':'+scope.parent} aria-label={'Draft in '+conversationName(conversation,user)}><div className="thread-context"><h2>{conversationName(conversation,user)}{scope.parent?' · Thread':''}</h2><strong>{draft.pending?'Delivery unconfirmed':draft.delivery==='failed'?'Not sent':'Draft'}</strong></div><p className="message-body">{draft.body}</p>{draft.files.length>0&&<ul>{draft.files.map(file=><li key={file.id}>{file.name}</li>)}</ul>}{draft.upload&&<p>Unconfirmed upload: {draft.upload.name}</p>}{draft.failure&&<p className="warning">{draft.failure}</p>}<button className="soft-button" onClick={()=>onOpen(scope.conversation,null,scope.parent)}>Continue draft</button></article>})}{!items.length&&<div className="empty-state"><h2>No drafts in this browser</h2><p>Start a message in a conversation and return here when you’re ready.</p></div>}</div></section>
}
function SentList({revision,privateSignal,onError,onOpen}:Props){
 const [page,setPage]=useState<Page<Sent>|null>(null),[busy,setBusy]=useState(false),current=usePrivateScope(privateSignal,'personal-sent:'+revision)
 useEffect(()=>{let cancelled=false;setPage(null);void api<Page<Sent>>('sent').then(value=>{if(!cancelled&&current())setPage(value)}).catch(e=>{if(!cancelled&&current())onError(e)});return()=>{cancelled=true}},[revision,current,onError])
 const more=async()=>{if(!page)return;setBusy(true);try{const next=await api<Page<Sent>>('sent?after='+encodeURIComponent(page.cursor));if(current())setPage({...next,items:[...page.items,...next.items.filter(item=>!page.items.some(old=>old.id===item.id))]})}catch(e){if(current())onError(e)}finally{if(current())setBusy(false)}}
 return <section className="page-content threads-page"><div className="page-column"><p className="muted">Sent in the last 30 days.</p>{page?.items.map(item=><article className="thread-card" key={item.id}><div className="thread-context"><h2>{item.kind==='dm'?'Direct conversation':item.name}{item.parent?' · Thread':''}</h2><time dateTime={item.created}>{new Date(item.created).toLocaleString()}</time></div><p className="message-body">{item.body}</p><button className="soft-button" onClick={()=>onOpen(item.conversation,item.id,item.parent)}>Open sent message</button></article>)}{page&&!page.items.length&&<div className="empty-state"><h2>No recent sent messages</h2></div>}{page?.hasMore&&<button className="soft-button" disabled={busy} onClick={()=>void more()}>Older sent messages</button>}{!page&&<p role="status">Loading sent messages…</p>}</div></section>
}
