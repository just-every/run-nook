import {useEffect,useState} from 'react'
import {api} from '../chat/api'
import {useTeamBindings} from './TeamBindings'
import './polls.css'
type Option={position:number;label:string;count:number;voters?:{id:string;name:string}[]}
type Poll={message:string;multiple:boolean;anonymous:boolean;closes:number|null;closedAt:number|null;open:boolean;voters:number;options:Option[];mine:number[];canClose:boolean}
const when=(stamp:number)=>new Date(stamp).toLocaleString([],{dateStyle:'medium',timeStyle:'short'})
// Counts reload with every workspace refresh, so they follow the conversation's live update. A vote is a count, never a decision or commitment.
export function PollCard({message,question}:{message:string;question:string}){
 const team=useTeamBindings(),[poll,setPoll]=useState<Poll|null>(null),[picked,setPicked]=useState<number[]|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('')
 useEffect(()=>{let live=true;void api<Poll>(`polls/${message}`).then(next=>{if(live){setPoll(next);setError('')}}).catch(e=>{if(live)setError(e instanceof Error?e.message:'Poll unavailable')});return()=>{live=false}},[message,team.revision,team.accessEpoch])
 if(!poll)return error?<p className="warning" role="alert">{error}</p>:<p className="muted">Loading poll…</p>
 const selected=picked??poll.mine,total=Math.max(1,...poll.options.map(o=>o.count)),changed=picked!==null&&picked.join()!==poll.mine.join()
 const toggle=(position:number)=>setPicked(poll.multiple?(selected.includes(position)?selected.filter(p=>p!==position):[...selected,position].sort((a,b)=>a-b)):[position])
 const send=async(path:string,body:unknown)=>{if(busy)return;setBusy(true);setError('');try{setPoll(await api<Poll>(`polls/${message}/${path}`,body));setPicked(null)}catch(e){setError(e instanceof Error?e.message:'Please try again.')}finally{setBusy(false)}}
 return <section className="poll-card" aria-label={'Poll: '+question} data-poll={message} data-open={poll.open?'true':'false'}>
  <fieldset disabled={!poll.open||busy}>
   <legend className="sr-only">{poll.multiple?'Choose one or more options':'Choose one option'}</legend>
   {poll.options.map(o=><label className="poll-option" key={o.position}>
    <input type={poll.multiple?'checkbox':'radio'} name={'poll-'+message} checked={selected.includes(o.position)} onChange={()=>toggle(o.position)}/>
    <span className="poll-label">{o.label}</span><span className="poll-count" aria-label={o.count+(o.count===1?' vote':' votes')}>{o.count}</span>
    <span className="poll-bar" aria-hidden="true"><span style={{width:Math.round(o.count*100/total)+'%'}}/></span>
    {!!o.voters?.length&&<small className="poll-voters">{o.voters.map(v=>v.name).join(', ')}</small>}
   </label>)}
  </fieldset>
  <p className="poll-meta">{poll.anonymous?'Anonymous poll · counts only; nobody sees who voted':'Named poll · members see who voted'} · {poll.multiple?'choose several':'choose one'} · {poll.voters} {poll.voters===1?'person':'people'} voted · {poll.open?(poll.closes?'closes '+when(poll.closes):'open until closed'):'closed · final count'}</p>
  {poll.open&&<div className="poll-actions">
   <button type="button" className="soft-button" disabled={busy||!changed||!selected.length} onClick={()=>void send('vote',{choices:selected})}>{poll.mine.length?'Change vote':'Vote'}</button>
   {poll.mine.length>0&&<button type="button" className="text-button" disabled={busy} onClick={()=>void send('vote',{choices:[]})}>Withdraw vote</button>}
   {poll.canClose&&<button type="button" className="text-button" disabled={busy} onClick={()=>void send('close',{})}>Close poll</button>}
  </div>}
  {error&&<p className="warning" role="alert">{error}</p>}
 </section>
}
