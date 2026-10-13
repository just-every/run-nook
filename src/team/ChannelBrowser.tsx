import {useEffect,useState} from 'react'
import type {TeamRequest} from './types'
type Page={items:{id:string;name:string}[];cursor:string|null}
export function ChannelBrowser({request,onJoined}:{request:TeamRequest;onJoined:(id:string)=>void}){
 const [page,setPage]=useState<Page>({items:[],cursor:null}),[error,setError]=useState(''),[busy,setBusy]=useState(true)
 useEffect(()=>{const controller=new AbortController();request<Page>('/api/channels',{signal:controller.signal}).then(setPage).catch(e=>{if(!controller.signal.aborted)setError(e.message)}).finally(()=>{if(!controller.signal.aborted)setBusy(false)});return()=>controller.abort()},[request])
 async function join(id:string){setBusy(true);try{await request(`/api/channels/${encodeURIComponent(id)}/join`,{method:'POST',body:'{}'});onJoined(id)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 async function more(){setBusy(true);try{const next=await request<Page>(`/api/channels?after=${encodeURIComponent(page.cursor!)}`);setPage({items:[...page.items,...next.items],cursor:next.cursor})}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <section className="team-surface team-channels"><h2>Browse public channels</h2><p className="team-lead">Joining gives you access to the channel’s full history.</p>{error&&<p className="team-status" role="alert">{error}</p>}<ul className="team-channel-list">{page.items.map(c=><li key={c.id}><span className="team-channel-name"><span className="team-hash" aria-hidden="true">#</span>{c.name}</span><button className="soft-button" disabled={busy} onClick={()=>void join(c.id)}>Join channel</button></li>)}</ul>{!busy&&!error&&!page.items.length&&<p className="team-lead">You have joined every public channel.</p>}{page.cursor&&<button className="soft-button" disabled={busy} onClick={()=>void more()}>More channels</button>}</section>
}
