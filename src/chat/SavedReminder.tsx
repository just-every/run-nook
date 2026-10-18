import {useEffect,useId,useRef,useState} from 'react'
import {api} from './api'

export type SavedReminderState={due:number;timeZone:string;state:'pending'|'ready'|'done'|'cancelled';reason:string|null}
type Props={id:string;reminder:SavedReminderState|null;disabled?:boolean;current:()=>boolean;onChanged:()=>void;onError:(error:unknown)=>void}

function localDateTime(due:number){
 const date=new Date(due),pad=(value:number)=>String(value).padStart(2,'0')
 return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function SavedReminder({id,reminder,disabled=false,current,onChanged,onError}:Props){
 const fieldId=useId(),[editing,setEditing]=useState(false),[date,setDate]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const [timeZone]=useState(()=>Intl.DateTimeFormat().resolvedOptions().timeZone)
 const generation=useRef(0),inFlight=useRef(false)
 useEffect(()=>{
  generation.current++;inFlight.current=false;setEditing(false);setDate('');setBusy(false);setError('')
  return()=>{generation.current++}
 },[id])
 const activeReminder=reminder?.state==='pending'||reminder?.state==='ready'
 const locked=disabled||busy
 const change=async(due:number|null)=>{
  if(disabled||inFlight.current||!current())return
  const epoch=generation.current,active=()=>current()&&generation.current===epoch
  inFlight.current=true;setBusy(true);setError('')
  try{
   await api('saved/'+encodeURIComponent(id),{due,timeZone:due===null?reminder!.timeZone:timeZone},'PATCH')
   if(active()){setEditing(false);onChanged()}
  }catch(reason){if(active()){setError(reason instanceof Error?reason.message:'The reminder could not be updated.');onError(reason)}}
  finally{if(generation.current===epoch){inFlight.current=false;if(current())setBusy(false)}}
 }
 const startEditing=()=>{
  if(locked||!current())return
  setDate(reminder&&reminder.due>Date.now()?localDateTime(reminder.due):'');setError('');setEditing(true)
 }
 const save=(event:React.FormEvent<HTMLFormElement>)=>{
  event.preventDefault();if(locked||!current())return
  const due=new Date(date).getTime()
  // Native local parsing uses the browser zone shown below; reject DST gaps
  // rather than silently scheduling a different wall-clock time.
  if(!Number.isFinite(due)||localDateTime(due)!==date){setError('Choose a valid date and time in '+timeZone+'.');return}
  if(due<=Date.now()){setError('Choose a future date and time.');return}
  void change(due)
 }
 return <div className="saved-reminder" style={{minWidth:0,maxWidth:'100%'}}>
  {reminder&&<p className="collection-meta" role="status">
   {reminder.state==='pending'&&<>Reminder: <time dateTime={new Date(reminder.due).toISOString()}>{new Date(reminder.due).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short',timeZone:reminder.timeZone})}</time> · {reminder.timeZone}</>}
   {reminder.state==='ready'&&'Reminder due'}
   {reminder.state==='done'&&'Reminder done'}
   {reminder.state==='cancelled'&&'Reminder cancelled'}
   {reminder.reason&&<> · The source was unavailable when this reminder was due.</>}
  </p>}
  {editing?<form onSubmit={save} style={{maxWidth:360,minWidth:0}}>
   <label className="field" htmlFor={fieldId}>Remind me at
    <input id={fieldId} type="datetime-local" required step={60} value={date} disabled={locked} aria-invalid={!!error} aria-describedby={fieldId+'-zone'+(error?' '+fieldId+'-error':'')} onChange={event=>{setDate(event.target.value);setError('')}} style={{boxSizing:'border-box',maxWidth:'100%'}}/>
   </label>
   <p className="collection-meta" id={fieldId+'-zone'}>Time zone: {timeZone}</p>
   <div className="collection-actions" style={{marginLeft:0}}>
    <button type="submit" className="soft-button" disabled={locked}>{busy?'Saving…':'Save reminder'}</button>
    <button type="button" className="text-button" disabled={busy} onClick={()=>{setEditing(false);setError('')}}>Cancel edit</button>
   </div>
  </form>:<div className="collection-actions" style={{marginLeft:0}}>
   <button type="button" className="soft-button" disabled={locked} onClick={startEditing}>{activeReminder?'Edit reminder':'Remind me'}</button>
   {activeReminder&&<button type="button" className="text-button" disabled={locked} onClick={()=>void change(null)}>{busy?'Cancelling…':'Cancel reminder'}</button>}
  </div>}
  {error&&<p className="warning" id={fieldId+'-error'} role="alert">{error}</p>}
 </div>
}
