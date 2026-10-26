import {formatTime} from '../chat/format-time'
import {useEffect,useId,useRef,useState} from 'react'
import {api} from '../chat/api'
import {usePrivateScope} from '../chat/usePrivateScope'
import {containDialogFocus} from '../chat/dialog-focus'
import {IconClose} from '../chat/icons'
import type {Conversation} from '../chat/types'
import {ReminderEditor} from './ReminderEditor'
import type {Reminder,ReminderPage} from './types'
import '../app-style/threads.css'

type Props = {
 revision:number
 privateSignal:AbortSignal
 userId:string
 onError:(error:unknown)=>void
 onOpen:(conversation:string,message:string,thread:string|null)=>void
 refresh:()=>Promise<void>
 conversations:Conversation[]
}
const status={pending:'Scheduled',delivered:'Delivered',held:'Held',failed:'Failed',done:'Complete',cancelled:'Cancelled'}
const repeats={none:'Once',daily:'Every day',weekdays:'Every weekday',weekly:'Every week',monthly:'Every month'}

export function RemindersView({revision,privateSignal,userId,onError,onOpen,refresh,conversations}:Props){
 const [page,setPage]=useState<ReminderPage|null>(null),[editor,setEditor]=useState<{existing?:Reminder}|null>(null),[busy,setBusy]=useState(false)
 const readEpoch=useRef(0),writing=useRef(false),emptyOpened=useRef(false)
 const current=usePrivateScope(privateSignal,'reminders'),dialog=useRef<HTMLDialogElement>(null),titleId=useId()
 useEffect(()=>{
  let cancelled=false;const epoch=++readEpoch.current
  void api<ReminderPage>('reminders').then(next=>{if(!cancelled&&current()&&!writing.current&&epoch===readEpoch.current)setPage(next)}).catch(error=>{if(!cancelled&&current())onError(error)})
  return()=>{cancelled=true}
 },[revision,current,onError])
 useEffect(()=>{if(!page)return;if(page.items.length){emptyOpened.current=false;return}if(!emptyOpened.current){emptyOpened.current=true;setEditor({})}},[page])
 useEffect(()=>{
  if(!editor)return
  const trigger=document.activeElement as HTMLElement|null
  dialog.current?.showModal();dialog.current?.querySelector<HTMLTextAreaElement>('textarea[name="phrase"]')?.focus()
  return()=>{if(trigger?.isConnected)trigger.focus({preventScroll:true})}
 },[editor])
 const act=async(item:Reminder,action:'complete'|'snooze'|'cancel')=>{
  if(!current()||busy||writing.current)return
  writing.current=true;readEpoch.current++;setBusy(true)
  try{
   await api('reminders/'+encodeURIComponent(item.id),{action,version:item.version,...(action==='snooze'?{until:Date.now()+20*60_000}:{})},'PATCH')
   if(current()){
    await refresh()
    // Workspace refresh publishes a revision; its list effect is asynchronous.
    // Keep actions fenced until this card holds the server's new version.
    const next=await api<ReminderPage>('reminders')
    if(current()){readEpoch.current++;setPage(next)}
   }
  }catch(error){if(current())onError(error)}
  finally{writing.current=false;if(current())setBusy(false)}
 }
 const more=async()=>{
  if(!page||busy||!current())return
  setBusy(true)
  try{
   const next=await api<ReminderPage>('reminders?after='+encodeURIComponent(page.cursor))
   if(current())setPage({...next,items:[...page.items,...next.items]})
  }catch(error){if(current())onError(error)}
  finally{if(current())setBusy(false)}
 }
 return <section className="page-content threads-page"><div className="page-column">
  <button className="soft-button" disabled={busy} onClick={()=>setEditor({})}>Create reminder</button>
  {!page&&<p role="status" className="muted">Loading reminders…</p>}
  {page?.items.map(item=>{
   const owner=item.user===userId,recipient=item.recipient===userId,finished=item.delivery==='done'||item.delivery==='cancelled'||item.state==='cancelled'
   const conversation=item.conversation?conversations.find(value=>value.id===item.conversation):null
   const name=item.unavailable?'Source unavailable':item.schedule?(conversation?.name??item.name??'Channel reminder'):'Personal reminder'
   return <article className="thread-card" aria-label={'Reminder: '+name} key={item.id}>
    <div className="thread-context"><h2>{name}</h2><strong>{status[item.delivery]}</strong></div>
    {!item.unavailable&&<p className="message-body">{item.text}</p>}
    {item.unavailable&&<p className="muted">The source is no longer available. Its content is hidden.</p>}
    <p>{formatTime(item.next_due,{timeZone:item.zone})} · {item.zone} · {repeats[item.recurrence]}</p>
    <p className="dialog-note">Owner: {owner?'You':item.ownerName??'Former member'}{!item.schedule?' · Recipient: '+(recipient?'You':item.recipientName??'Former member'):''}</p>
    {item.reason&&<p className="warning" role="status">{item.reason}</p>}
    <div className="thread-actions">
     {!finished&&item.state!=='failed'&&(owner||recipient)&&<>
      <button className="soft-button" disabled={busy} onClick={()=>void act(item,'complete')}>Complete</button>
      <button className="soft-button" disabled={busy||item.unavailable} onClick={()=>void act(item,'snooze')}>Snooze 20 minutes</button>
     </>}
     {!finished&&owner&&<>
      <button className="soft-button" disabled={busy||item.unavailable} onClick={()=>setEditor({existing:item})}>Edit reminder</button>
      <button className="text-button" disabled={busy} onClick={()=>void act(item,'cancel')}>Cancel reminder</button>
     </>}
     {!item.unavailable&&item.source_kind==='message'&&item.source&&item.conversation&&<button className="text-button" onClick={()=>onOpen(item.conversation!,item.source!,null)}>Open source message</button>}
    </div>
   </article>
  })}
  {page?.hasMore&&<button className="soft-button" disabled={busy} onClick={()=>void more()}>More reminders</button>}
 </div>{editor&&<dialog ref={dialog} aria-labelledby={titleId} onKeyDown={containDialogFocus} onCancel={event=>{event.preventDefault();setEditor(null)}}>
  <div className="dialog-heading"><h2 id={titleId}>{editor.existing?'Edit reminder':'Create reminder'}</h2><button className="icon-button" aria-label="Close" onClick={()=>setEditor(null)}><IconClose/></button></div>
  <ReminderEditor existing={editor.existing} conversation={editor.existing?.conversation??undefined} privateSignal={privateSignal} onSaved={()=>{setEditor(null);void refresh().catch(onError)}}/>
 </dialog>}</section>
}
