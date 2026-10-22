import {useEffect,useRef,useState} from 'react'
import type {TeamRequest} from '../team/types'
import {timestamp} from './cues.mjs'
import type {ClipHistory} from './types'
export function TranscriptHistory({path,request}:{path:string;request:TeamRequest}){
 const [history,setHistory]=useState<ClipHistory|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),controller=useRef<AbortController|null>(null)
 async function load(before?:number){
  const abort=controller.current;if(!abort||abort.signal.aborted)return;setBusy(true);setError('')
  try{
   const next=await request<ClipHistory>(path+'/history'+(before?'?before='+before:''),{signal:abort.signal})
   if(!abort.signal.aborted)setHistory(old=>before&&old?{...next,items:[...old.items,...next.items]}:next)
  }catch(error){if(!abort.signal.aborted)setError(error instanceof Error?error.message:'History could not be loaded.')}
  finally{if(!abort.signal.aborted)setBusy(false)}
 }
 useEffect(()=>{const abort=new AbortController();controller.current=abort;void load();return()=>abort.abort()},[path,request])
 return <section className="clip-history" aria-label="Transcript correction history" aria-busy={busy}><h4>Transcript history</h4>
  {history&&<ol>{history.items.map(revision=><li key={revision.version}><details><summary>Version {revision.version} · {revision.actorName??'Former member'} · {new Date(revision.created).toLocaleString()}</summary><p className="clip-meta">{revision.format==='webvtt'?'Uploaded WebVTT':'Typed cues'} · {revision.language}</p>{revision.cues.length?<ol className="clip-cues">{revision.cues.map((cue,index)=><li key={index}><span>{timestamp(cue.start)} – {timestamp(cue.end)}</span><p>{cue.text}</p></li>)}</ol>:<p>No transcript cues in this version.</p>}</details></li>)}</ol>}
  {history?.cursor&&<button type="button" className="text-button" disabled={busy} onClick={()=>void load(history.cursor!)}>Earlier transcript versions</button>}
  {error&&<p className="warning" role="alert">{error} <button type="button" className="text-button" disabled={busy} onClick={()=>void load()}>Retry history</button></p>}
 </section>
}
