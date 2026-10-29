import {formatTime} from './format-time'
import {SavedReminder} from './SavedReminder'
import {useEffect,useId,useRef,useState} from 'react'
import {api} from './api'
import type {Conversation,Person} from './types'
import type {CollectionPage,SavedItem} from './collection-types'
import {conversationName} from './Navigation'
import {usePrivateScope} from './usePrivateScope'
import '../app-style/collections.css'

type Props={user:Person;conversations:Conversation[];revision:number;privateSignal:AbortSignal;onOpen:(conversation:string,focus:string,thread:string|null)=>void;onError:(error:unknown)=>void}
export function SavedView({user,conversations,revision,privateSignal,onOpen,onError}:Props){
 const [page,setPage]=useState<CollectionPage<SavedItem>|null>(null),[loading,setLoading]=useState(false),[busy,setBusy]=useState<string|null>(null),[error,setError]=useState(''),[reload,setReload]=useState(0),[showForm,setShowForm]=useState(false)
 const current=usePrivateScope(privateSignal,'saved'),generation=useRef(0),emptyOpened=useRef(false)
 useEffect(()=>{const refresh=()=>setReload(value=>value+1);window.addEventListener('focus',refresh);return()=>window.removeEventListener('focus',refresh)},[])
 useEffect(()=>{
  let cancelled=false;const epoch=++generation.current,active=()=>!cancelled&&current()&&epoch===generation.current
  const clear=()=>{setPage(null);setError('');setShowForm(false)}
  // Keep keyed reminder editors mounted while focus/live updates refresh the
  // list. Revocation still clears private content synchronously above.
  privateSignal.addEventListener('abort',clear,{once:true});setLoading(true);setError('')
  void api<CollectionPage<SavedItem>>('saved').then(next=>{if(active())setPage(next)}).catch(reason=>{if(active()){setError('Saved items could not be loaded.');onError(reason)}}).finally(()=>{if(active())setLoading(false)})
  return()=>{cancelled=true;generation.current++;privateSignal.removeEventListener('abort',clear)}
 },[revision,reload,current,onError,privateSignal])
 useEffect(()=>{if(!page)return;if(page.items.length){emptyOpened.current=false;return}if(!emptyOpened.current&&conversations.length){emptyOpened.current=true;setShowForm(true)}},[page,conversations.length])
 const more=async()=>{
  if(!page?.cursor||loading||busy||!current())return
  const epoch=generation.current;setLoading(true);setError('')
  try{const next=await api<CollectionPage<SavedItem>>('saved?after='+encodeURIComponent(page.cursor));if(current()&&epoch===generation.current)setPage({...next,items:[...page.items,...next.items.filter(item=>!page.items.some(old=>old.id===item.id))]})}
  catch(reason){if(current()&&epoch===generation.current){setError('More saved items could not be loaded.');onError(reason)}}finally{if(current()&&epoch===generation.current)setLoading(false)}
 }
 const remove=async(id:string)=>{
  if(busy||!current())return;setBusy(id);setError('')
  try{await api('saved/'+encodeURIComponent(id),{},'DELETE');if(current())setReload(value=>value+1)}
  catch(reason){if(current()){setError('This item could not be removed.');onError(reason)}}finally{if(current())setBusy(null)}
 }
 return <section className="page-content saved-page"><div className="page-column">
  <div className="collection-intro"><p className="muted">Only you can see your Saved list.</p><button className="soft-button" aria-expanded={showForm} disabled={!conversations.length} onClick={()=>setShowForm(value=>!value)}>{showForm?'Cancel':'Save a link'}</button></div>
  {showForm&&<SaveLinkForm conversations={conversations} user={user} current={current} onError={onError} onSaved={()=>{setShowForm(false);setReload(value=>value+1)}}/>}
  {error&&<p className="warning" role="alert">{error} <button className="text-button" onClick={()=>setReload(value=>value+1)}>Try again</button></p>}
  <div role="status" className="sr-only">{loading?'Loading saved items':page?`${page.items.length} saved items loaded`:''}</div>
  {page&&<ol className="collection-list" aria-label="Saved items">{page.items.map(item=>{
   const where=item.unavailable?undefined:conversations.find(c=>c.id===item.conversation),place=item.unavailable?'':(item.conversationKind==='dm'?'':'# ')+(where?conversationName(where,user):item.conversationName)
   return <li className="collection-item reveal-host" key={item.id} data-saved={item.id}>
   {item.unavailable?<p className="muted">Saved item unavailable</p>:<>
    {item.kind==='message'&&<><p className="collection-author">{item.message.authorName||'Former member'}</p><p className="message-body collection-excerpt">{item.message.body}</p></>}
    {item.kind==='attachment'&&<a className="collection-download" href={`/api/attachments/${encodeURIComponent(item.attachment.id)}/download`} download={item.attachment.name}>{item.attachment.name}</a>}
    {item.kind==='link'&&<a className="collection-url" href={item.url} target="_blank" rel="noopener noreferrer">{item.url}<span className="sr-only"> (opens in new tab)</span></a>}
   </>}
   <div className="collection-footer"><span className="collection-meta">{item.unavailable?'':place+' · '+(item.kind==='message'?'Message':item.kind==='attachment'?'File · '+Math.max(1,Math.round(item.attachment.size/1024))+' KB':'Link')+' · '}Saved <time dateTime={item.created}>{formatTime(item.created)}</time></span>
    <div className="saved-actions">
     {!item.unavailable&&item.kind==='message'&&<button className="text-button reveal" onClick={()=>{if(current())onOpen(item.conversation,item.message.id,item.message.parent)}}>Open in conversation</button>}
     {!item.unavailable&&item.kind==='attachment'&&<button className="text-button reveal" onClick={()=>{if(current())onOpen(item.conversation,item.attachment.message,null)}}>Open in conversation</button>}
     {!item.unavailable&&<SavedReminder id={item.id} reminder={item.reminder??null} disabled={busy!==null} current={current} onChanged={()=>setReload(value=>value+1)} onError={onError}/>}
     <button className="text-button reveal" disabled={busy!==null} onClick={()=>void remove(item.id)}>{busy===item.id?'Removing…':'Remove from Saved'}</button>
    </div>
   </div>
  </li>})}</ol>}
  {loading&&!page&&<p className="muted">Loading saved items…</p>}
  {page&&!page.items.length&&!conversations.length&&<div className="empty-state"><h2>Save something for later</h2><a className="soft-button" href="/app?view=channels">Browse channels</a></div>}
  {page?.cursor&&<button className="soft-button" disabled={loading||busy!==null} onClick={()=>void more()}>{loading?'Loading…':'Load more saved items'}</button>}
 </div></section>
}

