import {useEffect,useRef,useState} from 'react'
import {api} from '../chat/api'
import type {FieldResult,ProfileField} from './types'
import './profiles.css'

type Props={revision?:string|number;privateSignal?:AbortSignal;onSaved?:()=>void}
type Draft=Pick<ProfileField,'id'|'label'|'type'|'visibility'|'version'>
const blank=():Draft=>({id:'',label:'',type:'text',visibility:'members',version:0})
const visibilityLabels={members:'Workspace members','shared-conversation':'People sharing a conversation',admins:'Owners and admins',self:'The profile owner only'}
export function ProfileFieldSettings({revision,privateSignal,onSaved}:Props){
 const [result,setResult]=useState<FieldResult|null>(null),[draft,setDraft]=useState<Draft|null>(null),[saveState,setSaveState]=useState<'idle'|'saving'|'saved'>('idle'),[notice,setNotice]=useState(''),[error,setError]=useState('')
 const busy=saveState==='saving'
 const alive=useRef(true),generation=useRef(0),fieldReads=useRef(0),writes=useRef(0),pending=useRef(false),interrupted=useRef(false)
 useEffect(()=>{
  alive.current=true
  const clear=()=>{if(pending.current)interrupted.current=true;alive.current=false;generation.current++;fieldReads.current++;setResult(null);setDraft(null);setError('');setNotice('');setSaveState(pending.current?'saving':'idle')}
  privateSignal?.addEventListener('abort',clear,{once:true});if(privateSignal?.aborted)clear()
  return()=>{if(pending.current)interrupted.current=true;alive.current=false;generation.current++;fieldReads.current++;privateSignal?.removeEventListener('abort',clear)}
 },[privateSignal])
 useEffect(()=>{
  let active=true
  const read=++fieldReads.current
  if(privateSignal?.aborted)return
  void api<FieldResult>('profile/fields').then(value=>{if(active&&alive.current&&read===fieldReads.current){setResult(value);if(interrupted.current){setNotice(pending.current?'Profile fields changed while saving. Waiting for the result.':'Profile fields changed while saving. The list was reloaded.');if(!pending.current){interrupted.current=false;setSaveState(state=>state==='saving'?'idle':state)}}}}).catch(cause=>{if(active&&alive.current&&read===fieldReads.current)setError(cause.message)})
  return()=>{active=false}
 },[revision,privateSignal])
 const save=async(remove=false)=>{
  if(!draft||busy)return
  // A read started before or during this write must not replace its result.
  // Workspace hints can otherwise deliver an older list after the save succeeds.
  fieldReads.current++
  const run=generation.current,write=++writes.current;pending.current=true;setSaveState('saving');setError('');setNotice('')
  try{
   const next=await api<FieldResult>('profile/fields',remove?{id:draft.id,version:draft.version,remove:true}:draft)
   if(write!==writes.current)return
   if(!alive.current){interrupted.current=true;return}
   if(run!==generation.current){
    // Never adopt a completed response from a retired private scope. Re-read
    // through the current session, then explain why this is not a save receipt.
    while(alive.current&&write===writes.current){
     const scope=generation.current;fieldReads.current++
     const refreshed=await api<FieldResult>('profile/fields')
     if(scope!==generation.current)continue
     if(alive.current){fieldReads.current++;setResult(refreshed);setDraft(null);interrupted.current=false;setNotice('Profile fields changed while saving. The list was reloaded.');setSaveState('idle')}
     break
    }
    return
   }
   fieldReads.current++
   setResult(next);setDraft(null);setNotice(remove?'Profile field and its values removed.':'Profile field saved.');setSaveState('saved');onSaved?.()
  }catch(cause){if(alive.current&&write===writes.current){interrupted.current=false;setNotice('');setError(cause instanceof Error?cause.message:'Could not save the profile field')}}finally{if(write===writes.current){pending.current=false;if(alive.current)setSaveState(state=>state==='saving'?'idle':state)}}
 }
 if(privateSignal?.aborted||result&&!result.canManage)return null
 return <section className="team-section profile-field-settings" aria-label="Profile fields" aria-busy={busy} data-save={saveState}><h3>Profile fields</h3>
  <p className="dialog-note">Members fill in their own fields. Field visibility controls both the directory and search. Removing a field erases all of its values.</p>
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  {result?<><ul className="team-people">{result.fields.map(field=><li key={field.id}><div className="team-person"><strong>{field.label}</strong><small>{visibilityLabels[field.visibility]}</small></div><button className="soft-button" disabled={busy} onClick={()=>{setDraft({id:field.id,label:field.label,type:field.type,visibility:field.visibility,version:field.version});setNotice('');setError('');setSaveState('idle')}}>Edit {field.label}</button></li>)}</ul>
   {!draft&&<button className="soft-button" disabled={busy} onClick={()=>{setDraft(blank());setNotice('');setSaveState('idle')}}>Add profile field</button>}
   {draft&&<form onSubmit={event=>{event.preventDefault();void save()}}><fieldset disabled={busy}><legend>{draft.version?'Edit profile field':'Add profile field'}</legend>
    <label className="field">Field ID<input required disabled={draft.version>0} pattern="[a-z][a-z0-9-]*" maxLength={64} value={draft.id} placeholder="department" onChange={event=>setDraft({...draft,id:event.target.value})}/></label>
    <label className="field">Field label<input required maxLength={80} value={draft.label} onChange={event=>setDraft({...draft,label:event.target.value})}/></label>
    <label className="field">Type<select aria-label="Type" value={draft.type} onChange={event=>setDraft({...draft,type:event.target.value as Draft['type']})}><option value="text">Text</option><option value="phone">Phone</option><option value="date">Date</option></select></label>
    <label className="field">Visible to<select aria-label="Visible to" value={draft.visibility} onChange={event=>setDraft({...draft,visibility:event.target.value as Draft['visibility']})}>{Object.entries(visibilityLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    <button className="soft-button" disabled={busy}>{busy?'Saving…':'Save field'}</button><button className="soft-button" type="button" onClick={()=>setDraft(null)}>Cancel</button>
    {draft.version>0&&<details><summary>Remove this field</summary><p className="dialog-note">All members’ values for {draft.label} will be erased.</p><button className="soft-button" type="button" onClick={()=>void save(true)}>Remove field and values</button></details>}
   </fieldset></form>}
  </>:<p role="status">Loading profile fields…</p>}
 </section>
}
export {ProfileFieldSettings as FieldSettings}
