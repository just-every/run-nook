import {useEffect,useState} from 'react'
import {api} from '../chat/api'
export function IgnoreBroadcasts({conversation,signal,onError}:{conversation:string;signal:AbortSignal;onError:(error:unknown)=>void}){
 const [ignore,setIgnore]=useState<boolean|null>(null),[busy,setBusy]=useState(false)
 useEffect(()=>{let active=true;void api<{ignore:boolean}>(`conversations/${conversation}/broadcast-ignore`).then(value=>{if(active&&!signal.aborted)setIgnore(value.ignore)}).catch(error=>{if(active&&!signal.aborted)onError(error)});return()=>{active=false}},[conversation,signal,onError])
 const change=async(value:boolean)=>{setBusy(true);try{const next=await api<{ignore:boolean}>(`conversations/${conversation}/broadcast-ignore`,{ignore:value},'PATCH');if(!signal.aborted)setIgnore(next.ignore)}catch(error){if(!signal.aborted)onError(error)}finally{if(!signal.aborted)setBusy(false)}}
 return <label className="check"><input type="checkbox" disabled={busy||ignore===null} checked={!!ignore} onChange={event=>void change(event.target.checked)}/>Ignore @channel, @here and @everyone</label>
}
