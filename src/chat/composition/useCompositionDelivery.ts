import {useRef,useState} from 'react'
import {ApiError,uploadAttachment} from '../api'
import {acknowledgePart,blankDraft,recordSendFailure,type Draft,type DraftScope} from '../drafts'
import {longMessagePlan,messageIntent,snippetFile} from './long-message'
import type {BroadcastPreview} from '../../broadcast/ConfirmBroadcast'
import {MESSAGE_LIMIT} from '../../family/team-chat/domain'

type Options={scope:DraftScope;active:()=>boolean;privateSignal:AbortSignal;getDraft:()=>Draft;save:(draft:Draft,durable?:boolean)=>boolean;replace:(draft:Draft)=>void;uploadBusy:()=>boolean;override:boolean;beginWrite:()=>()=>void;sendMessage:(input:unknown)=>Promise<void>;onSent:()=>Promise<void>;onError:(error:unknown)=>void;onCommand?:(body:string,onSaved:()=>void)=>Promise<boolean>;onReminder?:(body:string,onSaved:()=>void)=>void;focus:()=>void;onStorageError:(message:string)=>void}
export function useCompositionDelivery(o:Options){
 const sending=useRef(false),[busy,setBusy]=useState(false),[confirmation,setConfirmation]=useState<BroadcastPreview|null>(null)
 async function send(confirmed=false){
  if(!o.active()||sending.current||o.uploadBusy()||o.getDraft().upload)return
  sending.current=true;setBusy(true);let end:(()=>void)|undefined
  let current=o.getDraft(),pending=current.pending
  try{
   if(!pending&&!current.plan){
    const shrug=/^\/shrug(?:\s|$)/i.test(current.body)
    if(!shrug&&o.onCommand&&await o.onCommand(current.body,()=>o.save(blankDraft())))return
    if(!o.active())return
    if(!shrug&&/^\/remind\b/i.test(current.body)&&o.onReminder){o.onReminder(current.body,()=>o.save(blankDraft()));return}
    const shrugText=shrug?current.body.replace(/^\/shrug\s*/i,''):''
    pending=messageIntent(shrug?{...current,body:(shrugText?shrugText+' ':'')+'¯\\_(ツ)_/¯'}:current,o.scope.parent,o.override)
   }
   if(current.plan?.snippet&&!current.plan.snippet.file){
    end=o.beginWrite()
    const file=await uploadAttachment(o.scope.conversation,snippetFile(current),current.plan.snippet.intent)
    if(!o.active())return
    const plan={...current.plan,snippet:{...current.plan.snippet,file},parts:current.plan.parts.map((part,index)=>index===0?{...part,attachments:[...part.attachments,file.id]}:part)}
    current={...current,plan,pending:null}
    if(!o.save(current,true))return
   }
   pending=current.plan?current.plan.parts[current.plan.next]:pending
   if(!pending||!pending.body.trim()||pending.body.length>MESSAGE_LIMIT)return
   if(confirmed)pending={...pending,confirmBroadcast:true}
   setConfirmation(null)
   while(pending){
    if(!o.active())return
    current={...current,pending,plan:current.plan?{...current.plan,parts:current.plan.parts.map((part,index)=>index===current.plan!.next?pending!:part)}:null,delivery:'pending',failure:''}
    if(!o.save(current,true))return
    end??=o.beginWrite()
    await o.sendMessage(pending)
    let next:Draft|null|undefined
    try{next=acknowledgePart(o.scope,pending.intent)}catch{
     if(o.active())o.onStorageError('Message sent, but its acknowledgement could not be saved. Free browser storage, then retry the saved intent to reconcile it.')
     return
    }
    if(next===undefined||!o.active())return
    if(next===null){
     o.replace(blankDraft())
     try{await o.onSent();if(o.active())o.focus()}catch(error){if(o.active())o.onError(error)}
     return
    }
    current=next;o.replace(next);pending=next.pending
   }
  }catch(error){
   if(error instanceof ApiError&&error.broadcast&&o.active()){
    o.save({...current,pending:current.plan?pending:null,delivery:current.plan?'unconfirmed':'draft',failure:''});setConfirmation(error.broadcast);return
   }
   const refused=error instanceof ApiError&&[400,403,413,415,422].includes(error.status)
   const failure=error instanceof Error?error.message:'The message could not be sent.'
   if(!o.active()){if(!o.privateSignal.aborted&&pending)try{recordSendFailure(o.scope,pending.intent,failure,refused)}catch{};return}
   o.save({...current,pending:refused&&!current.plan?null:pending,delivery:refused?'failed':'unconfirmed',failure})
   o.onError(error)
  }finally{sending.current=false;end?.();if(o.active())setBusy(false)}
 }
 function startLong(kind:'split'|'snippet'){
  if(!o.active()||sending.current||o.getDraft().pending||o.getDraft().plan||o.uploadBusy()||o.getDraft().upload)return
  try{
   const current=o.getDraft()
   if(kind==='snippet'){
    if(current.files.length>=5)throw Error('Remove one attachment to leave room for the text snippet.')
    if(new TextEncoder().encode(current.body).length>25*1024*1024)throw Error('The text exceeds the 25 MiB attachment limit. Split it into messages instead.')
    if(current.body.includes('\0'))throw Error('Plain-text attachments cannot contain binary null characters. Remove them or split the text.')
   }
   const plan=longMessagePlan(current,o.scope.parent,o.override,kind)
   if(o.save({...current,plan,pending:null,delivery:'unconfirmed',failure:''},true))void send()
  }catch(error){o.onError(error)}
 }
 function cancelConfirmation(){setConfirmation(null);const current=o.getDraft();o.save({...current,pending:current.plan?current.pending:null,delivery:current.plan?'unconfirmed':'draft',failure:''});o.focus()}
 function editUnsent(){
  const current=o.getDraft(),plan=current.plan
  if(!plan||current.delivery!=='failed'||busy)return
  const files=plan.kind==='snippet'&&plan.snippet?.file?[...current.files,plan.snippet.file]:plan.next===0?current.files:[]
  o.save({...current,body:plan.kind==='split'?plan.parts.slice(plan.next).map(p=>p.body).join(''):current.body,files,plan:null,pending:null,delivery:'draft',failure:''});o.focus()
 }
 return {busy,confirmation,send,startLong,cancelConfirmation,editUnsent}
}
