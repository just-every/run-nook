import {ScheduledBroadcast} from '../broadcast/ScheduledBroadcast'
import {useEffect,useId,useRef,useState} from 'react'
import type {FormEvent} from 'react'
import {api} from '../chat/api'
import {usePrivateScope} from '../chat/usePrivateScope'
import type {Reminder,ReminderPreview} from './types'
import '../app-style/dialogs.css'

type Props = {
 conversation?:string
 source?:string
 sourceKind?:'message'|'attachment'
 initialPhrase?:string
 existing?:Reminder
 privateSignal:AbortSignal
 onSaved:()=>void
}

const repeats = {none:'Once',daily:'Every day',weekdays:'Every weekday',weekly:'Every week',monthly:'Every month'}

function existingPhrase(item:Reminder){
 const target=item.schedule?'#'+item.conversation:item.recipient===item.user?'me':'@'+item.recipient
 const [date,time]=item.local_at.split('T'),[year,,day]=date.split('-')
 const instant=new Date(date+'T00:00:00Z')
 const when=item.recurrence==='daily'?'every day':item.recurrence==='weekdays'?'every weekday':item.recurrence==='weekly'
  ?'every '+instant.toLocaleDateString('en-US',{weekday:'long',timeZone:'UTC'})
  :item.recurrence==='monthly'?'every month on the '+Number(day)
  :'on '+instant.toLocaleDateString('en-US',{month:'long',timeZone:'UTC'})+' '+Number(day)+' '+year
 const text='"'+item.text.replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"'
 return '/remind '+target+' '+text+' '+when+' at '+time.slice(0,5)
}

