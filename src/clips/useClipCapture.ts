import {useEffect,useRef,useState} from 'react'
import {clipExtension,MAX_CLIP_BYTES} from './media'
export type CaptureMode='audio'|'video'|'screen'
type Capture={recorder:MediaRecorder;stream:MediaStream;chunks:Blob[];size:number;failed:boolean;mime:string}
const describe=(error:unknown)=>error instanceof Error?error.message:'Recording failed. Check browser permissions and try again.'
const recordingTypes=(mode:CaptureMode)=>mode==='audio'?['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus']:['video/webm;codecs=vp8,opus','video/webm','video/mp4']

/** Acquires devices only inside start(), called from an explicit button action.
 * Every stream is stopped on success, failure, cancellation or unmount. */
export function useClipCapture(onCaptured:(file:File)=>void){
 const [phase,setPhase]=useState<'idle'|'starting'|'recording'>('idle'),[error,setError]=useState(''),[elapsed,setElapsed]=useState(0)
 const current=useRef<Capture|null>(null),lifetime=useRef(0),pending=useRef(false),callback=useRef(onCaptured);callback.current=onCaptured
 useEffect(()=>()=>{
  lifetime.current++;pending.current=false;const capture=current.current;current.current=null
  if(capture){capture.failed=true;if(capture.recorder.state!=='inactive')capture.recorder.stop();capture.stream.getTracks().forEach(track=>track.stop());capture.chunks=[]}
 },[])
 useEffect(()=>{if(phase!=='recording')return;const start=Date.now();setElapsed(0);const timer=setInterval(()=>setElapsed(Math.floor((Date.now()-start)/1000)),1000);return()=>clearInterval(timer)},[phase])
 function stop(){const capture=current.current;if(capture&&capture.recorder.state!=='inactive')capture.recorder.stop()}
 function cancel(){
  lifetime.current++;pending.current=false;const capture=current.current;current.current=null
  if(capture){capture.failed=true;if(capture.recorder.state!=='inactive')capture.recorder.stop();capture.stream.getTracks().forEach(track=>track.stop());capture.chunks=[]}
  setPhase('idle');setError('')
 }
 async function start(mode:CaptureMode){
  if(pending.current||current.current)return
  const epoch=++lifetime.current;pending.current=true;setError('');setPhase('starting')
  let stream:MediaStream|null=null
  try{
   if(typeof MediaRecorder==='undefined')throw Error('This browser cannot record clips. You can upload a supported audio or video file.')
   const mime=recordingTypes(mode).find(type=>MediaRecorder.isTypeSupported(type))
   if(!mime)throw Error('This browser has no supported recording format. Upload WebM, MP4/M4A or Ogg audio instead.')
   if(mode==='screen'){
    if(!navigator.mediaDevices?.getDisplayMedia)throw Error('Screen capture is unavailable in this browser. Upload a screen recording instead.')
    stream=await navigator.mediaDevices.getDisplayMedia({video:true,audio:true})
   }else{
    if(!navigator.mediaDevices?.getUserMedia)throw Error('Recording requires browser camera or microphone support and a secure connection.')
    stream=await navigator.mediaDevices.getUserMedia({audio:true,video:mode==='video'})
   }
   if(lifetime.current!==epoch){stream.getTracks().forEach(track=>track.stop());return}
   const recorder=new MediaRecorder(stream,{mimeType:mime}),capture:Capture={recorder,stream,chunks:[],size:0,failed:false,mime:(recorder.mimeType||mime).split(';')[0]}
   current.current=capture
   const active=()=>lifetime.current===epoch&&current.current===capture
   recorder.ondataavailable=event=>{
    if(!active()||capture.failed||!event.data.size)return
    capture.size+=event.data.size
    if(capture.size>MAX_CLIP_BYTES){capture.failed=true;capture.chunks=[];setError('Recording exceeded 25 MiB. Record a shorter clip and try again.');stop();return}
    capture.chunks.push(event.data)
   }
   recorder.onerror=()=>{if(active()){capture.failed=true;setError('Recording failed. Check browser permissions and try again.');stop()}}
   recorder.onstop=()=>{
    capture.stream.getTracks().forEach(track=>track.stop())
    if(!active()){capture.chunks=[];return}
    current.current=null;pending.current=false;setPhase('idle')
    if(capture.failed){capture.chunks=[];return}
    const blob=new Blob(capture.chunks,{type:capture.mime});capture.chunks=[]
    if(!blob.size){setError('The recording was empty. Try recording again.');return}
    callback.current(new File([blob],`clip-${new Date().toISOString().replace(/[:.]/g,'-')}.${clipExtension(capture.mime)}`,{type:capture.mime}))
   }
   for(const track of stream.getTracks())track.addEventListener('ended',()=>{if(active())stop()},{once:true})
   recorder.start(1000);pending.current=false;setPhase('recording')
  }catch(error){
   stream?.getTracks().forEach(track=>track.stop())
   if(lifetime.current===epoch){const capture=current.current;if(capture){capture.failed=true;capture.chunks=[];current.current=null}pending.current=false;setPhase('idle');setError(describe(error))}
  }
 }
 return {phase,error,elapsed,start,stop,cancel}
}
