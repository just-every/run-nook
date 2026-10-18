import {useEffect,useState} from 'react'
import {api} from '../chat/api'
import type {Person} from '../chat/types'
type Policy={level:string;replies:string;people:string[];history:{version:number;actor:string|null;created:string;level:string;replies:string;people:number}[];overrides:{id:string;actor:string;created:string}[]}
const labels:Record<string,string>={everyone:'Everyone',admins:'Owners and admins',managers:'Channel manager',selected:'Named people'}
export function PostingSettings({id,version,canManage,members,refresh}:{id:string;version:number;canManage:boolean;members:Person[];refresh:()=>Promise<void>}){
 const [policy,setPolicy]=useState<Policy|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('')
 useEffect(()=>{let active=true;void api<Policy>(`channels/${id}/posting`).then(p=>{if(active)setPolicy(p)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[id,version])
 const save=async()=>{if(!policy)return;setBusy(true);setError('');try{await api(`channels/${id}/posting`,{version,level:policy.level,replies:policy.replies,people:policy.level==='selected'?policy.people:[]},'PATCH');await refresh()}catch(e){setError(e instanceof Error?e.message:'Could not save permissions')}finally{setBusy(false)}}
 return <section aria-label="Posting permissions"><h3>Posting permissions</h3>{error&&<p className="warning" role="alert">{error}</p>}{policy&&<>
  {canManage?<form onSubmit={e=>{e.preventDefault();void save()}}>
   <label className="field">Who can post messages?<select value={policy.level} disabled={busy} onChange={e=>setPolicy({...policy,level:e.target.value})}>{Object.entries(labels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
   {policy.level==='selected'&&<fieldset><legend>People allowed to post</legend>{members.map(p=><label className="check" key={p.id}><input type="checkbox" checked={policy.people.includes(p.id)} disabled={busy} onChange={e=>setPolicy({...policy,people:e.target.checked?[...policy.people,p.id]:policy.people.filter(id=>id!==p.id)})}/>{p.name}</label>)}</fieldset>}
   <label className="field">Who can reply in threads?<select value={policy.replies} disabled={busy} onChange={e=>setPolicy({...policy,replies:e.target.value})}><option value="everyone">Everyone</option><option value="same">Same people as messages</option></select></label>
   <p className="dialog-note">Others can still read, react, save and follow. An owner or admin can choose a labelled, audited override.</p>
   <button className="soft-button" disabled={busy}>{busy?'Saving…':'Save posting permissions'}</button>
  </form>:<p>{labels[policy.level]} can post. {policy.replies==='everyone'?'Everyone can reply in threads.':'The same people can reply in threads.'}</p>}
  <details><summary>Permission history and overrides</summary>{policy.history.map(h=><p className="dialog-note" key={h.version}>{new Date(h.created).toLocaleString()} · {members.find(p=>p.id===h.actor)?.name??'Former member'} · {labels[h.level]}{h.level==='selected'?` (${h.people})`:''} · replies: {h.replies==='everyone'?'everyone':'same people'}</p>)}{policy.overrides.map(o=><p className="dialog-note" key={o.id}>Admin override · {members.find(p=>p.id===o.actor)?.name??'Former member'} · {new Date(o.created).toLocaleString()}</p>)}{!policy.history.length&&!policy.overrides.length&&<p className="dialog-note">No permission changes or overrides.</p>}</details>
 </>}</section>
}
