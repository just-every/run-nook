import {InertPreview} from './InertPreview'
import {useCallback,useEffect,useId,useRef,useState} from 'react'
import {api,ApiError} from '../chat/api'
import type {Conversation,Person} from '../chat/types'
import {conversationName} from '../chat/Navigation'
import {usePrivateScope} from '../chat/usePrivateScope'
import {ImagePreview} from '../team/ImagePreview'
import type {FilesPage,FileType} from './types'
import '../app-style/search.css'
import '../app-style/collections.css'
import './files.css'

type Props={
 conversations:Conversation[];users:Person[];user:Person;conversation?:string
 revision:number;privateSignal:AbortSignal;onError:(error:unknown)=>void
 onOpen:(conversation:string,message:string,thread:string|null)=>void
}
export function FilesView({conversations,users,user,conversation,revision,privateSignal,onError,onOpen}:Props){
 const id=useId(),[selected,setSelected]=useState(''),[person,setPerson]=useState(''),[type,setType]=useState<FileType>('')
 const [result,setResult]=useState<{key:string;page:FilesPage}|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState(''),[reload,setReload]=useState(0)
 const query=new URLSearchParams({conversation:conversation??selected,person,type}).toString(),key=user.id+':'+query
 const current=usePrivateScope(privateSignal,'files:'+key),generation=useRef(0),page=result?.key===key&&!privateSignal.aborted?result.page:null
 useEffect(()=>{
  let cancelled=false;const epoch=++generation.current,active=()=>!cancelled&&current()&&epoch===generation.current
  const clear=()=>{setResult(null);setError('')}
  privateSignal.addEventListener('abort',clear,{once:true});setResult(null);setLoading(true);setError('')
  void api<FilesPage>('files?'+query).then(value=>{if(active())setResult({key,page:value})}).catch(reason=>{if(active()){setError('Files could not be loaded.');onError(reason)}}).finally(()=>{if(active())setLoading(false)})
  return()=>{cancelled=true;generation.current++;privateSignal.removeEventListener('abort',clear)}
 },[query,key,revision,reload,current,onError,privateSignal])
 const denied=useCallback(()=>{if(current()){setResult(null);onError(new ApiError(403,'Conversation access denied'))}},[current,onError])
 const more=async()=>{
  if(!page?.hasMore||loading||!current())return
  const epoch=generation.current;setLoading(true);setError('')
  try{
   const next=await api<FilesPage>('files?'+query+'&after='+encodeURIComponent(page.cursor))
   if(current()&&epoch===generation.current)setResult({key,page:{...next,items:[...page.items,...next.items.filter(item=>!page.items.some(old=>old.id===item.id))]}})
  }catch(reason){if(current()&&epoch===generation.current){setError('More files could not be loaded.');onError(reason)}}finally{if(current()&&epoch===generation.current)setLoading(false)}
 }
 return <section className="page-content"><div className="page-column">
  <div className="search-filter-fields">
   {!conversation&&<div className="field"><label htmlFor={id+'-conversation'}>Conversation</label><select id={id+'-conversation'} value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Any conversation</option>{conversations.map(room=><option key={room.id} value={room.id}>{room.kind==='dm'?'':'# '}{conversationName(room,user)}</option>)}</select></div>}
   <div className="field"><label htmlFor={id+'-person'}>Person</label><select id={id+'-person'} value={person} onChange={e=>setPerson(e.target.value)}><option value="">Anyone</option><option value="me">Me</option>{users.filter(p=>p.id!==user.id).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
   <div className="field"><label htmlFor={id+'-type'}>File type</label><select id={id+'-type'} value={type} onChange={e=>setType(e.target.value as FileType)}><option value="">Any type</option><option value="image">Images</option><option value="pdf">PDFs</option><option value="text">Text</option><option value="other">Other files</option></select></div>
  </div>
  {error&&<p className="warning" role="alert">{error} <button className="text-button" onClick={()=>setReload(value=>value+1)}>Try again</button></p>}
  <p className="sr-only" role="status">{loading?'Loading files':page?`${page.items.length} files loaded${page.hasMore?', more available':''}`:''}</p>
  {page?.items.map(file=>{
   const room=conversations.find(room=>room.id===file.conversation)
   return <article className="search-result" aria-label={'File '+file.name} key={file.id}>
    <p className="search-meta">{room?(room.kind==='dm'?'':'# ')+conversationName(room,user)+' · ':''}{file.authorName} · {file.source==='imported'?'Imported':'Native'} · <time dateTime={file.created}>{new Date(file.created).toLocaleString()}</time></p>
    <a className="collection-download" href={`/api/${file.source==='imported'?'import-files':'attachments'}/${encodeURIComponent(file.id)}/download`} download={file.name}>{file.name}</a>
    <p className="collection-meta">{Math.max(1,Math.round(file.size/1024))} KB · {file.mime}</p>
    <InertPreview attachment={file} accessEpoch={key+':'+revision} onDenied={denied}/>
    <ImagePreview attachment={file} accessEpoch={key+':'+revision} onDenied={denied}/>
    <button className="soft-button" onClick={()=>{if(current())onOpen(file.conversation,file.message,file.parent)}}>Open in conversation</button>
   </article>
  })}
  {page?.hasMore&&<button className="soft-button" disabled={loading} onClick={()=>void more()}>Load more files</button>}
  {loading&&<p className="muted">Loading files…</p>}
  {page&&!page.items.length&&<p className="empty-state">No shared files match these filters.</p>}
 </div></section>
}
