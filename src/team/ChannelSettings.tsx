import {useEffect,useId,useState} from 'react'
import {api} from '../chat/api'
import type {Conversation,Person} from '../chat/types'
import './channel-settings.css'

type Details={id:string;name:string;kind:string;version:number;manager:string|null;topic:string;archived:boolean;canManage:boolean;canLeave:boolean;leaveReason:string|null;archiveReason?:string|null;transferCandidates?:Person[]}
type Props={conversation:Conversation;members:Person[];user:Person;refresh:()=>Promise<void>;onLeft:()=>void}

export function ChannelSettings({conversation,members,user,refresh,onLeft}:Props){
 const transferId=useId()
 const [details,setDetails]=useState<Details|null>(null),[name,setName]=useState(''),[topic,setTopic]=useState(''),[manager,setManager]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[confirm,setConfirm]=useState<'leave'|'archive'|null>(null)
 const load=async()=>{const next=await api<Details>(`channels/${conversation.id}/details`);setDetails(next);setName(next.name);setTopic(next.topic)}
 useEffect(()=>{let active=true;void api<Details>(`channels/${conversation.id}/details`).then(next=>{if(active){setDetails(next);setName(next.name);setTopic(next.topic)}}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[conversation.id,conversation.version])
 const change=async(path:string,input:unknown,method='POST')=>{if(!details||busy)return;setBusy(true);setError('');try{await api(`channels/${conversation.id}`+path,input,method);await load();setConfirm(null);await refresh()}catch(e){setError(e instanceof Error?e.message:'Please try again.')}finally{setBusy(false)}}
 const leave=async()=>{if(!details||busy)return;setBusy(true);setError('');try{await api(`channels/${conversation.id}/leave`,{version:details.version});onLeft()}catch(e){setError(e instanceof Error?e.message:'Please try again.');setBusy(false)}}
 const candidates=details?.transferCandidates??members.filter(p=>p.id!==user.id&&p.active!==0)
 return <section className="channel-settings" aria-label="Channel settings">
  {error&&<p className="warning" role="alert">{error}</p>}
  {!details?<p className="muted">Loading channel settings…</p>:<>
   <p className="dialog-note">{details.archived?'Archived · History stays available. Restore this channel to post again.':details.kind==='private'?'Private channel · Only members can read its full history.':'Public channel · Teammates may join and read the full history.'}</p>
   <p className="dialog-note">Managed by {members.find(p=>p.id===details.manager)?.name??(details.manager?'a former member':'no one')}{details.manager===user.id?' (you)':''}.</p>
   {details.canManage?<>
    <form onSubmit={e=>{e.preventDefault();void change('',{version:details.version,name,topic},'PATCH')}}>
     <label className="field">Channel name<input value={name} onChange={e=>setName(e.target.value)} required maxLength={80} disabled={busy}/></label>
     <label className="field">Topic<textarea value={topic} onChange={e=>setTopic(e.target.value)} maxLength={500} disabled={busy} rows={2}/></label>
     <button className="soft-button" disabled={busy||!name.trim()||name===details.name&&topic===details.topic}>Save channel details</button>
    </form>
    <form onSubmit={e=>{e.preventDefault();void change('/transfer',{version:details.version,user:manager})}}>
     <div className="field"><label htmlFor={transferId}>Transfer management</label><select id={transferId} value={manager} onChange={e=>setManager(e.target.value)} disabled={busy}><option value="">Choose a current member</option>{candidates.filter(p=>p.id!==details.manager).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
     <button className="soft-button" disabled={busy||!manager}>Transfer management</button>
    </form>
    {details.archived?<button className="soft-button" disabled={busy} onClick={()=>void change('/archive',{version:details.version,archived:false})}>Restore channel</button>:<button className="text-button" disabled={busy||!!details.archiveReason} onClick={()=>setConfirm('archive')}>Archive channel</button>}
    {details.archiveReason&&<p className="dialog-note">{details.archiveReason}</p>}
   </>:details.topic&&<p className="channel-topic">{details.topic}</p>}
   {confirm==='archive'&&<div className="channel-confirm"><p>Archive #{details.name}? Members keep the history. New messages, replies and uploads stop until the channel is restored.</p><button className="danger-button" disabled={busy} onClick={()=>void change('/archive',{version:details.version,archived:true})}>Confirm archive</button><button className="soft-button" disabled={busy} onClick={()=>setConfirm(null)}>Keep channel open</button></div>}
   {confirm==='leave'?<div className="channel-confirm"><p>Leave #{details.name}? Your messages stay. {details.kind==='private'?'A manager must add you again to return.':'You can rejoin it from Browse public channels.'}</p><button className="danger-button" disabled={busy} onClick={()=>void leave()}>Confirm leave</button><button className="soft-button" disabled={busy} onClick={()=>setConfirm(null)}>Stay in channel</button></div>:<button className="text-button" disabled={busy||!details.canLeave} onClick={()=>setConfirm('leave')}>Leave channel</button>}
   {!details.canLeave&&details.leaveReason&&<p className="dialog-note">{details.leaveReason}</p>}
  </>}
 </section>
}
