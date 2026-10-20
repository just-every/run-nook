import {useEffect,useState} from 'react'
import type {ChannelChoice,TeamRequest} from '../team/types'
import './audit.css'
type Entry={id:string;at:number;actor:string|null;actorName:string;kind:string;scopeLabel:string;version:number|null;reason:string;outcome:'confirmed'|'failed'|'uncertain';subjectName:string|null;detail:Record<string,unknown>}
type Page={items:Entry[];cursor:string|null}
type Person={id:string;name:string}
const kinds:[string,string][]=[['','Every action'],['session','Sign-in and sessions'],['invitation','Invitations'],['account','Roles and account status'],['membership','Membership'],['channel','Channel lifecycle'],['posting','Posting permissions'],['message','Admin override posts'],['policy','Workspace policies'],['export','Readable exports'],['archive','Archive export and restore'],['erasure','Erasure'],['token','Integration tokens'],['import','History imports']]
const titles:Record<string,string>={'session.start':'Signed in','session.end':'Session ended','invitation.prepare':'Invitation prepared','invitation.cancel':'Invitation cancelled','invitation.send':'Invitation link sent','account.role':'Role changed','account.status':'Account status changed','membership.grant':'Workspace access restored','membership.remove':'Removed from a channel','membership.join':'Joined a channel','membership.leave':'Left a channel','posting.change':'Posting permissions changed','message.override':'Admin override post','policy.default-channels':'Default channels changed','policy.broadcast':'Channel-wide mention policy changed','policy.export':'Workspace export policy changed','policy.profile-fields':'Profile fields changed','policy.sign-in':'Sign-in policy changed','export.readable':'Readable export','archive.export':'Archive export','archive.restore':'Archive restored','import.history':'History import','channel.convert':'Group conversation converted','token.create':'Integration token created','token.rotate':'Integration token rotated','token.revoke':'Integration token revoked','token.post':'Integration token posted','token.replay':'Integration token repeated a post','token.refuse':'Integration token refused'}
const title=(kind:string)=>titles[kind]??(kind.startsWith('erasure.')?'Erasure: '+kind.slice(8):kind.startsWith('channel.')?'Channel '+kind.slice(8):kind)
const outcomeLabel={confirmed:'Confirmed',failed:'Failed',uncertain:'Uncertain'}
const when=(at:number)=>new Date(at).toLocaleString([],{dateStyle:'medium',timeStyle:'short'})
const counts=(detail:Record<string,unknown>)=>Object.entries(detail).map(([key,value])=>`${key} ${value}`).join(' · ')
// NOOK-051: owners and admins read, filter and export the audit log.
export function AuditLog({request,channels}:{request:TeamRequest;channels:ChannelChoice[]}){
 const [filters,setFilters]=useState({kind:'',actor:'',scope:'',outcome:'',from:'',to:''}),[page,setPage]=useState<Page|null>(null),[people,setPeople]=useState<Person[]>([]),[notice,setNotice]=useState('')
 const query=(extra:Record<string,string>={})=>{
  const params=new URLSearchParams()
  for(const [key,value] of Object.entries(filters))if(value)params.set(key,key==='from'||key==='to'?String(new Date(value+(key==='to'?'T23:59:59.999':'T00:00')).getTime()+(key==='to'?1:0)):value)
  for(const [key,value] of Object.entries(extra))params.set(key,value)
  return params.toString()
 }
 const load=(before?:string)=>request<Page>('/api/audit?'+query(before?{before}:{})).then(next=>{setPage(current=>before&&current?{items:[...current.items,...next.items],cursor:next.cursor}:next);setNotice('')},error=>setNotice(error instanceof Error?error.message:'The audit log could not be loaded.'))
 useEffect(()=>{void request<Person[]>('/api/team').then(rows=>setPeople(rows.map(({id,name})=>({id,name})))).catch(()=>{})},[request])
 useEffect(()=>{void load()},[filters,request])
 const set=(key:keyof typeof filters)=>(event:React.ChangeEvent<HTMLInputElement|HTMLSelectElement>)=>setFilters({...filters,[key]:event.target.value})
 return <section className="team-section audit-log" aria-labelledby="audit-log-heading">
  <h2 id="audit-log-heading">Audit log</h2>
  <p className="team-lead">Who changed sign-in, invitations, roles, membership, policies, exports, erasure, tokens and channels, and whether it took effect. It never shows message text or secrets, and a direct conversation appears only as “a direct conversation”.</p>
  <form className="audit-filters" aria-label="Filter the audit log" onSubmit={event=>event.preventDefault()}>
   <label>Action<select value={filters.kind} onChange={set('kind')}>{kinds.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
   <label>Person<select value={filters.actor} onChange={set('actor')}><option value="">Anyone</option>{people.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
   <label>Where<select value={filters.scope} onChange={set('scope')}><option value="">Anywhere</option>{channels.filter(c=>c.kind!=='dm').map(c=><option key={c.id} value={c.id}>#{c.name}</option>)}</select></label>
   <label>Outcome<select value={filters.outcome} onChange={set('outcome')}><option value="">Any outcome</option><option value="confirmed">Confirmed</option><option value="failed">Failed</option><option value="uncertain">Uncertain</option></select></label>
   <label>From<input type="date" value={filters.from} onChange={set('from')}/></label>
   <label>To<input type="date" value={filters.to} onChange={set('to')}/></label>
  </form>
  <p className="audit-export">Export these entries: <a href={'/api/audit/export?'+query({format:'csv'})} download>CSV</a> · <a href={'/api/audit/export?'+query({format:'json'})} download>JSON</a></p>
  {page&&(page.items.length?<ol className="audit-entries" aria-label="Audit entries">{page.items.map(e=><li key={e.id}><article aria-label={`${title(e.kind)} ${outcomeLabel[e.outcome]}`}>
   <p className="audit-head"><span className={'audit-outcome '+e.outcome}>{outcomeLabel[e.outcome]}</span><strong>{title(e.kind)}</strong><time dateTime={new Date(e.at).toISOString()}>{when(e.at)}</time></p>
   <p>{e.actorName} · {e.scopeLabel}{e.subjectName&&e.subjectName!==e.scopeLabel?` · about ${e.subjectName}`:''}{e.version!=null?` · version ${e.version}`:''}</p>
   <p className="audit-reason">{e.reason}{Object.keys(e.detail).length?` (${counts(e.detail)})`:''}</p>
  </article></li>)}</ol>:<p className="team-lead">No entries match these filters.</p>)}
  {page?.cursor&&<button className="soft-button" onClick={()=>void load(page.cursor!)}>Show older entries</button>}
  <p role="status">{notice}</p>
 </section>
}
