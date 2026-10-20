import {useEffect,useId,useRef,useState} from 'react'
import type {FormEvent} from 'react'
import type {TeamRequest} from '../team/types'
import type {NoteContent,NoteItem} from './input'

type Note=NoteContent&{id:string;version:number;created:string;updated:string;pinnedBy:string|null;pinnedAt:string|null;deleted:boolean}
type Revision=NoteContent&{version:number;actorName:string|null;created:string;reverted_from:number|null;deleted:boolean}
type Proposal={outcome:string;item:string;noteVersion:number;created:string}
type Page<T>={items:T[];cursor:string|number|null}
type Props={conversation:string;thread?:string|null;request:TeamRequest;people:{id:string;name:string}[];onClose:()=>void}
const when=(value:string)=>new Date(value).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'})
const payload=(note:NoteContent)=>({title:note.title,body:note.body,items:note.items,links:note.links,pinned:note.pinned})
const empty=():NoteContent=>({title:'',body:'',items:[],links:[],pinned:false})
const problem=(error:unknown)=>error instanceof Error?error.message:'The note could not be loaded or saved. Please try again.'

// Remounting owns the private scope: no draft or late response crosses it.
export function NotesPanel(props:Props){return <NotesScope key={JSON.stringify([props.conversation,props.thread??null])} {...props}/>}
function NotesScope({conversation,thread,request,people,onClose}:Props){
 const [page,setPage]=useState<Page<Note>|null>(null),[selected,setSelected]=useState<Note|null>(null),[editing,setEditing]=useState(false),[creating,setCreating]=useState(false)
 const [history,setHistory]=useState<Page<Revision>|null>(null),[proposals,setProposals]=useState<Page<Proposal>|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false)
 const controller=useRef<AbortController|null>(null),selection=useRef(0)
 const base=`/api/conversations/${encodeURIComponent(conversation)}/notes`,query=thread?'thread='+encodeURIComponent(thread):''
 const send=<T,>(path:string,method='GET',body?:unknown)=>request<T>(path,{method,signal:controller.current?.signal,...(body===undefined?{}:{body:JSON.stringify(body)})})
 async function load(after?:string){
  const lifetime=controller.current,active=()=>!!lifetime&&controller.current===lifetime&&!lifetime.signal.aborted
  setBusy(true);setError('')
  try{const next=await send<Page<Note>>(base+'?'+[query,after?'after='+encodeURIComponent(after):''].filter(Boolean).join('&'));if(active())setPage(old=>after&&old?{...next,items:[...old.items,...next.items]}:next)}
  catch(error){if(active())setError(problem(error))}finally{if(active())setBusy(false)}
 }
 useEffect(()=>{const abort=new AbortController();controller.current=abort;void load();return()=>abort.abort()},[base,query,request])
 async function choose(note:Note){
  const lifetime=controller.current,active=()=>!!lifetime&&controller.current===lifetime&&!lifetime.signal.aborted
  const epoch=++selection.current;setSelected(null);setCreating(false);setEditing(false);setHistory(null);setProposals(null);setError('');setNotice('');setBusy(true)
  try{const [fresh,links]=await Promise.all([send<Note>(base+'/'+encodeURIComponent(note.id)),send<Page<Proposal>>(base+'/'+encodeURIComponent(note.id)+'/proposals')]);if(active()&&selection.current===epoch){setSelected(fresh);setProposals(links)}}
  catch(error){if(active()&&selection.current===epoch)setError(problem(error))}finally{if(active()&&selection.current===epoch)setBusy(false)}
 }
 async function mutate(path:string,method:string,body:unknown,message:string){
  const lifetime=controller.current,active=()=>!!lifetime&&controller.current===lifetime&&!lifetime.signal.aborted
  if(busy||!active())return;setBusy(true);setError('');setNotice('')
  try{const next=await send<Note>(path,method,body);if(!active())return;setSelected(next);setCreating(false);setEditing(false);setHistory(null);setNotice(message);setPage(old=>old?{...old,items:old.items.some(n=>n.id===next.id)?old.items.map(n=>n.id===next.id?next:n):[next,...old.items]}:old)}
  catch(error){if(active())setError(problem(error))}finally{if(active())setBusy(false)}
 }
 const notePath=selected?base+'/'+encodeURIComponent(selected.id):base
 async function loadHistory(before?:number){
  const lifetime=controller.current,active=()=>!!lifetime&&controller.current===lifetime&&!lifetime.signal.aborted
  if(!selected||busy)return;setBusy(true);setError('')
  try{const next=await send<Page<Revision>>(notePath+'/history'+(before?'?before='+before:''));if(active())setHistory(old=>before&&old?{...next,items:[...old.items,...next.items]}:next)}catch(error){if(active())setError(problem(error))}finally{if(active())setBusy(false)}
 }
 async function propose(item:NoteItem,assignee:string){
  const lifetime=controller.current,active=()=>!!lifetime&&controller.current===lifetime&&!lifetime.signal.aborted
  if(!selected||busy)return;setBusy(true);setError('');setNotice('')
  try{await send(notePath+'/proposals','POST',{version:selected.version,item:item.id,assignee});const next=await send<Page<Proposal>>(notePath+'/proposals');if(active()){setProposals(next);setNotice('Request proposed. The assignee must accept separately in Decisions & requests.')}}catch(error){if(active())setError(problem(error))}finally{if(active())setBusy(false)}
 }
 async function moreProposals(){
  const lifetime=controller.current,active=()=>!!lifetime&&controller.current===lifetime&&!lifetime.signal.aborted
  if(!proposals?.cursor||busy)return;setBusy(true);setError('')
  try{const next=await send<Page<Proposal>>(notePath+'/proposals?after='+encodeURIComponent(String(proposals.cursor)));if(active())setProposals(old=>old?{...next,items:[...old.items,...next.items]}:next)}catch(error){if(active())setError(problem(error))}finally{if(active())setBusy(false)}
 }
 const start=()=>{selection.current++;setSelected(null);setCreating(true);setEditing(false);setHistory(null);setProposals(null);setNotice('');setError('')}
 return <section className="notes-panel" aria-label={thread?'Thread notes':'Conversation notes'} aria-busy={busy}>
  <div className="panel-bar"><h2>{thread?'Thread notes':'Notes & lists'}</h2><button className="soft-button" onClick={onClose}>Close notes</button></div>
  <div className="panel-scroll notes-scroll">
   <p className="notes-intro">Shared with this conversation’s current members.</p>
   {error&&<p className="warning" role="alert">{error} <button className="text-button" disabled={busy} onClick={()=>void(selected?choose(selected):load())}>Reload notes</button></p>}
   <p className="notes-notice" role="status">{busy?'Loading or saving…':notice}</p>
   <div className="notes-toolbar"><button className="soft-button" disabled={busy} onClick={start}>New note</button>{(selected||creating)&&<button className="text-button" disabled={busy} onClick={()=>{setSelected(null);setCreating(false);setEditing(false)}}>All notes</button>}</div>
   {!selected&&!creating&&page&&<>
    {!page.items.length&&<p className="empty-state">Keep shared context here. Create a note or a short checklist for this {thread?'thread':'conversation'}.</p>}
    <ol className="notes-list">{[...page.items].sort((a,b)=>Number(b.pinned)-Number(a.pinned)).map(note=><li key={note.id}><button className="notes-choice" disabled={busy} onClick={()=>void choose(note)}>{note.pinned&&<span className="notes-pin">Pinned · </span>}<strong>{note.title}</strong><span>{note.items.length?`${note.items.filter(i=>i.checked).length} of ${note.items.length} checked · `:''}Version {note.version} · {when(note.updated)}</span></button></li>)}</ol>
    {page.cursor&&<button className="soft-button" disabled={busy} onClick={()=>void load(String(page.cursor))}>Load more notes</button>}
   </>}
   {creating&&<NoteEditor key="new" initial={empty()} busy={busy} onCancel={()=>setCreating(false)} onSave={draft=>void mutate(base,'POST',{...draft,thread:thread??null},'Note created.')}/>}
   {selected&&editing&&<NoteEditor key={selected.id+':'+selected.version} initial={selected} busy={busy} onCancel={()=>setEditing(false)} onSave={draft=>void mutate(notePath,'PATCH',{...draft,version:selected.version},'New note version saved.')}/>}
   {selected&&!editing&&<>
    <article className="notes-detail"><h3>{selected.title||'Deleted note'}</h3><p className="notes-meta">Version {selected.version} · {when(selected.updated)}</p>
     {selected.pinned&&<p className="notes-pin">Pinned{selected.pinnedBy?' by '+(people.find(p=>p.id===selected.pinnedBy)?.name??'a former member'):''}{selected.pinnedAt?' · '+when(selected.pinnedAt):''}</p>}
     {selected.deleted?<p>Note content was deleted.</p>:<>
      <p className="notes-body">{selected.body}</p>
      {!!selected.items.length&&<p className="notes-meta">Checking an item records checklist progress. Requests require separate acceptance and completion reports.</p>}
      <ul className="notes-checklist">{selected.items.map(item=><li key={item.id}><label className="notes-check"><input type="checkbox" checked={item.checked} disabled={busy} onChange={()=>void mutate(notePath,'PATCH',{...payload(selected),version:selected.version,items:selected.items.map(old=>old.id===item.id?{...old,checked:!old.checked}:old)},'Checklist saved as a new version.')}/><span>{item.text}</span></label><ProposalAction item={item} people={people} busy={busy} already={!!proposals?.items.some(link=>link.item===item.id&&link.noteVersion===selected.version)} onPropose={propose}/></li>)}</ul>
      {!!selected.links.length&&<div className="notes-links"><h4>Linked documents</h4><p className="notes-meta">Links only; content and access stay with the provider.</p>{selected.links.map((link,index)=><p key={index}><a href={link.url} target="_blank" rel="noopener noreferrer">{link.label}</a> <span className="notes-meta">· Link, not synced</span></p>)}</div>}
      <div className="notes-toolbar"><button className="soft-button" disabled={busy} onClick={()=>setEditing(true)}>Edit note</button><button className="text-button" disabled={busy} onClick={()=>void mutate(notePath,'PATCH',{...payload(selected),version:selected.version,pinned:!selected.pinned},selected.pinned?'Note unpinned.':'Note pinned.')}>{selected.pinned?'Unpin':'Pin note'}</button></div>
     </>}
     {!!proposals?.items.length&&<div className="notes-links"><h4>Requests from this checklist</h4>{proposals.items.map(link=><p key={link.outcome}><a href={'/app?'+new URLSearchParams({view:'chat',conversation,panel:'outcomes',focus:link.outcome})}>Open request from version {link.noteVersion}</a></p>)}{proposals.cursor&&<button className="text-button" disabled={busy} onClick={()=>void moreProposals()}>More requests</button>}</div>}
     <button className="text-button" disabled={busy} onClick={()=>void loadHistory()}>Version history</button>
    </article>
    {history&&<section className="notes-history" aria-label="Note version history"><h4>Version history</h4><ol>{history.items.map(revision=><li key={revision.version}><p className="notes-meta">Version {revision.version} · {revision.actorName??'Former member'} · {when(revision.created)}{revision.reverted_from?` · Restored version ${revision.reverted_from}`:''}</p><details><summary>{revision.title||'Deleted content'}</summary><p className="notes-body">{revision.body}</p><ul>{revision.items.map(item=><li key={item.id}>{item.checked?'✓':'○'} {item.text}</li>)}</ul></details>{!selected.deleted&&!revision.deleted&&revision.version!==selected.version&&<button className="text-button" disabled={busy} onClick={()=>void mutate(notePath+'/revert','POST',{version:selected.version,restoreVersion:revision.version},'Earlier content restored as a new version.')}>Restore as new version</button>}</li>)}</ol>{history.cursor&&<button className="text-button" disabled={busy} onClick={()=>void loadHistory(Number(history.cursor))}>Earlier versions</button>}</section>}
   </>}
  </div>
 </section>
}
function ProposalAction({item,people,busy,already,onPropose}:{item:NoteItem;people:Props['people'];busy:boolean;already:boolean;onPropose:(item:NoteItem,assignee:string)=>Promise<void>}){
 const [assignee,setAssignee]=useState(''),id=useId()
 return already?<p className="notes-meta">Request proposed from this version.</p>:<div className="notes-propose"><label className="sr-only" htmlFor={id}>Assignee for {item.text}</label><select id={id} value={assignee} disabled={busy} onChange={e=>setAssignee(e.target.value)}><option value="">Choose assignee…</option>{people.map(person=><option key={person.id} value={person.id}>{person.name}</option>)}</select><button className="text-button" disabled={busy||!assignee} onClick={()=>void onPropose(item,assignee)}>Propose request</button></div>
}
function NoteEditor({initial,busy,onSave,onCancel}:{initial:NoteContent;busy:boolean;onSave:(draft:NoteContent)=>void;onCancel:()=>void}){
 const [draft,setDraft]=useState<NoteContent>(payload(initial)),id=useId()
 const item=(index:number,change:Partial<NoteItem>)=>setDraft(old=>({...old,items:old.items.map((item,i)=>i===index?{...item,...change}:item)}))
 const submit=(event:FormEvent)=>{event.preventDefault();onSave(draft)}
 return <form className="notes-editor" onSubmit={submit}><fieldset disabled={busy}>
  <label htmlFor={id+'title'}>Title</label><input id={id+'title'} required maxLength={200} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/>
  <label htmlFor={id+'body'}>Note</label><textarea id={id+'body'} maxLength={8000} rows={6} value={draft.body} onChange={e=>setDraft({...draft,body:e.target.value})}/>
  <h4>Checklist</h4><p className="notes-meta">A checked box records progress; it does not accept a request or report completion.</p>
  {draft.items.map((entry,index)=><div className="notes-edit-row" key={entry.id}><input type="checkbox" aria-label={'Checked: '+(entry.text||'item '+(index+1))} checked={entry.checked} onChange={e=>item(index,{checked:e.target.checked})}/><input required maxLength={500} aria-label={'Checklist item '+(index+1)} value={entry.text} onChange={e=>item(index,{text:e.target.value})}/><button type="button" className="text-button" aria-label={'Remove item '+(index+1)} onClick={()=>setDraft({...draft,items:draft.items.filter((_,i)=>i!==index)})}>Remove</button></div>)}
  <button type="button" className="text-button" disabled={draft.items.length>=50} onClick={()=>setDraft({...draft,items:[...draft.items,{id:crypto.randomUUID(),text:'',checked:false}]})}>Add checklist item</button>
  <h4>Document links</h4><p className="notes-meta">Link to Drive, OneDrive, Notion, Chest or a Vector plan. Documents keep their own permissions and are not synced.</p>
  {draft.links.map((link,index)=><div className="notes-edit-link" key={index}><input required maxLength={200} aria-label={'Document label '+(index+1)} placeholder="Document label" value={link.label} onChange={e=>setDraft({...draft,links:draft.links.map((old,i)=>i===index?{...old,label:e.target.value}:old)})}/><input required type="url" maxLength={2048} aria-label={'Document URL '+(index+1)} placeholder="https://…" value={link.url} onChange={e=>setDraft({...draft,links:draft.links.map((old,i)=>i===index?{...old,url:e.target.value}:old)})}/><button type="button" className="text-button" onClick={()=>setDraft({...draft,links:draft.links.filter((_,i)=>i!==index)})}>Remove link</button></div>)}
  <button type="button" className="text-button" disabled={draft.links.length>=10} onClick={()=>setDraft({...draft,links:[...draft.links,{label:'',url:''}]})}>Add document link</button>
  <label className="notes-check"><input type="checkbox" checked={draft.pinned} onChange={e=>setDraft({...draft,pinned:e.target.checked})}/>Pin in this conversation</label>
  <div className="notes-toolbar"><button className="send" type="submit">{busy?'Saving…':'Save note'}</button><button className="soft-button" type="button" onClick={onCancel}>Cancel</button></div>
 </fieldset></form>
}
