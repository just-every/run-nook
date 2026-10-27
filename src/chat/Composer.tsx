import {ClipRecorder} from '../clips/ClipRecorder'
import {useTyping} from '../personal/useTyping'
import {useTeamBindings} from '../team/TeamBindings'
import {ConfirmBroadcast} from '../broadcast/ConfirmBroadcast'
import {useEffect,useId,useRef,useState} from 'react'
import {api} from './api'
import type {Message,Person} from './types'
import {useAttachmentUpload} from './useAttachmentUpload'
import {usePrivateScope} from './usePrivateScope'
import {IconAttach,IconClose,IconMention} from './icons'
import {blankDraft,draftKey,readDraft,writeDraft,type Draft} from './drafts'
import {MESSAGE_LIMIT} from '../family/team-chat/domain'
import {CompositionTools,formatSelection,type FormatAction} from './composition/CompositionTools'
import {SafeMarkdown} from './composition/SafeMarkdown'
import {useFormatting} from './composition/useFormatting'
import {useCompositionDelivery} from './composition/useCompositionDelivery'
import {BuiltinSuggestions} from '../commands/BuiltinSuggestions'
import {messageIntent} from './composition/long-message'
import {emptyForEditing,useLastMessageEdit} from './useLastMessageEdit'
export function Composer({restricted=false,user,conversation,name,parent,members,privateSignal,viewCurrent,beginWrite,sendMessage,onSent,onError,onSchedule,onEditLast}:{onEditLast?:(message:Message)=>void;onSchedule?:(draft:{body:string;parent:string|null;mentions:string[];urgent:boolean;urgentReason:string|null;files:Draft['files']},saved:()=>void)=>void;restricted?:boolean;user:Person;conversation:string;name:string;parent:string|null;members:Person[];privateSignal:AbortSignal;viewCurrent:()=>boolean;beginWrite:()=>()=>void;sendMessage:(input:unknown)=>Promise<void>;onSent:()=>Promise<void>;onError:(e:unknown)=>void}) {
 const team=useTeamBindings()
 const [clipOpen,setClipOpen]=useState(false),[clipBusy,setClipBusy]=useState(false)
 const typing=useTyping({conversation,user:user.id,signal:privateSignal,enabled:user.typingEnabled!==false})
 const [override,setOverride]=useState(false)
 const fieldId=useId()
 const scope={user:user.id,conversation,parent},key=draftKey(scope)
 const isCurrent=usePrivateScope(privateSignal,key)
 const [draft,setDraft]=useState<Draft>(blankDraft),[storageError,setStorageError]=useState('')
 const textarea=useRef<HTMLTextAreaElement>(null),draftRef=useRef(draft),alive=useRef(true);draftRef.current=draft
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
 const formatting=useFormatting(user.id)
 const delivery=useCompositionDelivery({scope,active,privateSignal,getDraft:()=>draftRef.current,save,replace:next=>{draftRef.current=next;setDraft(next)},uploadBusy:()=>upload.isBusy()||clipBusy,override,beginWrite,sendMessage,onSent,onError,onCommand:team.onCommand,onReminder:team.onReminderCommand,focus:()=>textarea.current?.focus(),onStorageError:setStorageError})
 const {busy,confirmation,send}=delivery
 const focusSelection=(start:number,end=start)=>queueMicrotask(()=>{if(active()){textarea.current?.focus();textarea.current?.setSelectionRange(start,end)}})
 function changeBody(body:string,caret:number,composing=false){typing.onInput();const converted=composing?body:formatting.change(body,draftRef.current.body,caret);save({...draftRef.current,body:converted,delivery:'draft',failure:''});if(converted!==body)focusSelection(caret+converted.length-body.length)}
 function undoFormatting(){const restored=formatting.restore(draftRef.current.body);if(restored!==null){save({...draftRef.current,body:restored});focusSelection(restored.length)}}
 function insert(text:string,person?:Person){
  const current=draftRef.current,start=textarea.current?.selectionStart??current.body.length,end=textarea.current?.selectionEnd??start
  save({...current,body:current.body.slice(0,start)+text+current.body.slice(end),...(person?{mentionIds:[...new Set([...(current.mentionIds??[]),person.id])]}:{})});focusSelection(start+text.length)
 }
 function format(action:FormatAction){const field=textarea.current;if(!field)return;const next=formatSelection(draftRef.current.body,field.selectionStart,field.selectionEnd,action);formatting.showFormatted();save({...draftRef.current,body:next.body});focusSelection(next.start,next.end)}
 function downloadText(){const url=URL.createObjectURL(new Blob([draftRef.current.body],{type:'text/plain;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download='message.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
 async function remove(id:string){if(!active())return;try{await api(`attachments/${id}`,{delete:true},'PATCH');save({...draftRef.current,files:draftRef.current.files.filter(a=>a.id!==id)})}catch(e){if(active())onError(e)}}
 const captureLocked=busy||Boolean(draft.pending)||Boolean(draft.plan),locked=captureLocked||clipBusy
 const canEditLast=()=>!locked&&!storageError&&!upload.isBusy()&&emptyForEditing(draftRef.current)
 const lastEdit=useLastMessageEdit({user:user.id,conversation,parent,current:active,eligible:canEditLast,onEdit:onEditLast,onError})
 const routingId=fieldId+'-routing',hintId=fieldId+'-hint'
 const [routingOpen,setRoutingOpen]=useState(false),options=useRef<HTMLDetailsElement>(null)
 // A draft that already carries a recipient or urgency (reload, saved draft) opens its menu so the choice stays visible.
 useEffect(()=>{if((draft.urgent||draft.recipient)&&options.current&&!options.current.open)options.current.open=true},[draft.urgent,draft.recipient])
 const showRouting=routingOpen||draft.urgent||Boolean(draft.recipient)
 const note=upload.uploading?'Uploading…':draft.upload?'Finish the file upload to send':''
 const hasFormatting=/[*_~`\[\]]|(?:^|\n)(?:>|- |\d+\. )/.test(draft.body)
 const overlength=draft.body.length>MESSAGE_LIMIT,countId=fieldId+'-count',retry=Boolean(draft.pending||draft.plan)&&!busy&&!confirmation
 if(restricted&&!override&&!draft.pending?.adminOverride&&!draft.plan?.parts[0]?.adminOverride)return <div className="archived-notice" role="status">Posting is restricted by this channel’s permissions. You can still read, react, save and follow.{(user.role==='owner'||user.role==='admin')&&<button className="text-button" onClick={()=>setOverride(true)}>Post with admin override</button>}</div>
 return <form className="composer" data-urgent={draft.urgent||undefined} onSubmit={e=>{e.preventDefault();if(!clipBusy)void send()}}>
  {confirmation&&<ConfirmBroadcast preview={confirmation} onConfirm={()=>void send(true)} onCancel={delivery.cancelConfirmation}/>}
  {(override||draft.pending?.adminOverride||draft.plan?.parts[0]?.adminOverride)&&<p className="draft-note">This post will be labelled and audited as an admin override. <button type="button" className="text-button" onClick={()=>setOverride(false)}>Cancel override</button></p>}
  <label className="sr-only" htmlFor={'compose-'+(parent||'root')}>{parent?'Reply in thread':'Message '+name}</label>
  <textarea ref={textarea} id={'compose-'+(parent||'root')} rows={1} value={draft.body} readOnly={locked} required placeholder={parent?'Reply in thread…':`Message ${name}…`} aria-invalid={overlength&&!draft.plan||undefined} aria-describedby={hintId+(draft.body.length>=36000?' '+countId:'')} onChange={e=>changeBody(e.target.value,e.target.selectionStart,(e.nativeEvent as InputEvent).isComposing)} onKeyDown={e=>{if(e.nativeEvent.isComposing||e.keyCode===229)return;if(e.key==='ArrowUp'&&!e.altKey&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&onEditLast&&canEditLast()){e.preventDefault();void lastEdit.edit();return}if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&e.key.toLowerCase()==='z'&&formatting.canUndo&&!locked){e.preventDefault();undoFormatting();return}if((e.ctrlKey||e.metaKey)&&['b','i'].includes(e.key.toLowerCase())&&!locked){e.preventDefault();format(e.key.toLowerCase()==='b'?'bold':'italic');return}if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();if(draft.body.trim())if(!clipBusy)void send()}}}/>
  <CompositionTools disabled={locked} enabled={formatting.enabled} onToggle={formatting.toggle} onFormat={format} onInsert={insert} members={members} channels={team.channels??[]} onMention={person=>insert('@'+person.name+' ',person)} onDownload={downloadText} canUndo={formatting.canUndo} onUndo={undoFormatting}/>
  {draft.body&&hasFormatting&&draft.body.length<=MESSAGE_LIMIT&&<details className="composition-preview" open><summary>Formatted preview</summary><SafeMarkdown text={draft.pending?.body??draft.body} literal={formatting.literal||!formatting.enabled}/></details>}
  {!locked&&<BuiltinSuggestions body={draft.body} onChoose={body=>{save({...draftRef.current,body});textarea.current?.focus()}}/>}
  <label className={'attach-button icon-button'+(locked?' disabled':'')} data-tooltip="Attach file" aria-label="Attach file"><IconAttach/><span className="sr-only">Attach file</span><input aria-label="Attach file" type="file" disabled={locked||upload.uploading} onChange={e=>{const file=e.target.files?.[0];if(file)void upload.select(file);e.target.value=''}}/></label>
  <button type="button" className="text-button clip-door" disabled={captureLocked||upload.uploading||draft.files.length>=5} onClick={()=>setClipOpen(!clipOpen)}>Record or upload clip</button>
  {clipOpen&&<ClipRecorder conversation={conversation} privateSignal={privateSignal} disabled={captureLocked||upload.uploading||draft.files.length>=5} onBusyChange={setClipBusy} onClose={()=>setClipOpen(false)} onUploaded={file=>save({...draftRef.current,body:draftRef.current.body||'Clip: '+file.name,files:[...draftRef.current.files,file]})}/>}
  <details className="composer-options menu" ref={options} onToggle={e=>setRoutingOpen(e.currentTarget.open)}><summary className="icon-button" data-tooltip="Mention or urgency" aria-label="Mention or urgency" aria-controls={showRouting?routingId:undefined}><IconMention/><span className="sr-only">Mention or urgency</span></summary></details>
  {showRouting&&<div className="composer-routing" id={routingId}><div className="field"><label htmlFor={fieldId+'-recipient'}>Notify a person</label><select id={fieldId+'-recipient'} disabled={locked} value={draft.recipient} onChange={e=>save({...draftRef.current,recipient:e.target.value})}><option value="">Choose a person</option>{members.filter(p=>p.id!==user.id).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}{draft.recipient&&!members.some(p=>p.id===draft.recipient)&&<option value={draft.recipient}>Person no longer available</option>}</select></div><div className="field"><label htmlFor={fieldId+'-priority'}>Priority</label><select id={fieldId+'-priority'} disabled={locked} value={draft.urgent?'urgent':'normal'} onChange={e=>save({...draftRef.current,urgent:e.target.value==='urgent'})}><option value="normal">Routine</option><option value="urgent">Urgent</option></select></div>{draft.urgent&&<label className="field">Why is this urgent?<input required maxLength={240} disabled={locked} value={draft.reason} onChange={e=>save({...draftRef.current,reason:e.target.value})}/></label>}</div>}
  {/@(?:channel|here|everyone)\b|<!(?:channel|here|everyone)>/.test(draft.body)&&<p className="draft-note">Channel-wide mentions follow each recipient’s notification choices and quiet time.</p>}
  {!!draft.mentionIds?.length&&<div className="composition-mentions" role="group" aria-label="People to notify">{draft.mentionIds.map(id=><span key={id}>@{members.find(person=>person.id===id)?.name??'Person no longer available'}<button type="button" className="text-button" disabled={locked} aria-label={'Stop notifying '+(members.find(person=>person.id===id)?.name??'this person')} onClick={()=>save({...draftRef.current,mentionIds:draftRef.current.mentionIds?.filter(value=>value!==id)})}>Remove</button></span>)}</div>}
  {!!draft.files.length&&<div className="staged-files">{draft.files.map(f=><span key={f.id} role="group" aria-label={f.name}>{f.name}<button type="button" className="icon-button" disabled={locked} data-tooltip="Discard file" aria-label="Discard file" onClick={()=>void remove(f.id)}><IconClose/><span className="sr-only">Remove</span></button></span>)}</div>}
  {parent&&<label className="import-check"><input type="checkbox" checked={!!draft.channelBroadcast} disabled={locked} onChange={event=>save({...draftRef.current,channelBroadcast:event.target.checked})}/>Also send to #{name}</label>}
  {onSchedule&&<button type="button" className="schedule-draft text-button" disabled={locked||upload.uploading||Boolean(draft.upload)||!draft.body.trim()||overlength||override||draft.channelBroadcast} onClick={()=>onSchedule({body:draft.body,parent,mentions:messageIntent(draft,parent,override).mentions,urgent:draft.urgent,urgentReason:draft.urgent?draft.reason:null,files:draft.files},()=>save(blankDraft()))}>Schedule for later</button>}
  <button className="send" disabled={clipBusy||busy||upload.uploading||Boolean(draft.upload)||!draft.body.trim()||(overlength&&!draft.plan)}>{busy?'Sending…':retry||draft.delivery==='failed'?'Retry send':'Send'}</button>
  <span id={hintId} className="sr-only">Enter to send, Shift+Enter for a new line. Up arrow in an empty composer edits your last message.</span>
  {(onEditLast||typing.label||note||draft.upload||retry||busy||draft.delivery==='failed'||formatting.error||storageError||draft.body.length>=36000)&&<div className="composer-notes">
   {onEditLast&&<button type="button" className="text-button" disabled={lastEdit.busy||!canEditLast()} aria-keyshortcuts="ArrowUp" onClick={()=>void lastEdit.edit()}>{lastEdit.busy?'Finding last message…':'Edit last message'}</button>}
   {lastEdit.note&&<p className="draft-note" role="status">{lastEdit.note}</p>}
   {typing.label&&<p className="draft-note" role="status">{typing.label}</p>}
   {draft.body.length>=36000&&<p id={countId} role={overlength&&!draft.plan?'alert':undefined} className={overlength&&!draft.plan?'warning':'draft-note'}>{draft.plan?`${draft.body.length.toLocaleString()} characters kept in this ${draft.plan.kind==='snippet'?'text snippet':'split message'}.`:overlength?`Message is ${draft.body.length-MESSAGE_LIMIT} characters over the 40,000-character limit and cannot be sent. All text is kept. Choose a snippet or split below.`:`${MESSAGE_LIMIT-draft.body.length} characters remaining`}</p>}
   {overlength&&!draft.plan&&<div className="long-message-actions"><button type="button" className="text-button" disabled={locked||upload.uploading||Boolean(draft.upload)} onClick={()=>delivery.startLong('snippet')}>Post as snippet</button><button type="button" className="text-button" disabled={locked||upload.uploading||Boolean(draft.upload)} onClick={()=>delivery.startLong('split')}>Split into messages</button></div>}
   {draft.plan&&<p className="draft-note" role="status">{draft.plan.kind==='split'?`${draft.plan.next} of ${draft.plan.parts.length} parts confirmed. Retry continues with the exact unsent part.`:'Text snippet prepared. Retry resumes its saved upload and message.'}</p>}
   {draft.plan&&draft.delivery==='failed'&&<button type="button" className="text-button" disabled={busy} onClick={delivery.editUnsent}>Edit unsent text</button>}
   {formatting.error&&<p className="warning" role="alert">{formatting.error}</p>}
   {storageError&&<p role="alert" className="warning">{storageError}</p>}
   {note&&<span className="composer-hint">{note}</span>}
   {draft.upload&&!upload.uploading&&<p className="draft-note">Upload is unconfirmed for {draft.upload.name}. {!upload.ready&&'Reselect the same file to retry. '}<button type="button" className="text-button" disabled={locked||!upload.ready} onClick={()=>void upload.retry()}>Retry upload</button>{' '}<button type="button" className="text-button" disabled={locked} onClick={upload.discard}>Discard upload</button></p>}
   {retry&&<p className="draft-note">Delivery is unconfirmed. Retry sends the same saved message.</p>}
   {busy&&<p className="draft-note" role="status">Sending the saved message…</p>}
   {draft.delivery==='failed'&&<p className="draft-note" role="alert">{draft.plan?'The current part was not sent':'Message was not sent'}: {draft.failure} You can edit the unsent text and try again.</p>}
  </div>}
 </form>
}
