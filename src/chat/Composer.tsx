import {useEffect,useId,useRef,useState} from 'react'
import {api,ApiError} from './api'
import type {Person} from './types'
import {useAttachmentUpload} from './useAttachmentUpload'
import {usePrivateScope} from './usePrivateScope'
import {IconAttach,IconClose,IconMention} from './icons'
import {blankDraft,clearSentDraft,draftKey,readDraft,recordSendFailure,writeDraft,type Draft} from './drafts'
import {MESSAGE_LIMIT} from '../family/team-chat/domain'
export function Composer({restricted=false,user,conversation,name,parent,members,privateSignal,viewCurrent,beginWrite,sendMessage,onSent,onError}:{restricted?:boolean;user:Person;conversation:string;name:string;parent:string|null;members:Person[];privateSignal:AbortSignal;viewCurrent:()=>boolean;beginWrite:()=>()=>void;sendMessage:(input:unknown)=>Promise<void>;onSent:()=>Promise<void>;onError:(e:unknown)=>void}) {
 const [override,setOverride]=useState(false)
 const fieldId=useId()
 const scope={user:user.id,conversation,parent},key=draftKey(scope)
 const isCurrent=usePrivateScope(privateSignal,key)
 const [draft,setDraft]=useState<Draft>(blankDraft),[busy,setBusy]=useState(false),[storageError,setStorageError]=useState('')
 const textarea=useRef<HTMLTextAreaElement>(null),draftRef=useRef(draft),alive=useRef(true),sending=useRef(false);draftRef.current=draft
 useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[])
 const active=()=>alive.current&&isCurrent()&&viewCurrent()
 useEffect(()=>{if(isCurrent()&&viewCurrent())try{const restored=readDraft(scope);draftRef.current=restored;setDraft(restored);setStorageError('')}catch(error){setStorageError(error instanceof Error?error.message:'Saved draft could not be read.')}},[key,isCurrent,viewCurrent])
 const save=(next:Draft,requireDurable=false)=>{
  if(!active())return false
  let saved=true
  try{writeDraft(scope,next);setStorageError('')}catch{saved=false;setStorageError('Draft could not be saved in this browser. Keep this page open and free browser storage before sending.')}
  if(saved||!requireDurable){draftRef.current=next;setDraft(next)}
  return saved
 }
 const upload=useAttachmentUpload({conversation,isCurrent:active,getPending:()=>draftRef.current.upload,getCount:()=>draftRef.current.files.length,onPending:pending=>{if(!save({...draftRef.current,upload:pending},Boolean(pending))&&pending)throw Error('Upload was not started because its retry intent could not be saved in this browser.')},onUploaded:file=>save({...draftRef.current,upload:null,files:[...draftRef.current.files,file]}),onError})
 async function send(){
  if(!active()||sending.current||upload.isBusy()||draftRef.current.upload)return
  const current=draftRef.current,pending=current.pending||{body:current.body,intent:crypto.randomUUID(),parent,attachments:current.files.map(f=>f.id),mentions:current.recipient?[current.recipient]:[],urgent:current.urgent,urgentReason:current.urgent?current.reason:null,...(override?{adminOverride:true as const}:{})}
  if(!pending.body.trim()||pending.body.length>MESSAGE_LIMIT)return
  if(!save({...current,pending,delivery:'pending',failure:''},true))return
  sending.current=true;setBusy(true);const end=beginWrite()
  try{
   await sendMessage(pending)
   // Clear this exact acknowledged intent even if the user navigated away.
   try{clearSentDraft(scope,pending.intent)}catch{if(active())setStorageError('Message sent, but its saved draft could not be cleared from this browser.')}
   if(!active())return
   draftRef.current=blankDraft();setDraft(draftRef.current)
   try{await onSent();if(active())textarea.current?.focus()}catch(error){if(active())onError(error)}
  }catch(error){
   const refused=error instanceof ApiError&&[400,403,413,415,422].includes(error.status)
   const failure=error instanceof Error?error.message:'The message could not be sent.'
   if(!active()){if(!privateSignal.aborted)try{recordSendFailure(scope,pending.intent,failure,refused)}catch{};return}
   save({...draftRef.current,pending:refused?null:pending,delivery:refused?'failed':'unconfirmed',failure})
   onError(error)
  }finally{sending.current=false;end();if(active())setBusy(false)}
 }
 async function remove(id:string){if(!active())return;try{await api(`attachments/${id}`,{delete:true},'PATCH');save({...draftRef.current,files:draftRef.current.files.filter(a=>a.id!==id)})}catch(e){if(active())onError(e)}}
 const locked=busy||Boolean(draft.pending)
 const routingId=fieldId+'-routing',hintId=fieldId+'-hint'
 const [routingOpen,setRoutingOpen]=useState(false),options=useRef<HTMLDetailsElement>(null)
 // A draft that already carries a recipient or urgency (reload, saved draft) opens its menu so the choice stays visible.
 useEffect(()=>{if((draft.urgent||draft.recipient)&&options.current&&!options.current.open)options.current.open=true},[draft.urgent,draft.recipient])
 const showRouting=routingOpen||draft.urgent||Boolean(draft.recipient)
 const note=upload.uploading?'Uploading…':draft.upload?'Finish the file upload to send':''
 const overlength=draft.body.length>MESSAGE_LIMIT,countId=fieldId+'-count',retry=Boolean(draft.pending)&&!busy
 if(restricted&&!override&&!draft.pending?.adminOverride)return <div className="archived-notice" role="status">Posting is restricted by this channel’s permissions. You can still read, react, save and follow.{(user.role==='owner'||user.role==='admin')&&<button className="text-button" onClick={()=>setOverride(true)}>Post with admin override</button>}</div>
 return <form className="composer" data-urgent={draft.urgent||undefined} onSubmit={e=>{e.preventDefault();void send()}}>
  {(override||draft.pending?.adminOverride)&&<p className="draft-note">This post will be labelled and audited as an admin override. <button type="button" className="text-button" onClick={()=>setOverride(false)}>Cancel override</button></p>}
  <label className="sr-only" htmlFor={'compose-'+(parent||'root')}>{parent?'Reply in thread':'Message '+name}</label>
  <textarea ref={textarea} id={'compose-'+(parent||'root')} rows={1} value={draft.body} readOnly={locked} required placeholder={parent?'Reply in thread…':`Message ${name}…`} aria-invalid={overlength||undefined} aria-describedby={hintId+(draft.body.length>=36000?' '+countId:'')} onChange={e=>save({...draftRef.current,body:e.target.value,delivery:'draft',failure:''})} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();if(draft.body.trim())void send()}}}/>
  <label className={'attach-button icon-button'+(locked?' disabled':'')} title="Attach file"><IconAttach/><span className="sr-only">Attach file</span><input aria-label="Attach file" type="file" accept=".txt,.png,.jpg,.jpeg,.pdf" disabled={locked||upload.uploading} onChange={e=>{const file=e.target.files?.[0];if(file)void upload.select(file);e.target.value=''}}/></label>
  <details className="composer-options menu" ref={options} onToggle={e=>setRoutingOpen(e.currentTarget.open)}><summary className="icon-button" title="Mention or urgency" aria-controls={showRouting?routingId:undefined}><IconMention/><span className="sr-only">Mention or urgency</span></summary></details>
  {showRouting&&<div className="composer-routing" id={routingId}><div className="field"><label htmlFor={fieldId+'-recipient'}>Notify a person</label><select id={fieldId+'-recipient'} disabled={locked} value={draft.recipient} onChange={e=>save({...draftRef.current,recipient:e.target.value})}><option value="">Choose a person</option>{members.filter(p=>p.id!==user.id).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}{draft.recipient&&!members.some(p=>p.id===draft.recipient)&&<option value={draft.recipient}>Person no longer available</option>}</select></div><div className="field"><label htmlFor={fieldId+'-priority'}>Priority</label><select id={fieldId+'-priority'} disabled={locked} value={draft.urgent?'urgent':'normal'} onChange={e=>save({...draftRef.current,urgent:e.target.value==='urgent'})}><option value="normal">Routine</option><option value="urgent">Urgent</option></select></div>{draft.urgent&&<label className="field">Why is this urgent?<input required maxLength={240} disabled={locked} value={draft.reason} onChange={e=>save({...draftRef.current,reason:e.target.value})}/></label>}</div>}
  {!!draft.files.length&&<div className="staged-files">{draft.files.map(f=><span key={f.id}>{f.name}<button type="button" className="icon-button" disabled={locked} aria-label={'Discard '+f.name} onClick={()=>void remove(f.id)}><IconClose/><span className="sr-only">Remove</span></button></span>)}</div>}
  <button className="send" disabled={busy||upload.uploading||Boolean(draft.upload)||!draft.body.trim()||overlength}>{busy?'Sending…':retry||draft.delivery==='failed'?'Retry send':'Send'}</button>
  <span id={hintId} className="sr-only">Enter to send, Shift+Enter for a new line</span>
  {(note||draft.upload||retry||busy||draft.delivery==='failed'||storageError||draft.body.length>=36000)&&<div className="composer-notes">
   {draft.body.length>=36000&&<p id={countId} role={overlength?'alert':undefined} className={overlength?'warning':'draft-note'}>{overlength?`Message is ${draft.body.length-MESSAGE_LIMIT} characters over the 40,000-character limit and cannot be sent. All text is kept. Shorten it or attach it as a text file.`:`${MESSAGE_LIMIT-draft.body.length} characters remaining`}</p>}
   {storageError&&<p role="alert" className="warning">{storageError}</p>}
   {note&&<span className="composer-hint">{note}</span>}
   {draft.upload&&!upload.uploading&&<p className="draft-note">Upload is unconfirmed for {draft.upload.name}. {!upload.ready&&'Reselect the same file to retry. '}<button type="button" className="text-button" disabled={locked||!upload.ready} onClick={()=>void upload.retry()}>Retry upload</button>{' '}<button type="button" className="text-button" disabled={locked} onClick={upload.discard}>Discard upload</button></p>}
   {retry&&<p className="draft-note">Delivery is unconfirmed. Retry sends the same saved message.</p>}
   {busy&&<p className="draft-note" role="status">Sending the saved message…</p>}
   {draft.delivery==='failed'&&<p className="draft-note" role="alert">Message was not sent: {draft.failure} You can edit it and try again.</p>}
  </div>}
 </form>
}
