import {useEffect,useRef,useState} from 'react'
import {api} from './api'
import type {Conversation} from './types'
import type {CollectionPage,PinnedItem} from './collection-types'
import {usePrivateScope} from './usePrivateScope'
import '../app-style/collections.css'

type Props={conversation:Conversation;privateSignal:AbortSignal;revision:number;refresh:()=>Promise<void>;onOpen:(conversation:string,focus:string,thread:string|null)=>void;onError:(error:unknown)=>void}
export function PinsView({conversation,privateSignal,revision,refresh,onOpen,onError}:Props){
 const [page,setPage]=useState<CollectionPage<PinnedItem>|null>(null),[loading,setLoading]=useState(false),[busy,setBusy]=useState<string|null>(null),[error,setError]=useState(''),[reload,setReload]=useState(0)
 const current=usePrivateScope(privateSignal,'pins:'+conversation.id),generation=useRef(0),path=`conversations/${encodeURIComponent(conversation.id)}/pins`
 useEffect(()=>{const focus=()=>setReload(value=>value+1);window.addEventListener('focus',focus);return()=>window.removeEventListener('focus',focus)},[])
 useEffect(()=>{
  let cancelled=false;const epoch=++generation.current,active=()=>!cancelled&&current()&&epoch===generation.current,clear=()=>setPage(null)
  privateSignal.addEventListener('abort',clear,{once:true});setPage(null);setLoading(true);setError('')
  void api<CollectionPage<PinnedItem>>(path).then(next=>{if(active())setPage(next)}).catch(reason=>{if(active()){setError('Pinned messages could not be loaded.');onError(reason)}}).finally(()=>{if(active())setLoading(false)})
  return()=>{cancelled=true;generation.current++;privateSignal.removeEventListener('abort',clear)}
 },[path,revision,reload,current,onError,privateSignal])
 const more=async()=>{
  if(!page?.cursor||loading||busy||!current())return
  const epoch=generation.current;setLoading(true);setError('')
  try{const next=await api<CollectionPage<PinnedItem>>(path+'?after='+encodeURIComponent(page.cursor));if(current()&&epoch===generation.current)setPage({...next,items:[...page.items,...next.items.filter(item=>!page.items.some(old=>old.id===item.id))]})}
  catch(reason){if(current()&&epoch===generation.current){setError('More pinned messages could not be loaded.');onError(reason)}}finally{if(current()&&epoch===generation.current)setLoading(false)}
 }
 const unpin=async(item:PinnedItem)=>{
  if(conversation.archived||busy||!current())return;setBusy(item.id);setError('')
  try{await api(path+'/'+encodeURIComponent(item.id),{},'DELETE');if(current()){setReload(value=>value+1);await refresh()}}
  catch(reason){if(current()){setError('This message could not be unpinned.');onError(reason)}}finally{if(current())setBusy(null)}
 }
 return <div className="pins-view"><p className="muted collection-intro">Pinned messages are shared with everyone in this channel.{conversation.archived?' This channel is archived.':''}</p>
  {error&&<p className="warning" role="alert">{error} <button className="text-button" onClick={()=>setReload(value=>value+1)}>Try again</button></p>}
  <div role="status" className="sr-only">{loading?'Loading pinned messages':page?`${page.items.length} pinned messages loaded`:''}</div>
  {page&&<ol className="collection-list" aria-label="Pinned messages">{page.items.map(item=><li className="collection-item" key={item.id}>
   {item.unavailable?<p className="muted">Pinned message unavailable</p>:<><p className="collection-author">{item.message.authorName||'Former member'}</p><p className="message-body collection-excerpt">{item.message.body}</p></>}
   <p className="collection-meta">Pinned{item.pinnedBy?' by '+item.pinnedBy.name:''} · <time dateTime={item.created}>{new Date(item.created).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'})}</time></p>
   <div className="collection-actions">{!item.unavailable&&<button className="text-button" onClick={()=>{if(current())onOpen(item.conversation,item.message.id,item.message.parent)}}>Open in conversation</button>}{!conversation.archived&&<button className="text-button" disabled={busy!==null} onClick={()=>void unpin(item)}>{busy===item.id?'Unpinning…':'Unpin'}</button>}</div>
  </li>)}</ol>}
  {loading&&!page&&<p className="muted">Loading pinned messages…</p>}
  {page&&!page.items.length&&<p className="muted">No pinned messages yet. Use a message’s options to pin it for this channel.</p>}
  {page?.cursor&&<button className="soft-button" disabled={loading||busy!==null} onClick={()=>void more()}>{loading?'Loading…':'Load more pinned messages'}</button>}
 </div>
}
