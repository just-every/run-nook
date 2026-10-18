import {useEffect,useRef,useState} from 'react'
import {api} from '../chat/api'
import {useProfileExpiry} from './useExpiry'
import type {FieldResult,PeoplePage,Profile} from './types'
import './profiles.css'

type Props={revision?:string|number;privateSignal?:AbortSignal;onSelect?:(person:Profile)=>void}
const nextExpiry=(items:Profile[])=>items.reduce<number|null>((next,person)=>person.status?.expiresAt!=null?Math.min(next??Infinity,person.status.expiresAt):next,null)
export function PeopleDirectory({revision,privateSignal,onSelect}:Props){
 const [fields,setFields]=useState<FieldResult|null>(null),[page,setPage]=useState<PeoplePage|null>(null),[q,setQ]=useState(''),[field,setField]=useState(''),[value,setValue]=useState(''),[query,setQuery]=useState(''),[reload,setReload]=useState(0),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 const generation=useRef(0),alive=useRef(true),pendingMore=useRef(false)
 useEffect(()=>{
  alive.current=true
  const clear=()=>{alive.current=false;generation.current++;setPage(null);setFields(null);setQ('');setField('');setValue('');setQuery('');setError('')}
  privateSignal?.addEventListener('abort',clear,{once:true});if(privateSignal?.aborted)clear()
  return()=>{alive.current=false;generation.current++;privateSignal?.removeEventListener('abort',clear)}
 },[privateSignal])
 useEffect(()=>{
  let active=true
  if(privateSignal?.aborted)return
  void api<FieldResult>('profile/fields').then(result=>{if(active&&alive.current)setFields(result)}).catch(cause=>{if(active&&alive.current)setError(cause.message)})
  return()=>{active=false}
 },[revision,privateSignal])
 useEffect(()=>{
  const run=++generation.current
  if(privateSignal?.aborted)return
  setBusy(true);setPage(null);setError('');pendingMore.current=false
  void api<PeoplePage>('people?'+query).then(result=>{if(alive.current&&run===generation.current)setPage(result)}).catch(cause=>{if(alive.current&&run===generation.current)setError(cause.message)}).finally(()=>{if(alive.current&&run===generation.current)setBusy(false)})
  return()=>{generation.current++}
 },[query,revision,privateSignal,reload])
 useProfileExpiry(page?.nextExpiry,page?.observedAt,()=>{
  setPage(prior=>{if(!prior||prior.nextExpiry===null)return prior;const observedAt=prior.nextExpiry,items=prior.items.map(person=>person.status?.expiresAt!=null&&person.status.expiresAt<=observedAt?{...person,status:null}:person);return {...prior,items,observedAt,nextExpiry:nextExpiry(items)}})
 })
 const more=async()=>{
  if(!page?.cursor||busy||pendingMore.current)return
  const run=generation.current;pendingMore.current=true;setBusy(true);setError('')
  try{
   const params=new URLSearchParams(query);params.set('after',page.cursor)
   const result=await api<PeoplePage>('people?'+params)
   if(!alive.current||run!==generation.current)return
   setPage(prior=>{if(!prior)return result;const seen=new Set(prior.items.map(person=>person.id)),items=[...prior.items,...result.items.filter(person=>!seen.has(person.id))].map(person=>person.status?.expiresAt!=null&&person.status.expiresAt<=result.observedAt?{...person,status:null}:person);return {...result,items,nextExpiry:nextExpiry(items)}})
  }catch(cause){if(alive.current&&run===generation.current)setError(cause instanceof Error?cause.message:'Could not load more people')}finally{if(alive.current&&run===generation.current){setBusy(false);pendingMore.current=false}}
 }
 if(privateSignal?.aborted)return null
 return <section className="page-content team-page"><div className="page-column team-surface people-directory">
  <p className="muted">Find people by name or the profile fields you can see.</p>
  <form onSubmit={event=>{event.preventDefault();const params=new URLSearchParams();if(q.trim())params.set('q',q.trim());if(field){params.set('field',field);if(value.trim())params.set('value',value.trim())}setQuery(params.toString());setReload(prior=>prior+1)}}>
   <label className="field">Search people<input type="search" maxLength={200} value={q} placeholder="Name, department, location…" onChange={event=>setQ(event.target.value)}/></label>
   <div className="field-row"><label className="field">Filter by field<select aria-label="Filter by field" value={field} onChange={event=>{setField(event.target.value);setValue('')}}><option value="">All fields</option>{fields?.fields.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>{field&&<label className="field">Field contains<input maxLength={500} value={value} onChange={event=>setValue(event.target.value)} placeholder="Any non-empty value"/></label>}</div>
   <button className="soft-button" disabled={busy}>Search people</button>
  </form>
  {error&&<p role="alert">{error}</p>}
  {page?<><p className="dialog-note" role="status">{page.items.length} {page.items.length===1?'person':'people'} shown{page.hasMore?' · More available':''}</p>
   <ul className="team-people">{page.items.map(person=><li key={person.id}><div className="team-person"><strong>{person.name}</strong>{person.status&&<span>{person.status.emoji} {person.status.text}</span>}<small>{person.zone}</small>
    {person.fields.some(item=>item.value)&&<dl>{person.fields.filter(item=>item.value).map(item=><div key={item.id}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>}
   </div>{onSelect&&<button className="soft-button" onClick={()=>onSelect(person)}>Open {person.name}</button>}</li>)}</ul>
   {!page.items.length&&<p className="muted">No people match your search.</p>}
   {page.hasMore&&<button className="soft-button" disabled={busy} onClick={()=>void more()}>{busy?'Loading…':'Load more people'}</button>}
  </>:busy&&<p role="status">Loading people…</p>}
 </div></section>
}
