import {TooltipButton} from '../chat/TooltipButton'
import './channel-browser.css'
import {useEffect,useRef,useState} from 'react'
import type {TeamRequest} from './types'
type Page={items:{id:string;name:string;description?:string;archived?:number}[];cursor:string|null}
export function ChannelBrowser({request,initial,onJoined}:{request:TeamRequest;initial?:Page|null;onJoined:(id:string)=>void}){
 const initialized=useRef(false)
 const [query,setQuery]=useState(''),[search,setSearch]=useState('')
 const [page,setPage]=useState<Page>({items:[],cursor:null}),[error,setError]=useState(''),[busy,setBusy]=useState(true)
 useEffect(()=>{if(initial&&!initialized.current){initialized.current=true;setPage(initial);setBusy(false)}},[initial])
 async function join(id:string){setBusy(true);try{await request(`/api/channels/${encodeURIComponent(id)}/join`,{method:'POST',body:'{}'});onJoined(id)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 async function find(){setBusy(true);setError('');try{const next=await request<Page>(`/api/channels?q=${encodeURIComponent(query)}`);setPage(next);setSearch(query)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 async function more(){setBusy(true);try{const next=await request<Page>(`/api/channels?after=${encodeURIComponent(page.cursor!)}&q=${encodeURIComponent(search)}`);setPage({items:[...page.items,...next.items],cursor:next.cursor})}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <section className="team-surface team-channels"><h2>Browse public channels</h2><form onSubmit={e=>{e.preventDefault();void find()}}><label>Find public channels<input value={query} onChange={e=>setQuery(e.target.value)} maxLength={200}/></label><button className="soft-button" disabled={busy}>Search channels</button></form>{error&&<p className="team-status" role="alert">{error}</p>}<ul className="team-channel-list">{page.items.map(c=><li key={c.id}><span className="team-channel-name"><span className="team-hash" aria-hidden="true">#</span>{c.name}{c.description&&<small className="dialog-note channel-browser-description">{c.description}</small>}{!!c.archived&&<small className="dialog-note"> · Archived · Read-only history</small>}</span><button className="soft-button" disabled={busy} onClick={()=>void join(c.id)}>{c.archived?'Join history':'Join with full history'}</button></li>)}</ul>{!busy&&!error&&!page.items.length&&<p className="team-lead">{search?'No public channels match this search.':'You have joined every public channel.'}</p>}{page.cursor&&<TooltipButton label="More channels" className="soft-button" disabled={busy} onClick={()=>void more()}>More channels</TooltipButton>}</section>
}
