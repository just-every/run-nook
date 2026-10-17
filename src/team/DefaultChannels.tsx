import {useEffect,useState} from 'react'
import type {TeamRequest} from './types'
import './default-channels.css'

type Policy={version:number;canChangeMandatory:boolean;channels:{id:string;name:string;enabled:number;mandatory:number}[];history:{id:string;version:number;conversation:string;name:string;enabled:number;mandatory:number;actorName:string|null;created:string}[]}
export function DefaultChannels({request}:{request:TeamRequest}){
 const [policy,setPolicy]=useState<Policy|null>(null),[selected,setSelected]=useState<Record<string,boolean>>({}),[busy,setBusy]=useState(false),[notice,setNotice]=useState('')
 const adopt=(next:Policy)=>{setPolicy(next);setSelected(Object.fromEntries(next.channels.filter(channel=>channel.enabled).map(channel=>[channel.id,!!channel.mandatory])))}
 useEffect(()=>{const controller=new AbortController();request<Policy>('/api/team/default-channels',{signal:controller.signal}).then(adopt).catch(error=>{if(!controller.signal.aborted)setNotice(error.message)});return()=>controller.abort()},[request])
 async function save(event:React.FormEvent){
  event.preventDefault();if(!policy||busy)return
  setBusy(true);setNotice('')
  try{adopt(await request<Policy>('/api/team/default-channels',{method:'PATCH',body:JSON.stringify({version:policy.version,channels:Object.entries(selected).map(([id,mandatory])=>({id,mandatory}))})}));setNotice('Default channels saved.')}
  catch(error){setNotice((error as Error).message)}finally{setBusy(false)}
 }
 const reload=async()=>{setBusy(true);try{adopt(await request<Policy>('/api/team/default-channels'));setNotice('Latest default channels loaded.')}catch(error){setNotice((error as Error).message)}finally{setBusy(false)}}
 return <div className="team-section default-channels"><h2>Default channels</h2>
  <p className="team-lead">New workspace members join these public channels on their first workspace visit and can read their full history. Guests keep their selected access. Existing, reactivated and recovered accounts keep their existing or explicitly restored channels.</p>
  <p className="team-lead">Only an owner can make a default mandatory. Members cannot leave a mandatory channel. Remove a channel from this list before archiving it.</p>
  {notice&&<p className="team-status" role="status">{notice}</p>}
  {!policy?<p>Loading default channels…</p>:<>
   <form onSubmit={event=>void save(event)}><fieldset disabled={busy}><legend>Public channels for new members</legend>
    {policy.channels.map(channel=><div className="default-channel-choice" key={channel.id}>
     <label><input type="checkbox" checked={Object.hasOwn(selected,channel.id)} disabled={!policy.canChangeMandatory&&!!channel.mandatory} onChange={event=>setSelected(previous=>{const next={...previous};if(event.target.checked)next[channel.id]=false;else delete next[channel.id];return next})}/><span>#{channel.name}</span></label>
     {Object.hasOwn(selected,channel.id)&&<label><input type="checkbox" checked={selected[channel.id]} disabled={!policy.canChangeMandatory} onChange={event=>setSelected(previous=>({...previous,[channel.id]:event.target.checked}))}/>Mandatory</label>}
    </div>)}
    {!policy.channels.length&&<p className="team-lead">Create an active public channel to choose a default.</p>}
   </fieldset><div className="team-invite-actions"><button className="send" disabled={busy}>Save default channels</button><button type="button" className="soft-button" disabled={busy} onClick={()=>void reload()}>Reload defaults</button></div></form>
   <details className="team-about"><summary>Default-channel history</summary><ul className="default-channel-history">{policy.history.map(action=><li key={action.id}><strong>#{action.name}</strong> — {action.enabled?action.mandatory?'Mandatory default':'Default for new members':'Removed from defaults'}<small>{action.actorName??'Former member'} · {new Date(action.created).toLocaleString()}</small></li>)}</ul>{!policy.history.length&&<p>No default-channel changes yet.</p>}</details>
  </>}
 </div>
}
