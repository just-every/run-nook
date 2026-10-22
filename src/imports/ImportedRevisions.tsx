import {useEffect,useRef,useState} from 'react'
import type {ImportedRevision,ImportedRevisionHistory} from './revisions'
import {slackPlainText} from './slack-text.mjs'

export type ImportedRevisionsProps={messageId:string;accessEpoch:number|string;onDenied?:()=>void}
/** The identity/access epoch is part of component identity: no old response or
 * expanded private body can survive a new audience or an aborted read. */
export function ImportedRevisions(props:ImportedRevisionsProps){return <RevisionScope key={JSON.stringify([props.messageId,props.accessEpoch])} {...props}/>}
function RevisionScope({messageId,onDenied}:ImportedRevisionsProps){
 const [open,setOpen]=useState(false),[history,setHistory]=useState<ImportedRevisionHistory|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const controller=useRef<AbortController|null>(null),denied=useRef(onDenied);denied.current=onDenied
 async function load(){
  controller.current?.abort();const abort=new AbortController();controller.current=abort
  setBusy(true);setError('');setHistory(null)
  try{
   const path=`/api/messages/${encodeURIComponent(messageId)}/imported-revisions`
   const response=await fetch(path,{signal:abort.signal,credentials:'same-origin',cache:'no-store'})
   if(!response.ok){const failure=Error('Imported revisions could not be loaded.') as Error&{status:number};failure.status=response.status;throw failure}
   const next=await response.json() as ImportedRevisionHistory
   if(!abort.signal.aborted)setHistory(next)
  }catch(error){
   if(!abort.signal.aborted){
    setHistory(null)
    const status=error&&typeof error==='object'&&'status' in error?Number(error.status):0
    if([401,403,404].includes(status))denied.current?.()
    setError(error instanceof Error?error.message:'Imported revisions could not be loaded.')
   }
  }finally{if(!abort.signal.aborted)setBusy(false)}
 }
 useEffect(()=>{if(open)void load();else{controller.current?.abort();setHistory(null);setError('');setBusy(false)}return()=>controller.current?.abort()},[open,messageId])
 return <details className="imported-revisions" style={{overflowWrap:'anywhere'}} onToggle={event=>setOpen(event.currentTarget.open)}>
  <summary>Imported revision history</summary>
  {open&&<div aria-busy={busy}>
   <p className="muted">Earlier text retained by completed import passes. Source edits have no native edit or notification effects.</p>
   {busy&&<p role="status">Loading revisions…</p>}
   {error&&<p className="warning" role="alert">{error} <button type="button" className="text-button" disabled={busy} onClick={()=>void load()}>Retry revisions</button></p>}
   {history&&<>{history.revisions.length===0&&<p>No earlier text is retained in this import’s revision history.</p>}<ol>{[...history.revisions,history.current].map((item,index)=><li key={item.provenance.id??index}><Revision item={item} index={index}/></li>)}</ol></>}
  </div>}
 </details>
}
function Revision({item,index}:{item:ImportedRevision;index:number}){
 const numeric=Number(item.sourceTimestamp),date=Number.isFinite(numeric)?new Date(numeric*1000):null
 const text=item.provenance.source==='Slack'?slackPlainText(item.body):item.body
 return <article><p><strong>{item.state==='current'?'Current imported text':`Earlier text ${index+1}`}</strong> · {item.provenance.source}{item.edited?' · edited in source':''}</p>
  <p className="muted">Source timestamp: {date&&Number.isFinite(date.getTime())?<time dateTime={date.toISOString()}>{date.toLocaleString()}</time>:item.sourceTimestamp}{item.pass?.importedAt!==null&&item.pass?.importedAt!==undefined?<> · Imported {new Date(item.pass.importedAt).toLocaleString()}</>:null}</p>
  <p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{text}</p>
  <p className="muted">{item.pass?<>Import pass <code>{item.pass.planId??item.pass.jobId}</code></>:'Import pass attribution is not retained for this snapshot.'}</p>
 </article>
}
