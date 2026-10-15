import {useEffect,useId,useState} from 'react'
import type {Outcome} from './types'
import {api} from './api'

type Version={version:number;body:string;status:string;deadline:string|null;actorName:string|null}
type History={items:Version[];cursor:number|null;hasMore:boolean}
const status=(value:string)=>({'recorded':'Decision recorded','proposed':'Awaiting agreement','accepted':'Accepted','reported-complete':'Reported done','cancelled':'Cancelled'}[value]||value)

export function OutcomeHistory({outcome}: {outcome:Outcome}){
 const id=useId(),[open,setOpen]=useState(false),[before,setBefore]=useState(0)
 const [history,setHistory]=useState<History|null>(null),[error,setError]=useState('')
 useEffect(()=>{setBefore(0)},[outcome.version])
 useEffect(()=>{
  setHistory(null);setError('')
  if(!open)return
  let current=true
  void api<History>(`outcomes/${outcome.id}/versions?before=${before}`).then(value=>{if(current)setHistory(value)},e=>{if(current)setError(e instanceof Error?e.message:'History could not be loaded.')})
  return ()=>{current=false}
 },[open,before,outcome.id,outcome.version])
 return <div className="outcome-history">
  <button className="text-button" aria-expanded={open} aria-controls={id} onClick={()=>setOpen(value=>!value)}>Version history · {outcome.version}</button>
  {open&&<div id={id}>
   {error?<p role="alert">{error}</p>:!history?<p role="status">Loading versions…</p>:<>
    <ol className="outcome-versions">{history.items.map(version=><li key={version.version}><p className="outcome-meta"><strong>Version {version.version}</strong>{version.version===outcome.version?' · Current':''} · {version.actorName||'Erased member'}</p><p>{version.body}</p><p className="outcome-meta">{status(version.status)}{version.deadline?' · Due '+version.deadline:''}</p></li>)}</ol>
    {history.hasMore&&<button className="text-button" onClick={()=>setBefore(history.cursor!)}>Earlier versions</button>}
    {before>0&&<button className="text-button" onClick={()=>setBefore(0)}>Latest versions</button>}
   </>}
  </div>}
 </div>
}