export function ReminderEditor({conversation,source,sourceKind,initialPhrase,existing,privateSignal,onSaved}:Props){
 const [phrase,setPhrase]=useState(initialPhrase??(existing?existingPhrase(existing):'')),[zone,setZone]=useState(existing?.zone??Intl.DateTimeFormat().resolvedOptions().timeZone)
 const [preview,setPreview]=useState<ReminderPreview|null>(null),[busy,setBusy]=useState<'preview'|'save'|null>(null),[error,setError]=useState('')
 const [confirmBroadcast,setConfirmBroadcast]=useState(false)
 const [members,setMembers]=useState<{id:string;name:string}[]>([])
 const intent=useRef(crypto.randomUUID()),request=useRef(0),fieldId=useId()
 const current=usePrivateScope(privateSignal,'reminder-editor:'+(existing?.id??source??conversation??'personal'))
 useEffect(()=>{if(!conversation||source)return;let cancelled=false;void api<{id:string;name:string}[]>('conversations/'+conversation+'/members').then(rows=>{if(!cancelled&&current())setMembers(rows)}).catch(()=>{if(!cancelled&&current())setError('Could not load conversation participants. Reopen the reminder to try again.')});return()=>{cancelled=true}},[conversation,source,current])
 const clearPreview=()=>{request.current++;setPreview(null);setError('')}
 const inspect=async(event:FormEvent)=>{
  event.preventDefault()
  if(!current()||busy)return
  const sequence=++request.current
  setBusy('preview');setPreview(null);setError('')
  try{
   const value=await api<ReminderPreview>('reminders/preview',{phrase,zone,...(conversation?{conversation}:{})})
   if(current()&&request.current===sequence)setPreview(value)
  }catch(e){if(current()&&request.current===sequence)setError(e instanceof Error?e.message:'The reminder could not be understood. Change the phrase and preview again.')}
  finally{if(current())setBusy(null)}
 }
 const save=async()=>{
  if(!current()||!preview||busy)return
  setBusy('save');setError('')
  try{
   const definition={phrase,zone,confirmedDue:preview.due,confirmBroadcast,...(conversation?{conversation}:{})}
   await api(existing?'reminders/'+encodeURIComponent(existing.id):'reminders',existing
    ?{...definition,action:'edit',version:existing.version}
    :{...definition,intent:intent.current,...(source?{source,sourceKind:sourceKind??'message'}:{})},existing?'PATCH':'POST')
   if(current())onSaved()
  }catch(e){if(current())setError(e instanceof Error?e.message:'Saving was not confirmed. Check Reminders before creating another.')}
  finally{if(current())setBusy(null)}
 }
 return <form onSubmit={event=>void inspect(event)}>
  {existing&&<div className="schedule-preview"><h3>Current reminder</h3><p className="message-body">{existing.text}</p><p>{existing.local_at.replace('T',' ')} · {existing.zone} · {repeats[existing.recurrence]}</p><p className="dialog-note">Enter the complete updated reminder below, including its target and time.</p></div>}
  {source&&<p className="dialog-note">This reminder links to the {sourceKind==='attachment'?'file':'message'}. Write your own reminder text below. Source content is not copied, and access is checked again when the reminder is due.</p>}
  {!!members.length&&!existing&&!source&&<label className="field">Choose a participant<select defaultValue="" disabled={!!busy} onChange={event=>{if(!event.target.value)return;clearPreview();setPhrase(value=>/^(\/remind\s+)?(?:me|[@#][^\s]+)\s*/i.test(value)?value.replace(/^(\/remind\s+)?(?:me|[@#][^\s]+)\s*/i,'/remind @'+event.target.value+' '):'/remind @'+event.target.value+' '+value)}}><option value="">Keep the target in your phrase</option>{members.map(person=><option key={person.id} value={person.id}>{person.name}</option>)}</select></label>}
  <div className="field"><label htmlFor={fieldId+'-phrase'}>Reminder</label><textarea id={fieldId+'-phrase'} name="phrase" value={phrase} onChange={event=>{clearPreview();setPhrase(event.target.value)}} placeholder={'/remind me in 20 minutes to call Ana'} required readOnly={!!busy} rows={4} aria-describedby={fieldId+'-help'} autoFocus/></div>
  <p className="dialog-note" id={fieldId+'-help'}>Use me, @person or #channel, a time, and your reminder text. For example: /remind #standup "Post your update" every weekday at 9am. Date-only reminders use 9am. Changing the phrase or time zone clears the preview.</p>
  <label className="field">Time zone<input name="zone" value={zone} onChange={event=>{clearPreview();setZone(event.target.value)}} required readOnly={!!busy} placeholder="Australia/Brisbane"/></label>
  <button className="soft-button" type="submit" disabled={!!busy||!phrase.trim()||!zone.trim()}>{busy==='preview'?'Checking…':'Preview reminder'}</button>
  {preview&&<div className="schedule-preview" aria-label="Reminder preview" role="status">
   <h3>Review reminder</h3>
   <p className="message-body">{preview.text}</p>
   <p>Target: {preview.target==='me'?'Me':preview.audience}</p>
   <p>Audience: {preview.audience}</p>
   <p>Due: {new Date(preview.due).toLocaleString('en-US',{timeZone:preview.zone,dateStyle:'medium',timeStyle:'short'})} · {preview.zone}</p>
   <p>Local time: {preview.localAt.replace('T',' ')} · {repeats[preview.recurrence]}</p>
   <button className="text-button" type="button" disabled={!!busy} onClick={clearPreview}>Clear preview</button>
  </div>}
  {preview?.broadcast&&preview.conversation&&<ScheduledBroadcast conversation={preview.conversation} body={'Reminder: '+preview.text} confirmed={confirmBroadcast} onConfirm={setConfirmBroadcast} signal={privateSignal}/>}
  <p className="dialog-note">Nothing is saved until you confirm the preview. Reminder completion is independent of message reads and commitments. The current audience and permission are checked again at delivery.</p>
  {error&&<p role="alert" className="warning">{error}</p>}
  {preview&&<button className="send" type="button" disabled={!!busy} onClick={()=>void save()}>{busy==='save'?'Saving…':existing?'Confirm reminder changes':'Confirm reminder'}</button>}
 </form>
}
