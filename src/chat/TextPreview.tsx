import {useEffect,useState} from 'react'
import './composition/composition.css'
export function TextPreview({attachment,accessEpoch,onDenied}:{attachment:{id:string;name:string;mime:string};accessEpoch:number|string;onDenied:()=>void}){
 const [open,setOpen]=useState(false),[text,setText]=useState<string|null>(null),[failed,setFailed]=useState(false),[complete,setComplete]=useState(true)
 useEffect(()=>{const controller=new AbortController();setText(null);setFailed(false)
  if(!open||attachment.mime!=='text/plain')return
  void (async()=>{try{
   const response=await fetch(`/api/attachments/${encodeURIComponent(attachment.id)}/preview`,{signal:controller.signal,credentials:'same-origin',cache:'no-store'})
   if(response.status===401||response.status===403){onDenied();throw Error('Access removed')}
   if(!response.ok||!response.headers.get('Content-Type')?.startsWith('text/plain'))throw Error('Preview unavailable')
   const value=await response.text();if(controller.signal.aborted)return
   setText(value);setComplete(response.headers.get('X-Nook-Preview-Truncated')!=='true')
  }catch{if(!controller.signal.aborted)setFailed(true)}})()
  return()=>controller.abort()
 },[attachment.id,attachment.mime,accessEpoch,onDenied,open])
 if(attachment.mime!=='text/plain')return null
 return <details className="text-preview" open={open} onToggle={e=>setOpen(e.currentTarget.open)}><summary>Preview {attachment.name}</summary>{open&&(failed?<p role="status">Preview unavailable. Use the file download.</p>:text===null?<p role="status">Loading preview…</p>:<><pre tabIndex={0} aria-label={'Text of '+attachment.name}>{text}</pre>{!complete&&<p>The preview shows the first 64 KiB. Download the file for the complete text.</p>}</>)}</details>
}
