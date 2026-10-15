import {memberErasureDescriptionFor,priorDeletionScope} from './policy'
import {useEffect,useState} from 'react'
import type {TeamRequest} from '../types'
type Pending={id:string;kind:string;counts:Record<string,number>;memberMessageBodies:'erase'|'retain';state:string}
export function PendingErasures({request}:{request:TeamRequest}){
 const [rows,setRows]=useState<Pending[]>([]),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false)
 useEffect(()=>{const controller=new AbortController();request<Pending[]>('/api/erasures',{signal:controller.signal}).then(setRows).catch(e=>{if(!controller.signal.aborted)setNotice(e.message)});return()=>controller.abort()},[request])
 async function resume(id:string){setBusy(true);try{const r=await request<Pending>(`/api/erasures/${id}/resume`,{method:'POST',body:'{}'});setNotice(`Erasure ${r.state}. Receipt ${r.id}. ${r.kind==='member'?memberErasureDescriptionFor(r.memberMessageBodies):''}`);setRows(await request<Pending[]>('/api/erasures'))}catch(e){setNotice((e as Error).message)}finally{setBusy(false)}}
 if(!rows.length&&!notice)return null
 return <section><h3>Pending erasures</h3><p>Deletion continues in the background while the person who started it is signed in and still has permission. If it stops, choose Resume erasure to continue using your account.</p>{rows.map(r=><div key={r.id}><p>{r.kind}: {Object.entries(r.counts).map(([key,n])=>`${n} ${key}`).join(', ')}. Receipt <code>{r.id}</code></p>{r.kind==='member'&&<p>{memberErasureDescriptionFor(r.memberMessageBodies)} {priorDeletionScope}</p>}<button className="soft-button" disabled={busy} onClick={()=>void resume(r.id)}>Resume erasure</button></div>)}{notice&&<p role="status">{notice}</p>}</section>
}
