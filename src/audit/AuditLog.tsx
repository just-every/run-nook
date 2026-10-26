import {formatTime} from '../chat/format-time'
import {useEffect,useRef,useState} from 'react'
import type {TeamRequest} from '../team/types'
import './audit.css'
import '../app-style/search.css'
import '../chat/list-controls.css'
import {eventKinds,eventWords} from './event-words'
type Entry={id:string;actor:string|null;actorName:string;service:string;at:number;kind:string;scope:string;scopeKind:string|null;version:number;reason:string;outcome:string;count:number}
type Page={items:Entry[];cursor:string|null}
export function AuditLog({request}:{request:TeamRequest}){
 const [page,setPage]=useState<Page>({items:[],cursor:null}),[query,setQuery]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[draft,setDraft]=useState<Record<string,string>>({})
 const generation=useRef(0)
 const load=async(params:string,append=false)=>{const epoch=++generation.current;setBusy(true);setNotice('');try{const value=await request<Page>('/api/team/audit?'+params);if(epoch!==generation.current)return;setPage(previous=>({...value,items:append?[...previous.items,...value.items]:value.items}))}catch(error){if(epoch===generation.current){setPage({items:[],cursor:null});setNotice((error as Error).message)}}finally{if(epoch===generation.current)setBusy(false)}}
 useEffect(()=>{void load(query)},[request,query])
 const filterValue=(key:string,value:string)=>key==='actor'&&value.toLowerCase()==='system'?'anonymous':value
 const apply=(values:Record<string,string>)=>{const params=new URLSearchParams();for(const [key,value] of Object.entries(values))if(value)params.set(key,filterValue(key,value));setQuery(params.toString())}
 const change=(key:string,value:string,immediate=true)=>{const next={...draft,[key]:value};setDraft(next);if(immediate)apply(next)}
 async function download(format:'json'|'csv'){
  setNotice('');try{const response=await fetch('/api/team/audit?'+query+'&format='+format);if(!response.ok)throw Error('Audit export unavailable');const href=URL.createObjectURL(await response.blob()),a=document.createElement('a');a.href=href;a.download='nook-audit.'+format;a.click();setTimeout(()=>URL.revokeObjectURL(href),1000)}catch(error){setNotice((error as Error).message)}
 }
 return <section className="team-section audit-section" aria-labelledby="audit-heading"><h2 id="audit-heading">Audit log</h2>
 <details className="search-advanced nook-list-filters"><summary>Filters</summary><form className="search-filter-fields" onSubmit={event=>{event.preventDefault();apply(draft)}}>
 <label className="field">Actor<input name="actor" placeholder="Name or System" maxLength={256} value={draft.actor??''} onChange={event=>change('actor',event.target.value,false)}/></label><label className="field">Kind<select name="kind" aria-label="Kind" value={draft.kind??''} onChange={event=>change('kind',event.target.value)}><option value="">All actions</option>{[...new Set([...eventKinds,...page.items.map(item=>item.kind)])].map(kind=><option key={kind} value={kind}>{eventWords(kind)}</option>)}</select></label><label className="field">Scope<input name="scope" placeholder="Channel name" maxLength={256} value={draft.scope??''} onChange={event=>change('scope',event.target.value,false)}/></label><label className="field">Outcome<select name="outcome" aria-label="Outcome" value={draft.outcome??''} onChange={event=>change('outcome',event.target.value)}><option value="">All outcomes</option><option value="confirmed">Confirmed</option><option value="failed">Failed</option><option value="uncertain">Uncertain</option></select></label><label className="field">From<input name="from" type="datetime-local" value={draft.from??''} onChange={event=>change('from',event.target.value)}/></label><label className="field">Until<input name="until" type="datetime-local" value={draft.until??''} onChange={event=>change('until',event.target.value)}/></label>{['actor','scope'].some(key=>filterValue(key,draft[key]??'')!==(new URLSearchParams(query).get(key)??''))&&<button className="send">Apply text filters</button>}
 </form></details><div className="search-chips nook-filter-chips">{[...new URLSearchParams(query)].map(([key,value])=><button className="soft-button" key={key} aria-label={'Remove '+key+' filter'} onClick={()=>{const next={...draft,[key]:''};setDraft(next);apply(next)}}>{key==='kind'?eventWords(value):value==='anonymous'?'System':value}<span aria-hidden="true"> ×</span></button>)}</div><div className="audit-downloads"><button className="soft-button" onClick={()=>void download('csv')}>Download CSV</button><button className="soft-button" onClick={()=>void download('json')}>Download JSON</button></div>
 <p className="team-status" role="status">{notice||(busy?'Loading history…':page.items.length?'':'No actions match these filters.')}</p>
 <ol className="audit-entries">{page.items.map(row=><li key={row.id}><div className="audit-entry-heading"><strong>{eventWords(row.kind,row.scopeKind)}</strong><span className={'audit-outcome audit-'+row.outcome}>{row.outcome}</span></div><p>{row.actorName} · {row.scope}</p>{row.reason&&!row.reason.startsWith('Session method: ')&&<p>{row.reason}</p>}<small><time dateTime={new Date(row.at).toISOString()}>{formatTime(row.at)}</time></small></li>)}</ol>
 {page.cursor&&<button className="soft-button" disabled={busy} onClick={()=>{const params=new URLSearchParams(query);params.set('cursor',page.cursor!);void load(params.toString(),true)}}>Load earlier actions</button>}
 </section>
}
