import {useEffect,useId,useRef,useState} from 'react'
import {api,ApiError} from './api'
import type {FileRecord,Person} from './types'
import {useAttachmentUpload,type PendingUpload} from './useAttachmentUpload'
import {usePrivateScope} from './usePrivateScope'
import {IconAttach,IconClose,IconMention} from './icons'
type Intent={body:string;intent:string;parent:string|null;attachments:string[];mentions:string[];urgent:boolean;urgentReason:string|null}
type Draft={body:string;files:FileRecord[];recipient:string;urgent:boolean;reason:string;pending:Intent|null;upload:PendingUpload|null}
const blank=():Draft=>({body:'',files:[],recipient:'',urgent:false,reason:'',pending:null,upload:null})
function read(key:string):Draft{try{return {...blank(),...JSON.parse(sessionStorage.getItem(key)||'{}')}}catch{return blank()}}
export function Composer({user,conversation,name,parent,members,privateSignal,viewCurrent,beginWrite,sendMessage,onSent,onError}:{user:Person;conversation:string;name:string;parent:string|null;members:Person[];privateSignal:AbortSignal;viewCurrent:()=>boolean;beginWrite:()=>()=>void;sendMessage:(input:unknown)=>Promise<void>;onSent:()=>Promise<void>;onError:(e:unknown)=>void}) {
 const fieldId=useId()
 const key=`nook:draft:${user.id}:${conversation}:${parent||'root'}`
 const isCurrent=usePrivateScope(privateSignal,key)
 const [draft,setDraft]=useState<Draft>(()=>isCurrent()&&viewCurrent()?read(key):blank()),[busy,setBusy]=useState(false),[retry,setRetry]=useState(Boolean(draft.pending))
 const textarea=useRef<HTMLTextAreaElement>(null),draftRef=useRef(draft),alive=useRef(true);draftRef.current=draft
 useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[])
 const active=()=>alive.current&&isCurrent()&&viewCurrent()
 useEffect(()=>{if(isCurrent()&&viewCurrent())setDraft(read(key))},[key,isCurrent,viewCurrent])
 const save=(next:Draft)=>{if(!active())return;draftRef.current=next;sessionStorage.setItem(key,JSON.stringify(next));setDraft(next)}
 const upload=useAttachmentUpload({conversation,isCurrent:active,getPending:()=>draftRef.current.upload,getCount:()=>draftRef.current.files.length,onPending:pending=>save({...draftRef.current,upload:pending}),onUploaded:file=>save({...draftRef.current,upload:null,files:[...draftRef.current.files,file]}),onError})
 async function send(){
  if(!active()||busy||upload.isBusy()||draftRef.current.upload)return
  setBusy(true);const end=beginWrite()
  try{
   const current=draftRef.current,pending=current.pending||{body:current.body,intent:crypto.randomUUID(),parent,attachments:current.files.map(f=>f.id),mentions:current.recipient?[current.recipient]:[],urgent:current.urgent,urgentReason:current.urgent?current.reason:null}
   save({...current,pending});await sendMessage(pending)
   if(!active())return
   save(blank());sessionStorage.removeItem(key);setRetry(false);await onSent();if(active())textarea.current?.focus()
  }catch(e){if(!active())return;if(e instanceof ApiError&&[400,403,413,415,422].includes(e.status)){save({...draftRef.current,pending:null});setRetry(false)}else setRetry(true);onError(e)}finally{end();if(active())setBusy(false)}
 }
 async function remove(id:string){if(!active())return;try{await api(`attachments/${id}`,{delete:true},'PATCH');save({...draftRef.current,files:draftRef.current.files.filter(a=>a.id!==id)})}catch(e){if(active())onError(e)}}
 const locked=busy||Boolean(draft.pending)
 const routingId=fieldId+'-routing',hintId=fieldId+'-hint'
 const [routingOpen,setRoutingOpen]=useState(false),options=useRef<HTMLDetailsElement>(null)
 // A draft that already carries a recipient or urgency (reload, saved draft) opens its menu so the choice stays visible.
 useEffect(()=>{if((draft.urgent||draft.recipient)&&options.current&&!options.current.open)options.current.open=true},[draft.urgent,draft.recipient])
 const showRouting=routingOpen||draft.urgent||Boolean(draft.recipient)
 const note=upload.uploading?'Uploading…':draft.upload?'Finish the file upload to send':''
 return <form className="composer" data-urgent={draft.urgent||undefined} onSubmit={e=>{e.preventDefault();void send()}}>
  <label className="sr-only" htmlFor={'compose-'+(parent||'root')}>{parent?'Reply in thread':'Message '+name}</label>
  <textarea ref={textarea} id={'compose-'+(parent||'root')} rows={1} value={draft.body} readOnly={locked} required maxLength={8000} placeholder={parent?'Reply in thread…':`Message ${name}…`} aria-describedby={hintId} onChange={e=>save({...draftRef.current,body:e.target.value})} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();if(draft.body.trim())void send()}}}/>
  <label className={'attach-button icon-button'+(locked?' disabled':'')} title="Attach file"><IconAttach/><span className="sr-only">Attach file</span><input aria-label="Attach file" type="file" accept=".txt,.png,.jpg,.jpeg,.pdf" disabled={locked||upload.uploading} onChange={e=>{const file=e.target.files?.[0];if(file)void upload.select(file);e.target.value=''}}/></label>
  <details className="composer-options menu" ref={options} onToggle={e=>setRoutingOpen(e.currentTarget.open)}><summary className="icon-button" title="Mention or urgency" aria-controls={showRouting?routingId:undefined}><IconMention/><span className="sr-only">Mention or urgency</span></summary></details>
  {showRouting&&<div className="composer-routing" id={routingId}><div className="field"><label htmlFor={fieldId+'-recipient'}>Notify a person</label><select id={fieldId+'-recipient'} disabled={locked} value={draft.recipient} onChange={e=>save({...draftRef.current,recipient:e.target.value})}><option value="">Choose a person</option>{members.filter(p=>p.id!==user.id).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}{draft.recipient&&!members.some(p=>p.id===draft.recipient)&&<option value={draft.recipient}>Person no longer available</option>}</select></div><div className="field"><label htmlFor={fieldId+'-priority'}>Priority</label><select id={fieldId+'-priority'} disabled={locked} value={draft.urgent?'urgent':'normal'} onChange={e=>save({...draftRef.current,urgent:e.target.value==='urgent'})}><option value="normal">Routine</option><option value="urgent">Urgent</option></select></div>{draft.urgent&&<label className="field">Why is this urgent?<input required maxLength={240} disabled={locked} value={draft.reason} onChange={e=>save({...draftRef.current,reason:e.target.value})}/></label>}</div>}
  {!!draft.files.length&&<div className="staged-files">{draft.files.map(f=><span key={f.id}>{f.name}<button type="button" className="icon-button" disabled={locked} aria-label={'Discard '+f.name} onClick={()=>void remove(f.id)}><IconClose/><span className="sr-only">Remove</span></button></span>)}</div>}
  <button className="send" disabled={busy||upload.uploading||Boolean(draft.upload)||!draft.body.trim()}>{busy?'Sending…':retry?'Retry send':'Send'}</button>
  <span id={hintId} className="sr-only">Enter to send, Shift+Enter for a new line</span>
  {(note||(draft.upload&&!upload.uploading)||retry)&&<div className="composer-notes">
   {note&&<span className="composer-hint">{note}</span>}
   {draft.upload&&!upload.uploading&&<p className="draft-note">Upload is unconfirmed for {draft.upload.name}. {!upload.ready&&'Reselect the same file to retry. '}<button type="button" className="text-button" disabled={locked||!upload.ready} onClick={()=>void upload.retry()}>Retry upload</button>{' '}<button type="button" className="text-button" disabled={locked} onClick={upload.discard}>Discard upload</button></p>}
   {retry&&<p className="draft-note">Delivery is unconfirmed. Retry sends the same saved message.</p>}
  </div>}
 </form>
}
