import {useEffect,useId,useRef,useState} from 'react'
import {usePrivateScope} from '../chat/usePrivateScope'
import {assembleExport,exportRequest,saveExport,ExportError} from './client'
import type {ExportReport} from './types'
import './readable-export.css'

type Props={userId:string;privateSignal:AbortSignal;conversationId?:string}
type Jobs={items:ExportReport[];hasMore:boolean;cursor:string|null}
export function ReadableExport(props:Props){
 return <ExportPanel key={props.userId+':'+(props.conversationId??'permitted')} {...props}/>
}
function ExportPanel({privateSignal,conversationId}:Props){
 const current=usePrivateScope(privateSignal,'readable-export:'+conversationId),title=useId(),ack=useId()
 const [accepted,setAccepted]=useState(false),[jobs,setJobs]=useState<Jobs|null>(null),[job,setJob]=useState<ExportReport|null>(null)
 const [busy,setBusy]=useState<'prepare'|'download'|'request'|null>(null),[progress,setProgress]=useState(''),[error,setError]=useState('')
 const operation=useRef<AbortController|null>(null)
 useEffect(()=>{
  const controller=new AbortController(),signal=AbortSignal.any([privateSignal,controller.signal])
  void exportRequest<Jobs>('',undefined,signal).then(next=>{if(current())setJobs(next)}).catch(e=>{if(current()&&!signal.aborted)setError(e.message)})
  return()=>{controller.abort();operation.current?.abort()}
 },[privateSignal,current])
 const publish=(next:ExportReport)=>{
  if(!current())return
  setJob(next);setJobs(previous=>previous?{...previous,items:previous.items.some(item=>item.id===next.id)?previous.items.map(item=>item.id===next.id?next:item):[next,...previous.items]}:previous)
 }
 const perform=async(kind:NonNullable<typeof busy>,action:(signal:AbortSignal)=>Promise<void>,targetId=job?.id)=>{
  if(!current())return
  operation.current?.abort()
  const controller=new AbortController();operation.current=controller
  const signal=AbortSignal.any([privateSignal,controller.signal]);setBusy(kind);setError('');setProgress('')
  try{await action(signal)}catch(e){if(current()&&!signal.aborted){
   setError(e instanceof Error?e.message:'Export failed')
   if(targetId&&e instanceof ExportError&&(e.status===403||e.status===409)){
    setJob(selected=>selected?.id===targetId?null:selected)
    setJobs(previous=>previous?{...previous,items:previous.items.map(item=>item.id===targetId?{...item,complete:false,state:e.status===403?'unavailable':'invalidated'}:item)}:previous)
   }
  }}
  finally{if(current()&&operation.current===controller){operation.current=null;setBusy(null)}}
 }
 const prepare=async(start:ExportReport,signal:AbortSignal)=>{
  let next=start;publish(next)
  while(next.state==='running'&&!signal.aborted&&current()){
   setProgress(`Verified ${next.records} records, ${next.files} files and ${next.bytes.toLocaleString()} file bytes. You can cancel and resume.`)
   next=await exportRequest<ExportReport>(`/${next.id}/step`,{},signal)
   if(!signal.aborted)publish(next)
  }
  if(current()&&!signal.aborted)setProgress(next.complete?'Preparation complete. Choose a download format.':'Preparation stopped.')
 }
 const create=()=>void perform('prepare',async signal=>{
  setJob(null)
  const next=await exportRequest<ExportReport>('',{scope:conversationId?'conversation':'permitted',...(conversationId?{conversationId}:{}),custodyAccepted:accepted},signal)
  if(!signal.aborted&&current())await prepare(next,signal)
 })
 const resume=(selected:ExportReport)=>void perform('prepare',async signal=>{
  const next=selected.state==='cancelled'?await exportRequest<ExportReport>(`/${selected.id}/resume`,{},signal):await exportRequest<ExportReport>('/'+selected.id,undefined,signal)
  if(!signal.aborted&&current())await prepare(next,signal)
 },selected.id)
 const cancel=()=>{if(job)void perform('request',async signal=>{const next=await exportRequest<ExportReport>(`/${job.id}/cancel`,{},signal);if(!signal.aborted)publish(next);if(current())setProgress(next.complete?'Preparation already completed. Choose a download format.':'Preparation cancelled. Verified page cursors are retained for resuming.')})}
 const download=(format:'json'|'jsonl'|'html')=>{if(job)void perform('download',async signal=>{
  const bundle=await assembleExport(job.id,message=>{if(current()&&!signal.aborted)setProgress(message)},signal)
  if(current()&&!signal.aborted){saveExport(bundle,format);setProgress('Download created. Keep the copy private; live erasure cannot recall it.')}
 })}
 const refresh=(more=false)=>void perform('request',async signal=>{
  const next=await exportRequest<Jobs>(more&&jobs?.cursor?'?after='+encodeURIComponent(jobs.cursor):'',undefined,signal)
  if(current()&&!signal.aborted)setJobs(previous=>more&&previous?{...next,items:[...previous.items,...next.items]}:next)
 })
 return <section className="readable-export" aria-labelledby={title}>
  <h3 id={title}>Readable export</h3>
  <p>{conversationId?'Export this conversation and its complete threads.':'Export all conversations you can currently read, including your DMs.'} Each format includes message history, outcomes, membership records, source mappings and verified file bytes.</p>
  <p className="muted">Your role does not open anyone else’s DMs. This export uses your current membership. Organization-wide compliance exports require separate authority.</p>
  <label className="readable-export-ack" htmlFor={ack}><input id={ack} type="checkbox" checked={accepted} onChange={event=>setAccepted(event.target.checked)} disabled={!!busy}/>I will keep downloaded copies private and manage their retention. Later removal or erasure cannot recall them.</label>
  <div className="readable-export-actions"><button className="soft-button" disabled={!accepted||!!busy} onClick={create}>Prepare {conversationId?'conversation':'my permitted conversations'}</button><button className="soft-button" disabled={!!busy} onClick={()=>refresh()}>Refresh exports</button></div>
  {error&&<p role="alert">{error}</p>}
  {progress&&<p role="status" aria-live="polite">{progress}</p>}
  {busy==='prepare'&&job?.state==='running'&&<button className="soft-button" onClick={cancel}>Cancel preparation</button>}
  {busy==='download'&&<button className="soft-button" onClick={()=>{operation.current?.abort();setProgress('Download stopped. Your completed server job is still available.')}}>Stop download</button>}
  {job&&<div className="readable-export-report"><h4>Completeness report</h4><p>{job.state} · {job.records.toLocaleString()} records · {job.files.toLocaleString()} files · {job.bytes.toLocaleString()} file bytes · {job.pages.toLocaleString()} verified pages · {job.sourceOmissions.toLocaleString()} source omissions</p>
   {job.complete&&<div className="readable-export-actions"><button className="soft-button" disabled={!!busy} onClick={()=>download('html')}>Download offline HTML</button><button className="soft-button" disabled={!!busy} onClick={()=>download('json')}>Download JSON</button><button className="soft-button" disabled={!!busy} onClick={()=>download('jsonl')}>Download JSONL</button></div>}
   <details><summary>Included counts and named omissions</summary><dl>{Object.entries(job.counts).map(([name,count])=><div key={name}><dt>{name.replaceAll('_',' ')}</dt><dd>{count.toLocaleString()}</dd></div>)}</dl><ul>{job.omissions.map(omission=><li key={omission.code}><strong>{omission.code}:</strong> {omission.reason}</li>)}</ul><p>{job.custody}</p></details>
  </div>}
  {!jobs?<p className="muted">Loading your export jobs…</p>:<><h4>Your export jobs</h4>{!jobs.items.length&&<p>No exports prepared yet.</p>}<ul className="readable-export-jobs">{jobs.items.map(item=><li key={item.id}><div><time>{new Date(item.created).toLocaleString()}</time><br/>{item.scope==='conversation'?'Conversation':'Permitted conversations'} · {item.state} · {item.records.toLocaleString()} records</div><div className="readable-export-actions">{(item.state==='running'||item.state==='cancelled')&&<button className="soft-button" disabled={!!busy} onClick={()=>resume(item)}>{item.state==='cancelled'?'Resume':'Continue'}</button>}{item.complete&&<button className="soft-button" disabled={!!busy} onClick={()=>void perform('request',async signal=>{const next=await exportRequest<ExportReport>('/'+item.id,undefined,signal);if(!signal.aborted)publish(next)},item.id)}>Open report</button>}{(item.state==='invalidated'||item.state==='unavailable')&&<span className="muted">Start a new export from your current scope.</span>}</div></li>)}</ul>{jobs.hasMore&&<button className="soft-button" disabled={!!busy} onClick={()=>refresh(true)}>Older exports</button>}</>}
 </section>
}
