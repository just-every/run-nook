import {useEffect,useRef,useState} from 'react'
import type {ReactNode} from 'react'
import type {Outcome,Person} from './types'
import {OutcomeHistory} from './OutcomeHistory'
import {dueDate} from './day'
import {IconMore} from './icons'
import {useDismiss} from './useDismiss'
export const outcomeStatus=(o:Outcome)=>({'proposed':'Awaiting agreement','accepted':'Accepted','reported-complete':'Reported done','recorded':'Decision recorded','cancelled':'Cancelled'}[o.status]||o.status)
// A decision or request as a sentence, a status line, one meta line and only the actions that are yours.
// Secondary verbs remain visible; `children` are extra actions placed in the same row.
export function OutcomeCard({outcome:o,user,onAction,onDiscuss,onRevise,compact=false,children}:{outcome:Outcome;user:Person;onAction:(o:Outcome,action:string)=>Promise<unknown>;onDiscuss:(o:Outcome)=>void;onRevise:(o:Outcome)=>void;compact?:boolean;children?:ReactNode}) {
 const [busy,setBusy]=useState(false),[confirming,setConfirming]=useState(false)
 const menu=useRef<HTMLDetailsElement>(null)
 // A saved revision or a cancellation closes the menu once the outcome moves on.
 useDismiss(menu,o.version+':'+o.status)
 // Cancelling closes a decision or request for everyone, so it asks first. The question goes once the item moves on.
 useEffect(()=>{setConfirming(false)},[o.version,o.status])
 const run=async(action:string)=>{setBusy(true);try{await onAction(o,action)}catch{}finally{setBusy(false)}}
 const noun=o.kind==='commitment'?'request':'decision',mine=o.author===user.id&&!['cancelled','reported-complete'].includes(o.status)
 const className='outcome-card reveal-host'+(compact?' compact':'')
 if(o.erased)return <article id={'outcome-'+o.id} data-outcome={o.id} tabIndex={-1} className={className}><span className={'status status-'+o.status}>{outcomeStatus(o)}</span><h3>Erased {o.kind}</h3><p>Content and attribution erased. {o.version} historical {o.version===1?'version':'versions'}; state preserved.</p></article>
 const meta=o.kind==='commitment'?`${o.authorName} → ${o.assigneeName}${o.deadline?' · due '+dueDate(o.deadline):''}`:o.authorName
 return <article aria-label={(o.kind==='decision'?'Decision':'Request')+' by '+o.authorName} id={'outcome-'+o.id} data-outcome={o.id} tabIndex={-1} className={className}>
  <span className={'status status-'+o.status}>{outcomeStatus(o)}</span><h3>{o.body}</h3>
  <p className="outcome-meta">{meta}</p>
  {(o.sourceState==='changed'||o.sourceState==='deleted')&&<p className="source-warning">The original message was {o.sourceState}. Review this {o.kind==='decision'?'decision':'request'}.</p>}
  <div className="card-actions">
   {o.assignee===user.id&&o.status==='proposed'&&<button className="send" disabled={busy} onClick={()=>void run('accept')}>{busy?'Saving…':'Accept'}</button>}
   {o.assignee===user.id&&o.status==='accepted'&&<button className="send" disabled={busy} onClick={()=>void run('complete')}>{busy?'Saving…':'Report done'}</button>}
   <button className="soft-button" onClick={()=>onDiscuss(o)}>Discuss</button>
   {children}
   {mine&&<details ref={menu} className="card-more menu"><summary className="icon-button" data-tooltip="More actions" aria-label="More actions"><IconMore/><span className="sr-only">More</span></summary><div className="popover end"><button onClick={()=>onRevise(o)}>Revise</button><button disabled={busy} onClick={()=>{if(menu.current)menu.current.open=false;setConfirming(true)}}>Cancel {noun}</button></div></details>}
  </div>
  {confirming&&mine&&<div className="outcome-confirm" role="group" aria-label={'Cancel '+noun} onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();setConfirming(false)}}}><p>Cancel this {noun}? It closes for everyone and stays in the history as cancelled.</p><button className="danger-button" disabled={busy} onClick={()=>void run('cancel')}>{busy?'Cancelling…':'Confirm cancel'}</button><button className="soft-button" disabled={busy} autoFocus onClick={()=>setConfirming(false)}>Keep {noun}</button></div>}
  <OutcomeHistory outcome={o}/>
 </article>
}
