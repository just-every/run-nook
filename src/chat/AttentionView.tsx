import {ReminderCards} from './ReminderCards'
import '../app-style/attention.css'
import type {Attention,AttentionItem,Conversation,Outcome,Person} from './types'
import {OutcomeCard} from './OutcomeCard'
import {NookMark} from '../brand/NookMark'
const reasonText=(item:AttentionItem)=>item.reason==='broadcast'?'A channel-wide mention':item.reason==='keyword'?'A message with one of your keywords':item.reason==='urgent-request'?(item.message?.authorName?item.message.authorName+' needs you urgently':'Needs you urgently'):item.reason==='commitment-proposal'?'A request for you':item.reason==='commitment-update'?'An update for you':item.reason==='mention'?'You were mentioned':'A new reply'
export function AttentionView({attention,user,conversations,onOpen,onAction,onDiscuss,onRevise,mutate}:{attention:Attention;user:Person;conversations:Conversation[];onOpen:(conversation:string,message?:string|null,thread?:string|null)=>void;onAction:(o:Outcome,action:string)=>Promise<unknown>;onDiscuss:(o:Outcome)=>void;onRevise:(o:Outcome)=>void;mutate:(path:string,data:unknown,method?:string)=>Promise<unknown>}) {
 const act=(path:string,input:unknown,method?:string)=>void mutate(path,input,method).catch(()=>{})
 const discuss=(item:AttentionItem)=>onOpen(item.conversation,item.message?.id||item.outcome?.source||item.outcome?.id,item.message?.parent)
 const quiet=!!attention.dndUntil&&attention.dndUntil>Date.now(),manual=(attention.manualUntil??attention.dndUntil??0)>Date.now()
 const triage=(item:AttentionItem)=><div className="triage-actions"><button className="soft-button reveal" onClick={()=>act(`attention/${item.id}`,{action:'done'})}>Dismiss</button><button className="soft-button reveal" onClick={()=>act(`attention/${item.id}`,{action:'snooze',until:Date.now()+3600000})}>Remind me in an hour</button></div>
 return <section className="page-content attention-page"><div className="page-column">
  <div className="attention-tools">
   {quiet&&<p className="muted">Quiet until {new Date(attention.dndUntil!).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}. Urgent requests can still reach you here.</p>}
   <button className="soft-button" onClick={()=>act('settings',{dndUntil:manual?null:Date.now()+3600000},'PATCH')}>{manual?'End quiet time':'Quiet for one hour'}</button>
  </div>
  {!!attention.vacationUntil&&attention.vacationUntil>Date.now()&&<p>Your vacation holds device and email alerts until {new Date(attention.vacationUntil).toLocaleString()}. Urgent alerts follow your quiet-time choices.</p>}
  {!attention.vacationUntil&&!!attention.scheduleUntil&&attention.scheduleUntil>Date.now()&&<p className="muted">Your recurring quiet schedule is active. <a href="/app?view=you">Change your quiet schedule</a></p>}
  {attention.heldItems?.map(item=><article className="attention-card" key={'held-'+item.id}><strong>{conversations.find(c=>c.id===item.conversation)?.name??'Conversation'}</strong><p>Explain why: {item.explanation}</p></article>)}
  {attention.deferredCount>0&&<p className="muted">{attention.deferredCount} saved for later.</p>}
  <ReminderCards items={attention.reminders?.items??[]} hasMore={!!attention.reminders?.hasMore} onOpen={onOpen} mutate={mutate}/>
  {attention.personalReminders?.map(r=><article className="attention-card" key={r.id} aria-label="Personal reminder"><div className="attention-context">Reminder · {new Date(r.next_due).toLocaleString('en-US',{timeZone:r.zone})} · {r.zone}</div><p className="message-body">{r.text}</p><div className="card-actions"><button className="soft-button" onClick={()=>act('reminders/'+r.id,{version:r.version,action:'complete'},'PATCH')}>Complete reminder</button><button className="soft-button" onClick={()=>act('reminders/'+r.id,{version:r.version,action:'snooze',until:Date.now()+20*60000},'PATCH')}>Snooze 20 minutes</button>{r.conversation&&r.source&&r.source_kind==='message'&&<button className="soft-button" onClick={()=>onOpen(r.conversation!,r.source)}>Open source</button>}</div></article>)}
  {attention.items.map(item=><article key={item.id} id={'attention-'+item.id} className="attention-card reveal-host"><div className="attention-context">{conversations.find(c=>c.id===item.conversation)?.name||'Conversation'} · <span>{reasonText(item)}</span></div>
   <p className="muted">Explain why: {item.explanation}</p>
   {item.outcome?<OutcomeCard outcome={item.outcome} user={user} onAction={onAction} onDiscuss={onDiscuss} onRevise={onRevise}>{triage(item)}</OutcomeCard>:<><p className="message-body">{item.message?.deleted?'Message deleted':item.message?.body||'This message is no longer available.'}</p>{item.message?.urgentReason&&<p className="urgent-reason">{item.message.urgentReason}</p>}<div className="card-actions"><button className="soft-button" onClick={()=>discuss(item)}>Discuss</button>{triage(item)}</div></>}
  </article>)}
  {!attention.items.length&&!attention.heldItems?.length&&!attention.reminders?.items.length&&!attention.personalReminders?.length&&<div className="empty-state"><NookMark/><h3>You're all caught up</h3><p>New requests and replies will appear here.</p></div>}
 </div></section>
}
