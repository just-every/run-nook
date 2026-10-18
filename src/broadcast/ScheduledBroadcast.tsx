import {useEffect,useState} from 'react'
import {api} from '../chat/api'
import type {BroadcastPreview} from './ConfirmBroadcast'
export function ScheduledBroadcast({conversation,body,confirmed,onConfirm,signal}:{conversation:string;body:string;confirmed:boolean;onConfirm:(value:boolean)=>void;signal:AbortSignal}){
 const [preview,setPreview]=useState<BroadcastPreview|null>(null),[error,setError]=useState('')
 useEffect(()=>{let cancelled=false;onConfirm(false);setPreview(null);setError('');void api<BroadcastPreview|null>(`conversations/${conversation}/broadcast-preview`,{body}).then(value=>{if(!cancelled&&!signal.aborted)setPreview(value)}).catch(e=>{if(!cancelled&&!signal.aborted)setError(e.message)});return()=>{cancelled=true}},[conversation,body,signal])
 return <>{preview&&<div className="schedule-preview"><p>@{preview.kind}: currently {preview.recipients} recipients; {preview.quiet} in quiet time; {preview.otherZones} in other time zones.</p><label className="check"><input type="checkbox" checked={confirmed} onChange={event=>onConfirm(event.target.checked)}/>Allow this broadcast at each scheduled occurrence</label><p className="dialog-note">The audience, broadcast policy and posting permission are checked again when it sends. A policy change stops the occurrence with a visible failure.</p></div>}{error&&<p className="warning" role="alert">{error}</p>}</>
}
