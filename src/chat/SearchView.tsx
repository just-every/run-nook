import {useEffect,useId,useState} from 'react'
import {api} from './api'
import type {Conversation,Message,Page,Person} from './types'
import {conversationName} from './Navigation'
import {usePrivateScope} from './usePrivateScope'
import {emptyFilters,filterQuery,isModifier,queryParts,type SearchFilters} from './search-filters'
import '../app-style/search.css'
type Result=Pick<Message,'id'|'conversation'|'body'|'parent'|'authorName'>&{displayBody?:string;created:string;source:'native'|'imported'}
type SearchPage=Page<Result>&{hints:string[];filters:{text:string}}
function highlight(text:string,query:string) {
 if(!query)return text
 return text.split(new RegExp('('+query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','gi')).map((part,index)=>index%2?<mark key={index}>{part}</mark>:part)
}
type Props={conversations:Conversation[];users:Person[];user:Person;query:string;revision:number;privateSignal:AbortSignal;onQuery:(q:string)=>void;onOpen:(conversation:string,focus:string,thread:string|null)=>void;onError:(e:unknown)=>void}
export function SearchView({query,revision,privateSignal,conversations,users,user,onQuery,onOpen,onError}:Props) {
 const fieldId=useId(),[input,setInput]=useState(queryParts(query).filter(part=>!isModifier(part)).join(' ')),[filters,setFilters]=useState<SearchFilters>(emptyFilters),[page,setPage]=useState<SearchPage|null>(null),[loading,setLoading]=useState(false)
 const current=usePrivateScope(privateSignal,'search:'+query)
 useEffect(()=>{setInput(queryParts(query).filter(part=>!isModifier(part)).join(' '))},[query])
 useEffect(()=>{let cancelled=false;setPage(null);if(!query.trim()){setLoading(false);return}setLoading(true);void api<SearchPage>('search?q='+encodeURIComponent(query)).then(value=>{if(!cancelled&&current())setPage(value)}).catch(error=>{if(!cancelled&&current())onError(error)}).finally(()=>{if(!cancelled&&current())setLoading(false)});return()=>{cancelled=true}},[query,revision,current,onError])
 const more=async()=>{if(!page?.hasMore||loading)return;setLoading(true);try{const value=await api<SearchPage>('search?q='+encodeURIComponent(query)+'&after='+encodeURIComponent(page.cursor));if(current())setPage({...value,items:[...page.items,...value.items.filter(item=>!page.items.some(old=>old.id===item.id))]})}catch(error){if(current())onError(error)}finally{if(current())setLoading(false)}}
 const parts=queryParts(query),chips=parts.filter(isModifier)
 const label=(part:string)=>part.replace(/^in:#?(.+)$/i,(_,id)=>'in:#'+(conversations.some(c=>c.id===id)?conversationName(conversations.find(c=>c.id===id)!,user):id)).replace(/^from:@?(.+)$/i,(_,id)=>'from:@'+(users.find(p=>p.id===id)?.name??id))
 const change=(name:keyof SearchFilters,value:string)=>setFilters({...filters,[name]:value})
 return <section className="page-content"><div className="page-column">
  <form className="search-controls" onSubmit={e=>{e.preventDefault();onQuery(filterQuery([input,...chips].join(' '),filters));setFilters(emptyFilters)}}>
   <div className="search-form"><label className="field"><span className="sr-only">Search conversations</span><input type="search" maxLength={512} value={input} placeholder="Search messages, including Q3 or HR" onChange={e=>setInput(e.target.value)} autoFocus/></label><button className="soft-button">Search</button></div>
   <div className="search-filter-fields"><div className="field"><label htmlFor={fieldId+'-conversation'}>Conversation</label><select id={fieldId+'-conversation'} value={filters.conversation} onChange={e=>change('conversation',e.target.value)}><option value="">Any conversation</option>{conversations.map(c=><option key={c.id} value={c.id}>{c.kind==='dm'?'':'# '}{conversationName(c,user)}</option>)}</select></div><div className="field"><label htmlFor={fieldId+'-person'}>Person</label><select id={fieldId+'-person'} value={filters.person} onChange={e=>change('person',e.target.value)}><option value="">Anyone</option><option value="me">Me</option>{users.filter(p=>p.id!==user.id).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div><label className="field">On or after (UTC)<input type="date" value={filters.afterDate} onChange={e=>change('afterDate',e.target.value)}/></label><label className="field">Before (UTC)<input type="date" value={filters.beforeDate} onChange={e=>change('beforeDate',e.target.value)}/></label></div>
  </form>
  <p className="search-help muted">Message bodies · exact substring, any length. Try from:me, in:#channel, has:file, has:pin or is:saved. Dates use UTC. File contents are not searched.</p>
  {!!chips.length&&<div className="search-chips" aria-label="Active search filters">{chips.map((part,index)=><button className="soft-button" key={part+index} aria-label={'Remove filter '+label(part)} onClick={()=>onQuery(parts.filter((_,i)=>i!==parts.indexOf(part)).join(' '))}>{label(part)}<span aria-hidden="true"> ×</span></button>)}</div>}
  {page?.hints.map(hint=><p className="muted" key={hint}>{hint}</p>)}
  <p className="sr-only" role="status">{loading?'Searching…':page?`${page.items.length} results loaded${page.hasMore?', more available':''}`:''}</p>
  {page?.items.map(m=>{const where=conversations.find(c=>c.id===m.conversation);return <article className="search-result reveal-host" key={m.id}><p className="search-meta">{where?(where.kind==='dm'?'':'# ')+conversationName(where,user)+' · ':''}{m.authorName} · {m.source==='imported'?'Imported':'Native'} · <time dateTime={m.created}>{new Date(m.created).toLocaleString()}</time></p><p className="search-snippet">{highlight(m.displayBody??m.body,page.filters.text)}</p><button className="soft-button" onClick={()=>onOpen(m.conversation,m.id,m.parent)}>Open in conversation</button></article>})}
  {page?.hasMore&&<button className="soft-button" disabled={loading} onClick={()=>void more()}>Load more search results</button>}
  {loading&&<p className="muted">Searching…</p>}
  {query&&page&&!page.items.length&&!page.hasMore&&<p className="empty-state">No matching messages in your conversations.</p>}
  {query&&page&&!page.items.length&&page.hasMore&&<p className="muted">No matches in this page. Continue to search later messages.</p>}
 </div></section>
}