function SaveLinkForm({conversations,user,current,onSaved,onError}:{conversations:Conversation[];user:Person;current:()=>boolean;onSaved:()=>void;onError:(error:unknown)=>void}){
 const fieldId=useId(),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const submit=async(event:React.FormEvent<HTMLFormElement>)=>{
  event.preventDefault();if(busy||!current())return
  const form=new FormData(event.currentTarget),url=String(form.get('url')||'').trim();setError('')
  try{const parsed=new URL(url);if(!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password)throw Error()}catch{setError('Use an HTTP or HTTPS link without credentials.');return}
  setBusy(true)
  try{await api('saved',{conversation:form.get('conversation'),url});if(current())onSaved()}
  catch(reason){if(current()){setError(reason instanceof Error?reason.message:'The link could not be saved.');onError(reason)}}finally{if(current())setBusy(false)}
 }
 return <form className="save-link-form" onSubmit={event=>void submit(event)}><div className="field"><label htmlFor={fieldId+'-conversation'}>Conversation</label><select id={fieldId+'-conversation'} name="conversation" required disabled={busy} autoFocus>{conversations.map(c=><option value={c.id} key={c.id}>{c.kind==='dm'?'':'# '}{conversationName(c,user)}</option>)}</select></div><label className="field">Link<input name="url" type="url" placeholder="https://" maxLength={2048} required disabled={busy}/></label>{error&&<p className="warning" role="alert">{error}</p>}<button className="send" disabled={busy}>{busy?'Saving…':'Save link'}</button></form>
}
