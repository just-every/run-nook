import {useState} from 'react'
import type {TeamRequest} from '../team/types'
import type {ClipTranscript,ProviderReason,ProviderResult} from './types'
const reasons:Record<ProviderReason,string>={
 'cap-spent':'The daily provider call cap is spent. Nothing was sent and no transcript was created.',
 'provider-error':'The provider could not process this clip. No transcript was created.',
 'timeout':'The provider took too long. No transcript was created.',
 'malformed':'The provider answered with something Nook could not use. No transcript was created.',
 'changed':'The transcript changed while the provider worked, so nothing was added. Ask again if you still want it.',
 'unavailable':'The clip audio could not be read. No transcript was created.',
}
// The audio leaves Nook only after this explicit request, with the disclosure shown, to the one provider the owner configured.
export function ProviderRequest({host,version,path,request,onCreated}:{host:string;version:number;path:string;request:TeamRequest;onCreated:(next:ClipTranscript)=>void}){
 const [asking,setAsking]=useState(false),[busy,setBusy]=useState(false),[failure,setFailure]=useState('')
 async function send(){
  setBusy(true);setFailure('')
  try{const result=await request<ProviderResult>(path+'/provider-transcript',{method:'POST',body:JSON.stringify({disclosed:true,providerVersion:version})});if(result.state==='created'){onCreated(result.transcript);setAsking(false)}else setFailure(reasons[result.reason])}
  catch(error){setFailure(error instanceof Error?error.message:'The request could not be completed.')}finally{setBusy(false)}
 }
 return <div className="clip-provider">
  {!asking&&<button type="button" className="text-button" onClick={()=>{setFailure('');setAsking(true)}}>Request provider transcript</button>}
  {asking&&<div role="group" aria-label="Provider transcript request"><p className="clip-meta">Nook will send this clip’s audio to {host}, the transcription provider your owner configured, to create a transcript. The provider receives the audio as data only, with no tools and nothing else from this conversation. Nothing is sent unless you confirm.</p>
   <button type="button" className="soft-button" disabled={busy} onClick={()=>void send()}>{busy?'Waiting for the provider…':'Send audio for a transcript'}</button><button type="button" className="text-button" disabled={busy} onClick={()=>setAsking(false)}>Cancel</button></div>}
  {failure&&<p className="warning" role="alert">{failure}</p>}
 </div>
}
