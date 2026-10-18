import {useEffect,useState} from 'react'
import {api} from '../chat/api'
export function BroadcastAvailability(){
 const [away,setAway]=useState<boolean|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 useEffect(()=>{let active=true;void api<{away:boolean}>('broadcast/presence').then(value=>{if(active)setAway(value.away)}).catch(error=>{if(active)setError(error.message)});return()=>{active=false}},[])
 const change=async(value:boolean)=>{setBusy(true);setError('');try{const next=await api<{away:boolean}>('broadcast/presence',{page:'availability-setting',visible:false,zone:Intl.DateTimeFormat().resolvedOptions().timeZone,away:value});setAway(next.away)}catch(error){setError(error instanceof Error?error.message:'Could not change availability')}finally{setBusy(false)}}
 return <section className="team-notifications"><strong>Availability</strong><label className="check"><input type="checkbox" checked={!!away} disabled={away===null||busy} onChange={event=>void change(event.target.checked)}/>Set yourself away for @here</label><p>@here uses a foreground heartbeat from the last ten minutes and your away choice. Broadcasts respect quiet time.</p>{error&&<p role="alert">{error}</p>}</section>
}
