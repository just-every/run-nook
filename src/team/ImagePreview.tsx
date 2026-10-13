import {useEffect,useState} from 'react'
export function ImagePreview({attachment,accessEpoch,onDenied}:{attachment:{id:string;name:string;mime:string};accessEpoch:number|string;onDenied:()=>void}){
 const [src,setSrc]=useState(''),[failed,setFailed]=useState(false)
 useEffect(()=>{let blobUrl='';const controller=new AbortController();setSrc('');setFailed(false)
  if(!['image/png','image/jpeg'].includes(attachment.mime))return
  void (async()=>{try{const response=await fetch(`/api/attachments/${encodeURIComponent(attachment.id)}/preview`,{signal:controller.signal,credentials:'same-origin',cache:'no-store'});if(response.status===401||response.status===403){onDenied();throw new Error('Access removed')}if(!response.ok||!['image/png','image/jpeg'].includes(response.headers.get('content-type')??''))throw new Error('Preview unavailable');const blob=await response.blob();if(controller.signal.aborted)return;blobUrl=URL.createObjectURL(blob);setSrc(blobUrl)}catch{if(!controller.signal.aborted)setFailed(true)}})()
  return()=>{controller.abort();if(blobUrl)URL.revokeObjectURL(blobUrl)}
 },[attachment.id,attachment.mime,accessEpoch,onDenied])
 if(!['image/png','image/jpeg'].includes(attachment.mime))return null
 return <figure className="team-image">{src&&!failed&&<img src={src} alt={attachment.name} loading="lazy" onError={()=>setFailed(true)}/>} {failed&&<figcaption>Preview unavailable. Use the file download.</figcaption>}</figure>
}
