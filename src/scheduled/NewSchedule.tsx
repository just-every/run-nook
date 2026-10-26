import {useEffect,useRef,useState} from 'react'
import {api} from '../chat/api'
import type {Conversation,Person} from '../chat/types'
import {conversationName} from '../chat/Navigation'
import {recentVisits} from '../chat/recent-navigation'
import {containDialogFocus} from '../chat/dialog-focus'
import {TooltipButton} from '../chat/TooltipButton'
import {IconClose} from '../chat/icons'
import {ScheduleEditor} from './ScheduleEditor'

export function NewSchedule({privateSignal,close,onSaved}:{privateSignal:AbortSignal;close:()=>void;onSaved:()=>Promise<void>}){
 const dialog=useRef<HTMLDialogElement>(null),[data,setData]=useState<{user:Person;conversations:Conversation[]}|null>(null),[conversation,setConversation]=useState(''),[error,setError]=useState('')
 useEffect(()=>{const trigger=document.activeElement as HTMLElement;dialog.current?.showModal();return()=>{if(trigger?.isConnected)trigger.focus({preventScroll:true})}},[])
 useEffect(()=>{let live=true;void api<{user:Person;conversations:Conversation[]}>('workspace?view=scheduled').then(({user,conversations:items})=>{if(!live||privateSignal.aborted)return;const conversations=items.filter(c=>!c.archived&&!c.convertedTo&&c.canPost!==false&&c.canPost!==0);const recent=recentVisits(user.id).map(visit=>visit.key.startsWith('c:')?visit.key.slice(2):visit.conversation).find(id=>conversations.some(c=>c.id===id));setData({user,conversations});setConversation(recent??conversations[0]?.id??'')}).catch(cause=>{if(live&&!privateSignal.aborted)setError(cause instanceof Error?cause.message:'Conversations could not be loaded')});return()=>{live=false}},[privateSignal])
 return <dialog ref={dialog} aria-labelledby="new-schedule-title" onKeyDown={containDialogFocus} onCancel={event=>{event.preventDefault();close()}}><div className="dialog-heading"><h2 id="new-schedule-title">Schedule a message</h2><TooltipButton className="icon-button nook-scheduler-close" label="Close scheduler" onClick={close}><IconClose/></TooltipButton></div>{error&&<p role="alert">{error}</p>}{data?<>{data.conversations.length?<><label className="field">Conversation<select aria-label="Conversation" autoFocus value={conversation} onChange={event=>setConversation(event.target.value)}>{data.conversations.map(c=><option key={c.id} value={c.id}>{c.kind==='dm'?'':'# '}{conversationName(c,data.user)}</option>)}</select></label>{conversation&&<ScheduleEditor key={conversation} conversation={conversation} name={conversationName(data.conversations.find(c=>c.id===conversation)!,data.user)} privateSignal={privateSignal} onSaved={onSaved}/>}</>:<a className="soft-button" href="/app?view=channels">Choose a channel</a>}</>:!error&&<p role="status">Loading conversations…</p>}</dialog>
}
