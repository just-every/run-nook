import {useEffect,useRef,useState} from 'react'
import type {FileRecord} from '../chat/types'
import type {TeamRequest} from '../team/types'
import {cuesWebVTT,timestamp} from './cues.mjs'
import {isClipMime,MAX_CLIP_BYTES} from './media'
import {TranscriptEditor,type TranscriptInput} from './TranscriptEditor'
import {TranscriptHistory} from './TranscriptHistory'
import type {ClipTranscript} from './types'
import './clips.css'

export type ClipPlayerProps={file:FileRecord;request:TeamRequest;accessEpoch:number|string;revision?:number;canEdit?:boolean;onDenied:()=>void}
/** Render only for native file rows. Parent must remount on identity/scope
 * changes, as MessageRow already does for other private attachment previews. */
export function ClipPlayer(props:ClipPlayerProps){return isClipMime(props.file.mime)&&props.file.state==='attached'?<PlayerScope key={JSON.stringify([props.file.id,props.accessEpoch])} {...props}/>:null}
function PlayerScope({file,request,revision=0,canEdit=true,onDenied}:ClipPlayerProps){
 const [clip,setClip]=useState<ClipTranscript|null>(null),[error,setError]=useState(''),[mediaError,setMediaError]=useState(''),[src,setSrc]=useState(''),[captions,setCaptions]=useState(''),[busy,setBusy]=useState(false),[loadingMedia,setLoadingMedia]=useState(false),[editing,setEditing]=useState<{version:number;cues:ClipTranscript['cues'];language:string}|null>(null),[showHistory,setShowHistory]=useState(false)
 const controller=useRef<AbortController|null>(null),media=useRef<HTMLMediaElement|null>(null),url=useRef(''),mediaWorking=useRef(false),seekTo=useRef<number|null>(null),seenRevision=useRef(revision)
 const path='/api/clips/'+encodeURIComponent(file.id)
 function clearMedia(){media.current?.pause();if(url.current)URL.revokeObjectURL(url.current);url.current='';setSrc('')}
 async function load(){
  const abort=controller.current;if(!abort||abort.signal.aborted)return;setError('')
  try{const next=await request<ClipTranscript>(path,{signal:abort.signal});if(!abort.signal.aborted)setClip(old=>old&&old.version>next.version?old:next)}
  catch(error){if(!abort.signal.aborted){setClip(null);clearMedia();setEditing(null);setShowHistory(false);setError(error instanceof Error?error.message:'Transcript could not be loaded. Retry.')}}
 }
 useEffect(()=>{const abort=new AbortController();controller.current=abort;void load();return()=>{abort.abort();media.current?.pause();if(url.current)URL.revokeObjectURL(url.current);url.current=''}},[path,request])
 useEffect(()=>{if(seenRevision.current===revision)return;seenRevision.current=revision;if(controller.current&&!controller.current.signal.aborted)void load()},[revision])
 useEffect(()=>{if(!clip?.cues.length){setCaptions('');return}const next=URL.createObjectURL(new Blob([cuesWebVTT(clip.cues)],{type:'text/vtt;charset=utf-8'}));setCaptions(next);return()=>URL.revokeObjectURL(next)},[clip])
 async function loadMedia(){
  const abort=controller.current;if(!abort||abort.signal.aborted||mediaWorking.current)return
  mediaWorking.current=true;setLoadingMedia(true);setMediaError('')
  try{
   const response=await fetch(`/api/attachments/${encodeURIComponent(file.id)}/download`,{signal:abort.signal,credentials:'same-origin',cache:'no-store'})
   if([401,403].includes(response.status))onDenied()
   if(!response.ok){if([401,403,404].includes(response.status)){setClip(null);clearMedia()}throw Error('Clip could not be loaded. Check access and retry.')}
   const mime=(response.headers.get('content-type')??'').split(';')[0]
   if(mime!==file.mime||!isClipMime(mime))throw Error('The downloaded clip has an unexpected media type.')
   const blob=await response.blob()
   if(blob.size<1||blob.size>MAX_CLIP_BYTES||blob.size!==file.size)throw Error('The downloaded clip has an unexpected size.')
   if(abort.signal.aborted)return
   clearMedia();url.current=URL.createObjectURL(blob);setSrc(url.current)
  }catch(error){if(!abort.signal.aborted)setMediaError(error instanceof Error?error.message:'Playback failed. Retry the clip.')}
  finally{mediaWorking.current=false;if(!abort.signal.aborted)setLoadingMedia(false)}
 }
 function seek(seconds:number){
  seekTo.current=seconds
  if(media.current&&media.current.readyState>=1){media.current.currentTime=seconds;seekTo.current=null;media.current.focus()}
  else if(!src)void loadMedia()
 }
 function ready(){if(media.current&&seekTo.current!==null){media.current.currentTime=seekTo.current;seekTo.current=null}}
 async function save(input:TranscriptInput){
  const abort=controller.current;if(!editing||!abort||abort.signal.aborted)return;setBusy(true)
  try{const next=await request<ClipTranscript>(path,{method:'PATCH',body:JSON.stringify({...input,version:editing.version}),signal:abort.signal});if(!abort.signal.aborted){setClip(next);setEditing(null);setShowHistory(false)}}
  finally{setBusy(false)}
 }
 const track=captions&&clip?<track key={captions} src={captions} kind="captions" srcLang={clip.language} label="Transcript captions" default/>:null
 return <section className="clip-player" aria-label={'Clip: '+file.name}>
  {src?(file.mime.startsWith('video/')?<video ref={node=>{media.current=node}} src={src} controls playsInline preload="metadata" aria-label={file.name} onLoadedMetadata={ready} onError={()=>setMediaError('This browser could not play the clip. Retry or use the file download.')}>{track}</video>:<audio ref={node=>{media.current=node}} src={src} controls preload="metadata" aria-label={file.name} onLoadedMetadata={ready} onError={()=>setMediaError('This browser could not play the clip. Retry or use the file download.')}>{track}</audio>):<button type="button" className="soft-button" disabled={loadingMedia} onClick={()=>void loadMedia()}>{loadingMedia?'Loading clip…':'Load clip for playback'}</button>}
  {mediaError&&<p className="warning" role="alert">{mediaError} <button type="button" className="text-button" disabled={loadingMedia} onClick={()=>void loadMedia()}>Retry playback</button></p>}
  {error&&<p className="warning" role="alert">{error} <button type="button" className="text-button" onClick={()=>void load()}>Retry transcript</button></p>}
  {clip&&<><div className="clip-toolbar"><strong>Transcript & captions</strong><span className="clip-meta">{clip.version?'Version '+clip.version:'No transcript yet'}</span></div>
   <p className="clip-meta">Human typed or uploaded captions · private to this source message. Retention, export and erasure follow the source; no holds apply.</p>
   {editing?<TranscriptEditor cues={editing.cues} language={editing.language} busy={busy} onSave={save} onCancel={()=>setEditing(null)}/>:<>
    {clip.cues.length?<ol className="clip-cues" aria-label="Clip transcript">{clip.cues.map((cue,index)=><li key={index}><button type="button" className="text-button" aria-label={'Seek to '+timestamp(cue.start)} onClick={()=>seek(cue.start)}>{timestamp(cue.start)}</button><p>{cue.text}</p></li>)}</ol>:<p className="clip-meta">A member can add timestamped text or a WebVTT track.</p>}
    <div className="clip-toolbar">{canEdit&&<button type="button" className="text-button" onClick={()=>setEditing({version:clip.version,cues:clip.cues,language:clip.language})}>{clip.version?'Correct transcript':'Add transcript or captions'}</button>}{clip.version>0&&<button type="button" className="text-button" aria-expanded={showHistory} onClick={()=>setShowHistory(!showHistory)}>Transcript history</button>}<button type="button" className="text-button" disabled={busy} onClick={()=>void load()}>Reload transcript</button></div>
   </>}
   {showHistory&&<TranscriptHistory key={clip.version} path={path} request={request}/>}</>}
 </section>
}
