import {fileChecksum} from '../files/resumable-client';
import {useEffect,useRef,useState} from 'react'
import {ApiError,attachmentMime,uploadAttachment} from './api'
import type {FileRecord} from './types'

type FileIdentity={name:string;mime:string;size:number;sha256:string}
export type PendingUpload=FileIdentity & {intent:string}
type Options={conversation:string;isCurrent:()=>boolean;getPending:()=>PendingUpload|null;getCount:()=>number;onPending:(pending:PendingUpload|null)=>void;onUploaded:(file:FileRecord)=>void;onError:(error:unknown)=>void}
async function identity(file:File):Promise<FileIdentity>{
 const mime=attachmentMime(file)
 if(file.size<1||file.size>1024*1024*1024)throw new ApiError(413,'Choose a file between 1 byte and 1 GiB.')
 return {name:file.name,mime,size:file.size,sha256:await fileChecksum(file)}
}
const matches=(file:FileIdentity,pending:PendingUpload)=>file.name===pending.name&&file.mime===pending.mime&&file.size===pending.size&&file.sha256===pending.sha256

// Only the identity and intent live in the draft. A File is immutable and stays
// in memory; after reload the user must reselect and verify its actual bytes.
export function useAttachmentUpload(options:Options){
 const file=useRef<File|null>(null),working=useRef(false),alive=useRef(true)
 const [uploading,setUploading]=useState(false),[ready,setReady]=useState(false)
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;file.current=null}},[])
 const active=()=>alive.current&&options.isCurrent()
 function start(){if(!active()||working.current)return false;working.current=true;setUploading(true);return true}
 function finish(){if(active()){working.current=false;setUploading(false)}}
 async function transfer(selected:File,pending:PendingUpload){
  if(!active())return
  try{
   const uploaded=await uploadAttachment(options.conversation,selected,pending.intent)
   if(active()){options.onUploaded(uploaded);file.current=null;setReady(false)}
  }catch(error){
   if(!active())return
   // Capacity and concurrent reservation failures can be retried with this
   // intent. A 409 can also be terminal; only the user may discard that ambiguity.
   if(error instanceof ApiError&&error.status>=400&&error.status<500&&![408,409,429].includes(error.status)){options.onPending(null);file.current=null;setReady(false)}
   options.onError(error)
  }
 }
 async function select(selected:File){
  if(!start())return
  try{
   const pending=options.getPending()
   if(!pending&&options.getCount()>=5)throw Error('You can attach up to five files.')
   const verified=await identity(selected)
   if(!active())return
   if(pending){
    if(!matches(verified,pending))throw Error('Choose the same file, with the same name and contents, to retry the unconfirmed upload.')
    file.current=selected;setReady(true)
   }else{
    const next={...verified,intent:crypto.randomUUID()}
    // Save before starting the request, including when its response is lost.
    options.onPending(next);file.current=selected;setReady(true)
    await transfer(selected,next)
   }
  }catch(error){if(active())options.onError(error)}finally{finish()}
 }
 async function retry(){
  if(!active())return
  const pending=options.getPending(),selected=file.current
  if(!pending||!selected||!start())return
  try{await transfer(selected,pending)}finally{finish()}
 }
 function discard(){if(!active()||working.current)return;options.onPending(null);file.current=null;setReady(false)}
 return {uploading,ready,select,retry,discard,isBusy:()=>working.current}
}
