import {useEffect,useState} from 'react'
export function InertPreview({attachment,accessEpoch,onDenied}:{attachment:{id:string;name:string;mime:string};accessEpoch:string;onDenied:()=>void}){
 const zip=attachment.mime==='application/zip'||/\.zip$/i.test(attachment.name)&&['application/octet-stream','text/plain'].includes(attachment.mime),supported=zip||['text/plain','text/csv'].includes(attachment.mime),[open,setOpen]=useState(false),[result,setResult]=useState<{text:string;truncated:boolean}|null>(null),[failed,setFailed]=useState(false)
 useEffect(()=>{const controller=new AbortController();setResult(null);setFailed(false)
  if(!supported||!open)return
  void(async()=>{try{
   const response=await fetch(`/api/attachments/${encodeURIComponent(attachment.id)}/preview`,{signal:controller.signal,credentials:'same-origin',cache:'no-store'})
   if([401,403,404].includes(response.status)){onDenied();throw Error('Access removed')}
   if(!response.ok||!response.headers.get('Content-Type')?.startsWith('text/plain'))throw Error('Preview unavailable')
   const text=await response.text();if(!controller.signal.aborted)setResult({text,truncated:response.headers.get('X-Nook-Preview-Truncated')==='true'})
  }catch{if(!controller.signal.aborted)setFailed(true)}})()
  return()=>controller.abort()
 },[attachment.id,attachment.mime,accessEpoch,onDenied,supported,open])
 if(!supported)return null
 return <details className="file-inert-preview" open={open} onToggle={event=>setOpen(event.currentTarget.open)}><summary>Preview {attachment.name}</summary>{open&&(failed?<p role="status">Preview unavailable. Use the file download.</p>:!result?<p role="status">Loading preview…</p>:<><pre tabIndex={0} aria-label={'Preview of '+attachment.name}>{result.text}</pre>{result.truncated&&<p role="status">Truncated preview. Download the file for the complete contents.</p>}{zip&&<p className="muted">Entry names and sizes only. Files are not extracted.</p>}</>)}</details>
}
