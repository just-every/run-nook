import {useState} from 'react'
import {api} from '../chat/api'
export type BroadcastSummary={kind:string;recipients:number;quiet:number;otherZones:number}
export function BroadcastRecipients({message,broadcast}:{message:string;broadcast:BroadcastSummary}){
 const [people,setPeople]=useState<{id:string;name:string}[]>([]),[more,setMore]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 const load=async()=>{if(busy)return;setBusy(true);try{const page=await api<{items:{id:string;name:string}[];hasMore:boolean}>(`messages/${message}/broadcast-recipients?after=${encodeURIComponent(people.at(-1)?.id??'')}`);setPeople([...people,...page.items]);setMore(page.hasMore)}catch(error){setError(error instanceof Error?error.message:'Recipients unavailable')}finally{setBusy(false)}}
 return <details className="message-routing" onToggle={event=>{if(event.currentTarget.open&&!people.length&&more)void load()}}><summary>@{broadcast.kind} · {broadcast.recipients} recipients</summary><p>{broadcast.quiet} in quiet time · {broadcast.otherZones} in other time zones at send time</p><p>{people.map(p=>p.name).join(', ')}</p>{error&&<p role="alert">{error}</p>}{more&&<button type="button" className="text-button" disabled={busy} onClick={()=>void load()}>{busy?'Loading…':'Show more recipients'}</button>}</details>
}
