import {useEffect,useState} from 'react'
import {useTeamBindings} from '../team/TeamBindings'
import type {Message} from './types'

type CollectionState={savedId:string|null;pinned:boolean;canPin:boolean}
export function CollectionActions({message}:{message:Message}){
 const team=useTeamBindings(),[state,setState]=useState<CollectionState|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('')
 useEffect(()=>{let cancelled=false;setState(null);void team.request<CollectionState>(`/api/messages/${message.id}/collections`).then(value=>{if(!cancelled)setState(value)}).catch(()=>{if(!cancelled)setError('Could not load saved and pinned state.')});return()=>{cancelled=true}},[message.id,team.request,team.accessEpoch])
 const run=async(action:()=>Promise<void>)=>{setBusy(true);setError('');try{await action()}catch{setError('Could not update this item. Please try again.')}finally{setBusy(false)}}
 if(!state)return <span role="status">{error||'Loading actions…'}</span>
 return <><button type="button" onClick={()=>team.onReminder?.(message.id,'message')}>Remind me</button><button type="button" disabled={busy} onClick={()=>void run(async()=>{if(state.savedId){await team.request(`/api/saved/${state.savedId}`,{method:'DELETE',body:'{}'});setState({...state,savedId:null})}else{const item=await team.request<{id:string}>('/api/saved',{method:'POST',body:JSON.stringify({conversation:message.conversation,message:message.id})});setState({...state,savedId:item.id})}})}>{state.savedId?'Remove from Saved':'Save for later'}</button>{state.canPin&&<button type="button" disabled={busy} onClick={()=>void run(async()=>{await team.request(`/api/conversations/${message.conversation}/pins`,{method:'POST',body:JSON.stringify({message:message.id,pinned:!state.pinned})});setState({...state,pinned:!state.pinned})})}>{state.pinned?'Unpin from channel':'Pin to channel'}</button>}{error&&<span role="alert">{error}</span>}</>
}

export function SaveFileAction({conversation,attachment}:{conversation:string;attachment:string}){
 const team=useTeamBindings(),[saved,setSaved]=useState(false),[busy,setBusy]=useState(false)
 return <><button type="button" className="text-button reveal" onClick={()=>team.onReminder?.(attachment,'attachment')}>Remind me about file</button><button type="button" className="text-button reveal" disabled={busy||saved} onClick={()=>{setBusy(true);void team.request('/api/saved',{method:'POST',body:JSON.stringify({conversation,attachment})}).then(()=>setSaved(true)).catch(()=>{}).finally(()=>setBusy(false))}}>{saved?'File saved':'Save file'}</button></>
}
