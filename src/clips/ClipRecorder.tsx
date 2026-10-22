import {useEffect,useId,useRef,useState} from 'react'
import {uploadAttachment} from '../chat/api'
import type {FileRecord} from '../chat/types'
import {clipFile} from './media'
import {useClipCapture} from './useClipCapture'
import './clips.css'

export type ClipRecorderProps={
 conversation:string;disabled?:boolean;privateSignal?:AbortSignal;
 onUploaded:(file:FileRecord)=>void;onBusyChange?:(busy:boolean)=>void;
 onClose?:()=>void;
}
/** Mount inside the composer's conversation/thread private scope. onUploaded
 * appends the native staged FileRecord to the ordinary message attachment list.
 * onBusyChange blocks sending while capture, preview or upload is pending. */
export function ClipRecorder(props:ClipRecorderProps){return <RecorderScope key={props.conversation} {...props}/>}
function RecorderScope({conversation,disabled=false,privateSignal,onUploaded,onBusyChange,onClose}:ClipRecorderProps){
 const [selected,setSelected]=useState<{file:File;intent:string}|null>(null),[preview,setPreview]=useState(''),[uploading,setUploading]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
 const id=useId(),alive=useRef(true),working=useRef(false),busyCallback=useRef(onBusyChange);busyCallback.current=onBusyChange
 const capture=useClipCapture(file=>choose(file))
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;busyCallback.current?.(false)}},[])
 useEffect(()=>{
  if(!privateSignal)return
  const clear=()=>{alive.current=false;capture.cancel();setSelected(null);setPreview('');setError('');busyCallback.current?.(false)}
  if(privateSignal.aborted)clear();else privateSignal.addEventListener('abort',clear,{once:true})
  return()=>privateSignal.removeEventListener('abort',clear)
 },[privateSignal])
 useEffect(()=>{if(!selected){setPreview('');return}const url=URL.createObjectURL(selected.file);setPreview(url);return()=>URL.revokeObjectURL(url)},[selected])
 const busy=capture.phase!=='idle'||!!selected||uploading
 useEffect(()=>{busyCallback.current?.(busy)},[busy])
 function choose(file:File){
  if(!alive.current||privateSignal?.aborted)return
  try{const normalized=clipFile(file);setSelected({file:normalized,intent:crypto.randomUUID()});setError('');setNotice('Clip ready. Upload it, then send the message to share with this conversation.')}
  catch(error){setError(error instanceof Error?error.message:'Clip could not be selected.')}
 }
 async function upload(){
  if(!selected||working.current||disabled||!alive.current||privateSignal?.aborted)return
  working.current=true;setUploading(true);setError('');setNotice('Uploading clip…')
  try{
   const file=await uploadAttachment(conversation,selected.file,selected.intent)
   if(alive.current&&!privateSignal?.aborted){onUploaded(file);setSelected(null);setNotice('Clip attached. Send the message to share it.')}
  }catch(error){if(alive.current&&!privateSignal?.aborted){setError(error instanceof Error?error.message:'Upload failed. Retry this clip.');setNotice('')}}
  finally{working.current=false;if(alive.current)setUploading(false)}
 }
 const capturing=capture.phase!=='idle',locked=disabled||uploading||capturing||!!selected
 return <section className="clip-recorder" aria-label="Record or upload a clip" aria-busy={uploading}>
  <div className="clip-toolbar"><strong>Audio, video or screen clip</strong>{onClose&&<button type="button" className="text-button" disabled={uploading} onClick={()=>{capture.cancel();onClose()}}>Close</button>}</div>
  <p className="clip-meta">WebM, MP4/M4A, Ogg audio, MP3 or WAV · up to 25 MiB. Sharing uses this message’s conversation audience. Captions and transcripts are typed or uploaded after sending.</p>
  {!capturing&&<div className="clip-toolbar"><button type="button" className="soft-button" disabled={locked} onClick={()=>void capture.start('audio')}>Record audio</button><button type="button" className="soft-button" disabled={locked} onClick={()=>void capture.start('video')}>Record video</button><button type="button" className="soft-button" disabled={locked} onClick={()=>void capture.start('screen')}>Record screen</button><label className="clip-upload" htmlFor={id}>Upload clip<input id={id} type="file" accept="audio/webm,video/webm,audio/mp4,video/mp4,audio/ogg,audio/mpeg,audio/wav,.webm,.mp4,.m4a,.ogg,.mp3,.wav" disabled={locked} onChange={e=>{const file=e.target.files?.[0];if(file)choose(file);e.target.value=''}}/></label></div>}
  <p className="clip-meta">Screen capture records the selected screen or window and any audio the browser shares. Availability depends on your browser and device.</p>
  {capturing&&<div className="clip-recording" role="status"><span className="clip-recording-dot" aria-hidden="true"/><strong>{capture.phase==='starting'?'Waiting for browser permission…':`Recording · ${Math.floor(capture.elapsed/60)}:${String(capture.elapsed%60).padStart(2,'0')}`}</strong>{capture.phase==='recording'&&<button type="button" className="soft-button" onClick={capture.stop}>Stop recording</button>}<button type="button" className="text-button" onClick={capture.cancel}>Cancel recording</button></div>}
  {selected&&<div className="clip-preview"><p>{selected.file.name} · {(selected.file.size/1024/1024).toFixed(2)} MiB</p>{preview&&(selected.file.type.startsWith('video/')?<video controls playsInline src={preview} aria-label="Recorded clip preview"/>:<audio controls src={preview} aria-label="Recorded clip preview"/>)}<div className="clip-toolbar"><button type="button" className="soft-button" disabled={uploading||disabled} onClick={()=>void upload()}>{uploading?'Uploading…':error?'Retry upload':'Attach clip'}</button><button type="button" className="text-button" disabled={uploading} onClick={()=>{setSelected(null);setError('');setNotice('')}}>Discard clip</button></div></div>}
  {(error||capture.error)&&<p className="warning" role="alert">{error||capture.error}</p>}
  <p className="clip-meta" role="status">{notice}</p>
 </section>
}
