import {useEffect,useRef,useState} from 'react'
import type {TeamRequest} from '../types'
import {ErasureDialog} from './ErasureDialog'
export function ImportedAuthors({request}:{request:TeamRequest}){
 const eraseTrigger=useRef<HTMLSelectElement|null>(null)
 const [authors,setAuthors]=useState<{id:string;name:string}[]>([]),[target,setTarget]=useState(''),[error,setError]=useState('')
 const refresh=()=>request<{id:string;name:string}[]>('/api/erasures/imported-authors').then(setAuthors)
 useEffect(()=>{const abort=new AbortController();request<{id:string;name:string}[]>('/api/erasures/imported-authors',{signal:abort.signal}).then(setAuthors).catch(e=>{if(!abort.signal.aborted)setError(e.message)});return()=>abort.abort()},[request])
 return <section><h3>Imported authors</h3><p>Source authors are distinct from teammates. Erasing one removes their imported messages, files and retained source copies from your accessible imported channels.</p>{error&&<p role="alert">{error}</p>}{authors.length?<label>Imported author<select ref={eraseTrigger} value={target} onChange={e=>setTarget(e.target.value)}><option value="">Choose an author to erase</option>{authors.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>:<p>No eligible imported authors.</p>}{target&&<ErasureDialog kind="imported-author" target={target} returnFocus={eraseTrigger.current} request={request} onClose={()=>setTarget('')} onChanged={()=>void refresh()}/>}</section>
}
