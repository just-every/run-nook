import {useEffect,useState} from 'react'
import {api} from '../chat/api'
type Policy={version:number;create_public:string;create_private:string;archive:string;canManage:boolean}
const labels:Record<string,string>={owners:'Owners only',admins:'Owners and admins',members:'All full members',managers:'Existing channel management'}
const fields=[['create_public','Who can create public channels?'],['create_private','Who can create private channels?'],['archive','Who can archive channels?']] as const
export function WorkspacePolicy(){
 const [policy,setPolicy]=useState<Policy|null>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState('')
 useEffect(()=>{let active=true;void api<Policy>('team/workspace-policy').then(value=>{if(active)setPolicy(value)}).catch(error=>{if(active)setNotice(error.message)});return()=>{active=false}},[])
 const save=async()=>{if(!policy)return;setBusy(true);setNotice('');try{const {canManage,...input}=policy;setPolicy(await api<Policy>('team/workspace-policy',input,'PATCH'));setNotice('Workspace channel policy saved.')}catch(error){setNotice((error as Error).message)}finally{setBusy(false)}}
 return <section className="team-section" aria-label="Workspace policy"><h3>Workspace policy</h3>{notice&&<p role="status">{notice}</p>}{policy&&<>
 <p className="dialog-note">Only installation owners change this policy. Admins can read it. Delegating this permission is not yet available. Guests cannot create or archive channels.</p>
 {policy.canManage?<form onSubmit={event=>{event.preventDefault();void save()}}>{fields.map(([key,label])=><label className="field" key={key}>{label}<select disabled={busy} value={policy[key]} onChange={event=>setPolicy({...policy,[key]:event.target.value})}>{key==='archive'&&policy.archive==='managers'&&<option value="managers" disabled>Choose an archive policy</option>}{['owners','admins','members'].map(value=><option key={value} value={value}>{labels[value]}</option>)}</select></label>)}<p className="dialog-note">Until the first save, existing channel management rules apply. Archive permissions apply only inside channels the person can currently read. Existing channels and their members are unchanged.</p><button className="soft-button" disabled={busy||policy.archive==='managers'}>Save workspace policy</button></form>:<dl>{fields.map(([key,label])=><div key={key}><dt>{label}</dt><dd>{labels[policy[key]]}</dd></div>)}</dl>}
 </>}</section>
}
