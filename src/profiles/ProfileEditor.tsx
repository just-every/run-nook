import {useEffect,useRef,useState} from 'react'
import {api} from '../chat/api'
import {BroadcastAvailability} from '../broadcast/Availability'
import {StatusEditor} from './StatusEditor'
import {useProfileExpiry} from './useExpiry'
import type {ProfileResult,StatusInput} from './types'
import './profiles.css'

type Props={revision?:string|number;privateSignal?:AbortSignal;onSaved?:(result:ProfileResult)=>void}
function statusForm(result:ProfileResult):StatusInput{
 const status=result.profile.status
 if(!status?.expiresAt)return {emoji:status?.emoji??'',text:status?.text??'',clearAfter:'never'}
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:result.profile.zone,calendar:'gregory',numberingSystem:'latn',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(status.expiresAt).map(part=>[part.type,part.value]))
 return {emoji:status.emoji,text:status.text,clearAfter:'date',localAt:`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`}
}
export function ProfileEditor({revision,privateSignal,onSaved}:Props){
 const [record,setRecord]=useState<ProfileResult|null>(null),[name,setName]=useState(''),[zone,setZone]=useState('UTC'),[values,setValues]=useState<Record<string,string>>({}),[status,setStatus]=useState<StatusInput>({emoji:'',text:'',clearAfter:'never'})
 const [notice,setNotice]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[reload,setReload]=useState(0)
 const [presenceEnabled,setPresenceEnabled]=useState(true),[typingEnabled,setTypingEnabled]=useState(true)
 const dirty=useRef(false),statusDirty=useRef(false),formVersion=useRef(0),alive=useRef(true),generation=useRef(0)
 const apply=(result:ProfileResult)=>{
  setRecord(result);setPresenceEnabled(result.profile.presenceEnabled);setTypingEnabled(result.profile.typingEnabled);setName(result.profile.name);setZone(result.profile.zone);setValues(Object.fromEntries(result.profile.fields.map(field=>[field.id,field.value])));setStatus(statusForm(result));formVersion.current=result.profile.version;dirty.current=false;statusDirty.current=false
 }
 useEffect(()=>{
  alive.current=true
  const clear=()=>{alive.current=false;generation.current++;setRecord(null);setValues({});setName('');setStatus({emoji:'',text:'',clearAfter:'never'});setNotice('');setError('')}
  privateSignal?.addEventListener('abort',clear,{once:true})
  if(privateSignal?.aborted)clear()
  return()=>{alive.current=false;generation.current++;privateSignal?.removeEventListener('abort',clear)}
 },[privateSignal])
 useEffect(()=>{
  let active=true
  if(privateSignal?.aborted)return
  void api<ProfileResult>('profile').then(result=>{if(!active||!alive.current)return;if(dirty.current){setRecord(result);if(formVersion.current!==result.profile.version)setNotice('Your profile changed elsewhere. Reload your profile before saving.')}else apply(result)}).catch(cause=>{if(active&&alive.current)setError(cause.message)})
  return()=>{active=false}
 },[revision,privateSignal,reload])
 useProfileExpiry(record?.nextExpiry,record?.observedAt,()=>{
  setRecord(prior=>prior?{...prior,profile:{...prior.profile,status:null},nextExpiry:null}:null)
  if(!statusDirty.current)setStatus({emoji:'',text:'',clearAfter:'never'})
  setReload(value=>value+1)
 })
 const save=async(clear=false)=>{
  if(!record||busy)return
  const run=generation.current;setBusy(true);setError('');setNotice('')
  try{
   const result=await api<ProfileResult>('profile',clear?{status:null}:{name,zone,presenceEnabled,typingEnabled,fields:values,version:formVersion.current,...(statusDirty.current?{status}: {})})
   if(!alive.current||run!==generation.current)return
   if(clear&&dirty.current){setRecord(result);setStatus({emoji:'',text:'',clearAfter:'never'});statusDirty.current=false;formVersion.current=result.profile.version}else apply(result)
   setNotice(clear?'Status cleared.':'Profile saved.');onSaved?.(result)
  }catch(cause){if(alive.current&&run===generation.current)setError(cause instanceof Error?cause.message:'Could not save your profile')}finally{if(alive.current&&run===generation.current)setBusy(false)}
 }
 if(privateSignal?.aborted)return null
 return <section className="team-section profile-editor" aria-label="Your profile"><h3>Your profile</h3>{error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  {record?<><p className="dialog-note" aria-live="polite">{record.profile.status?<>{record.profile.status.emoji} {record.profile.status.text}{record.profile.status.expiresAt?` · Clears ${new Date(record.profile.status.expiresAt).toLocaleString(undefined,{timeZone:record.profile.zone})} (${record.profile.zone})`:''}</>:'No custom status'}</p>
   <form onSubmit={event=>{event.preventDefault();void save()}}><fieldset disabled={busy}><legend>Profile details</legend>
    <label className="field">Display name<input required value={name} maxLength={100} onChange={event=>{dirty.current=true;setName(event.target.value)}}/></label>
    <label className="field">Time zone<input required list="profile-time-zones" value={zone} maxLength={100} onChange={event=>{dirty.current=true;setZone(event.target.value)}}/><datalist id="profile-time-zones"><option value="UTC"/>{Intl.supportedValuesOf('timeZone').map(value=><option key={value} value={value}/>)}</datalist></label>
    {record.profile.fields.map(field=><label className="field" key={field.id}>{field.label}<input aria-label={field.label} type={field.type==='date'?'date':field.type==='phone'?'tel':'text'} value={values[field.id]??''} maxLength={500} onChange={event=>{dirty.current=true;setValues(prior=>({...prior,[field.id]:event.target.value}))}}/><small className="dialog-note">Visible to {field.visibility==='self'?'you only':field.visibility==='admins'?'you and workspace owners and admins':field.visibility==='shared-conversation'?'people sharing a conversation with you':'workspace members'}.</small></label>)}
   </fieldset><StatusEditor value={status} zone={zone} disabled={busy} onChange={next=>{dirty.current=true;statusDirty.current=true;setStatus(next)}} onClear={()=>void save(true)}/>
   <label className="check"><input type="checkbox" checked={presenceEnabled} onChange={e=>{dirty.current=true;setPresenceEnabled(e.target.checked)}}/>Share active presence</label><label className="check"><input type="checkbox" checked={typingEnabled} onChange={e=>{dirty.current=true;setTypingEnabled(e.target.checked)}}/>Show when I am typing</label><button className="soft-button" disabled={busy}>{busy?'Saving…':'Save profile'}</button><button className="soft-button" type="button" disabled={busy} onClick={()=>{dirty.current=false;statusDirty.current=false;setNotice('');setReload(value=>value+1)}}>Reload profile</button>
   </form><BroadcastAvailability/></>:<p role="status">Loading your profile…</p>}
 </section>
}
