import {useEffect,useState} from 'react'
import type {TeamRequest} from '../team/types'
import './audit.css'
import {eventWords} from './event-words'
type Entry={id:string;actor:string|null;actorName:string;service:string;at:number;kind:string;scope:string;version:number;reason:string;outcome:string;count:number}
type Page={items:Entry[];cursor:string|null}
export function AuditLog({request}:{request:TeamRequest}){
 const [page,setPage]=useState<Page>({items:[],cursor:null}),[query,setQuery]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false)
 const load=async(params:string,append=false)=>{setBusy(true);setNotice('');try{const value=await request<Page>('/api/team/audit?'+params);setPage(previous=>({...value,items:append?[...previous.items,...value.items]:value.items}))}catch(error){setPage({items:[],cursor:null});setNotice((error as Error).message)}finally{setBusy(false)}}
 useEffect(()=>{void load('')},[request])
 async function download(format:'json'|'csv'){
  setNotice('');try{const response=await fetch('/api/team/audit?'+query+'&format='+format);if(!response.ok)throw Error('Audit export unavailable');const href=URL.createObjectURL(await response.blob()),a=document.createElement('a');a.href=href;a.download='nook-audit.'+format;a.click();setTimeout(()=>URL.revokeObjectURL(href),1000)}catch(error){setNotice((error as Error).message)}
 }
 return <section className="team-section audit-section" aria-labelledby="audit-heading"><h2 id="audit-heading">Audit log</h2>
 <form className="audit-filters" onSubmit={event=>{event.preventDefault();const params=new URLSearchParams();for(const [key,value] of new FormData(event.currentTarget))if(String(value))params.set(key,String(value));setQuery(params.toString());void load(params.toString())}}>
 <label className="field">Actor<input name="actor" placeholder="Name, ID or anonymous" maxLength={256}/></label><label className="field">Kind<input name="kind" placeholder="e.g. policy.posting" maxLength={256}/></label><label className="field">Scope<input name="scope" placeholder="Channel name" maxLength={256}/></label><label className="field">Outcome<select name="outcome" aria-label="Outcome"><option value="">All outcomes</option><option>confirmed</option><option>failed</option><option>uncertain</option></select></label><label className="field">From<input name="from" type="datetime-local"/></label><label className="field">Until<input name="until" type="datetime-local"/></label><button className="send" disabled={busy}>Apply filters</button>
 </form><div className="audit-downloads"><button className="soft-button" onClick={()=>void download('csv')}>Download CSV</button><button className="soft-button" onClick={()=>void download('json')}>Download JSON</button></div>
 <p className="team-status" role="status">{notice||(busy?'Loading history…':page.items.length?'':'No actions match these filters.')}</p>
 <ol className="audit-entries">{page.items.map(row=><li key={row.id}><div className="audit-entry-heading"><strong>{eventWords(row.kind)}</strong><span className={'audit-outcome audit-'+row.outcome}>{row.outcome}</span></div><p>{row.actorName} · {row.scope}</p><p>{row.reason}</p><small><time dateTime={new Date(row.at).toISOString()}>{new Date(row.at).toLocaleString()}</time></small></li>)}</ol>
 {page.cursor&&<button className="soft-button" disabled={busy} onClick={()=>{const params=new URLSearchParams(query);params.set('cursor',page.cursor!);void load(params.toString(),true)}}>Load earlier actions</button>}
 </section>
}
