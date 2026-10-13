import type {Outcome} from './types'
import {outcomeStatus} from './OutcomeCard'
const shown=2
const line=(o:Outcome)=>o.erased?`Erased ${o.kind==='decision'?'decision':'request'}`:`${o.kind==='decision'?'Decision':'Request for '+o.assigneeName} · ${o.body}${o.kind==='decision'?'':' · '+outcomeStatus(o)}`
// A decision or request saved from a message is stitched under it: one quiet line that opens the panel on that item.
export function OutcomeLines({outcomes,onOpen}:{outcomes:Outcome[];onOpen:(o:Outcome)=>void}) {
 if(!outcomes.length)return null
 return <div className="outcome-lines">
  {outcomes.slice(0,shown).map(o=><button key={o.id} type="button" className="outcome-line" data-state={o.status} onClick={()=>onOpen(o)}><span className="outcome-dot" aria-hidden="true"/><span className="outcome-text">{line(o)}</span></button>)}
  {outcomes.length>shown&&<button type="button" className="text-button" onClick={()=>onOpen(outcomes[shown])}>+{outcomes.length-shown} more</button>}
 </div>
}
