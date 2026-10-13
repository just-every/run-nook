import '../app-style/attention.css'
import type {Attention,AttentionItem,Conversation,Outcome,Person} from './types'
import {OutcomeCard} from './OutcomeCard'
import {NookMark} from '../brand/NookMark'
const reasonText=(item:AttentionItem)=>item.reason==='urgent-request'?(item.message?.authorName?item.message.authorName+' needs you urgently':'Needs you urgently'):item.reason==='commitment-proposal'?'A request for you':item.reason==='commitment-update'?'An update for you':item.reason==='mention'?'You were mentioned':'A new reply'
export function AttentionView({attention,user,conversations,onOpen,onAction,onDiscuss,onRevise,mutate}:{attention:Attention;user:Person;conversations:Conversation[];onOpen:(conversation:string,message?:string|null,thread?:string|null)=>void;onAction:(o:Outcome,action:string)=>Promise<unknown>;onDiscuss:(o:Outcome)=>void;onRevise:(o:Outcome)=>void;mutate:(path:string,data:unknown,method?:string)=>Promise<unknown>}) {
 const act=(path:string,input:unknown,method?:string)=>void mutate(path,input,method).catch(()=>{})
 const discuss=(item:AttentionItem)=>onOpen(item.conversation,item.message?.id||item.outcome?.source||item.outcome?.id,item.message?.parent)
 const quiet=!!attention.dndUntil&&attention.dndUntil>Date.now()
 const triage=(item:AttentionItem)=><div className="triage-actions"><button className="soft-button reveal" onClick={()=>act(`attention/${item.id}`,{action:'done'})}>Dismiss</button><button className="soft-button reveal" onClick={()=>act(`attention/${item.id}`,{action:'snooze',until:Date.now()+3600000})}>Remind me in an hour</button></div>
 return <section className="page-content attention-page"><div className="page-column">
  <div className="attention-tools">
   {quiet&&<p className="muted">Quiet until {new Date(attention.dndUntil!).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}. Urgent requests can still reach you here.</p>}
   <button className="soft-button" onClick={()=>act('settings',{dndUntil:quiet?null:Date.now()+3600000},'PATCH')}>{quiet?'End quiet time':'Quiet for one hour'}</button>
  </div>
  {attention.deferredCount>0&&<p className="muted">{attention.deferredCount} saved for later.</p>}
  {attention.items.map(item=><article key={item.id} id={'attention-'+item.id} className="attention-card reveal-host"><div className="attention-context">{conversations.find(c=>c.id===item.conversation)?.name||'Conversation'} · <span>{reasonText(item)}</span></div>
   {item.outcome?<OutcomeCard outcome={item.outcome} user={user} onAction={onAction} onDiscuss={onDiscuss} onRevise={onRevise}>{triage(item)}</OutcomeCard>:<><p className="message-body">{item.message?.deleted?'Message deleted':item.message?.body||'This message is no longer available.'}</p>{item.message?.urgentReason&&<p className="urgent-reason">{item.message.urgentReason}</p>}<div className="card-actions"><button className="soft-button" onClick={()=>discuss(item)}>Discuss</button>{triage(item)}</div></>}
  </article>)}
  {!attention.items.length&&<div className="empty-state"><NookMark/><h3>You're all caught up</h3><p>New requests and replies will appear here.</p></div>}
 </div></section>
}
