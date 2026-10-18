import {useRef,useState} from 'react'
import {api} from './api'
import type {Draft} from './drafts'
import type {Message} from './types'

// Routing, attachments and retry intents are drafts too, even without text.
export const emptyForEditing=(draft:Draft)=>draft.body===''&&!draft.files.length&&!draft.recipient&&!draft.mentionIds?.length&&!draft.urgent&&!draft.reason&&!draft.pending&&!draft.upload&&!draft.plan&&draft.delivery==='draft'&&!draft.failure

export function useLastMessageEdit({user,conversation,parent,current,eligible,onEdit,onError}:{user:string;conversation:string;parent:string|null;current:()=>boolean;eligible:()=>boolean;onEdit?:((message:Message)=>void);onError:(error:unknown)=>void}){
 const inFlight=useRef(false),[busy,setBusy]=useState(false),[note,setNote]=useState('')
 async function edit(){
  if(!onEdit||inFlight.current||!current()||!eligible()||document.querySelector('dialog[open]'))return
  inFlight.current=true;setBusy(true);setNote('')
  try{
   const message=await api<Message|null>(`conversations/${encodeURIComponent(conversation)}/messages/latest-editable`+(parent?'?thread='+encodeURIComponent(parent):''))
   if(!current()||!eligible()||document.querySelector('dialog[open]'))return
   if(!message){setNote(parent?'No editable message of yours in this thread.':'No editable message of yours in this conversation.');return}
   if(message.author!==user||message.conversation!==conversation||message.parent!==parent||message.deleted||message.immutable)throw Error('The latest editable message no longer matches this composer. Try again.')
   onEdit(message)
  }catch(error){if(current())onError(error)}finally{inFlight.current=false;if(current())setBusy(false)}
 }
 return {edit,busy,note}
}
