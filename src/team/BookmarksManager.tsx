import {useEffect,useId,useState} from 'react'
import {api} from '../chat/api'
import type {Conversation} from '../chat/types'
import {refusal,type Bookmark,type BookmarkState} from './bookmarks-types'
import './bookmarks.css'
type Kind='link'|'file'|'folder'
// The dialog for adding, reordering and removing bookmarks. A member who may not post sees the bar's contents and the reason, never a control that fails.
export function BookmarksManager({conversation,refresh}:{conversation:Conversation;refresh:()=>Promise<void>}){
 const id=useId(),base=`channels/${encodeURIComponent(conversation.id)}/bookmarks`
 const [state,setState]=useState<BookmarkState|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[kind,setKind]=useState<Kind>('link'),[title,setTitle]=useState(''),[url,setUrl]=useState(''),[file,setFile]=useState(''),[parent,setParent]=useState(''),[files,setFiles]=useState<{id:string;name:string}[]|null>(null)
 const load=async()=>{try{setState(await api<BookmarkState>(base))}catch(e){setError(e instanceof Error?e.message:'Bookmarks could not be loaded.')}}
 useEffect(()=>{void load()},[conversation.id])
 useEffect(()=>{if(kind!=='file'||files)return;void api<{items:{id:string;name:string}[]}>(`conversations/${encodeURIComponent(conversation.id)}/files`).then(page=>setFiles(page.items)).catch(()=>setFiles([]))},[kind,files,conversation.id])
 const change=async(work:()=>Promise<BookmarkState>)=>{if(busy)return;setBusy(true);setError('');try{setState(await work());await refresh()}catch(e){setError(e instanceof Error?e.message:'Please try again.');await load()}finally{setBusy(false)}}
 const add=(event:React.FormEvent)=>{event.preventDefault();void change(async()=>{const next=await api<BookmarkState>(base,{kind,title,...(kind==='link'?{url}:kind==='file'?{file}:{}),...(parent&&kind!=='folder'?{parent}:{})});setTitle('');setUrl('');setFile('');setParent('');return next})}
 const siblings=(item:Bookmark)=>state!.items.filter(i=>i.parent===item.parent).sort((a,b)=>a.position-b.position)
 const move=(item:Bookmark,by:number)=>{const order=siblings(item).map(i=>i.id),at=order.indexOf(item.id);order.splice(at+by,0,...order.splice(at,1));void change(()=>api<BookmarkState>(base,{version:state!.version,parent:item.parent,order},'PATCH'))}
 const remove=(item:Bookmark)=>void change(()=>api<BookmarkState>(`${base}/${encodeURIComponent(item.id)}`,{},'DELETE'))
 if(!state)return error?<p className="warning" role="alert">{error}</p>:<p className="muted">Loading bookmarks…</p>
 const folders=state.items.filter(i=>i.kind==='folder'),ordered=state.items.filter(i=>!i.parent).sort((a,b)=>a.position-b.position).flatMap(i=>[i,...state.items.filter(c=>c.parent===i.id).sort((a,b)=>a.position-b.position)])
 return <div className="bookmark-manager">
  {!state.canManage&&<p className="dialog-note" role="status">{refusal}</p>}
  {error&&<p className="warning" role="alert">{error}</p>}
  {ordered.length>0?<ol className="bookmark-manager-list" aria-label="Bookmarks">{ordered.map(item=>{const group=siblings(item),at=group.findIndex(i=>i.id===item.id);return <li key={item.id}>
   <span className={'bookmark-name'+(item.parent?' bookmark-child':'')}><strong>{item.title}</strong> <small className="muted">{item.kind==='link'?item.url:item.kind==='file'?(item.file?.available?item.file.name:'file unavailable'):'folder'}</small></span>
   {state.canManage&&<><button type="button" className="text-button" disabled={busy||at===0} aria-label={'Move earlier: '+item.title} onClick={()=>move(item,-1)}>Move earlier</button><button type="button" className="text-button" disabled={busy||at===group.length-1} aria-label={'Move later: '+item.title} onClick={()=>move(item,1)}>Move later</button><button type="button" className="text-button" disabled={busy} aria-label={'Remove '+item.title} onClick={()=>remove(item)}>Remove</button></>}
  </li>})}</ol>:<p className="muted">No bookmarks yet.</p>}
  {state.canManage&&<form onSubmit={add} aria-label="Add a bookmark">
   <div className="field"><label htmlFor={id+'-kind'}>Kind</label><select id={id+'-kind'} value={kind} onChange={e=>setKind(e.target.value as Kind)}><option value="link">Link</option><option value="file">File from this channel</option><option value="folder">Folder</option></select></div>
   <div className="field"><label htmlFor={id+'-title'}>Title</label><input id={id+'-title'} value={title} onChange={e=>setTitle(e.target.value)} maxLength={80} required/></div>
   {kind==='link'&&<div className="field"><label htmlFor={id+'-url'}>Web address</label><input id={id+'-url'} type="url" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://" required/></div>}
   {kind==='file'&&<div className="field"><label htmlFor={id+'-file'}>File</label><select id={id+'-file'} value={file} onChange={e=>setFile(e.target.value)} required><option value="">{files?files.length?'Choose a file':'No files in this channel yet':'Loading files…'}</option>{(files??[]).map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></div>}
   {kind!=='folder'&&folders.length>0&&<div className="field"><label htmlFor={id+'-parent'}>Put it in</label><select id={id+'-parent'} value={parent} onChange={e=>setParent(e.target.value)}><option value="">The bar itself</option>{folders.map(f=><option key={f.id} value={f.id}>{f.title}</option>)}</select></div>}
   <button className="soft-button" disabled={busy||state.items.length>=state.limit}>Add bookmark</button>
   {state.items.length>=state.limit&&<p className="dialog-note">A channel holds at most {state.limit} bookmarks.</p>}
  </form>}
 </div>
}
