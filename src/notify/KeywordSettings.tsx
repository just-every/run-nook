import {useEffect,useState} from 'react'
import type {TeamRequest} from '../team/types'
type Keywords={keywords:string[];keywordsInMuted:boolean;keywordEmail:boolean}
/** Personal keywords: words or phrases that raise a keyword item in conversations you can read. Only you can see this list. */
export function KeywordSettings({request}:{request:TeamRequest}){
 const [state,setState]=useState<Keywords|null>(null),[draft,setDraft]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false)
 useEffect(()=>{const controller=new AbortController();request<Keywords>('/api/notify',{signal:controller.signal}).then(setState).catch(()=>undefined);return()=>controller.abort()},[request])
 async function save(body:Partial<Keywords>,done:string){setBusy(true);setNotice('');try{setState(await request<Keywords>('/api/notify',{method:'PATCH',body:JSON.stringify(body)}));setNotice(done)}catch(e){setNotice((e as Error).message)}finally{setBusy(false)}}
 if(!state)return null
 return <section className="team-notifications email-notifications" aria-labelledby="keywords-title"><strong id="keywords-title">Keywords</strong>
  <p>Get a notification when someone else writes one of your words or phrases in a conversation you can read. Only you can see this list. Matching is case-insensitive and by whole word; up to 20 keywords of 64 characters each.</p>
  <form onSubmit={e=>{e.preventDefault();const word=draft.trim();if(word){void save({keywords:[...state.keywords,word]},'Keyword added.').then(()=>setDraft(''))}}}>
   <label>New keyword<input value={draft} maxLength={64} onChange={e=>setDraft(e.target.value)}/></label>
   <button className="soft-button" disabled={busy||!draft.trim()||state.keywords.length>=20}>Add keyword</button></form>
  {state.keywords.length>0&&<ul aria-label="Your keywords">{state.keywords.map(word=><li key={word}>{word} <button className="soft-button" disabled={busy} onClick={()=>void save({keywords:state.keywords.filter(w=>w!==word)},'Keyword removed.')}>Remove {word}</button></li>)}</ul>}
  <label><input type="checkbox" checked={state.keywordsInMuted} disabled={busy} onChange={e=>void save({keywordsInMuted:e.target.checked},'Keyword choice saved.')}/>Also notify me for keywords in muted conversations</label>
  <label><input type="checkbox" checked={state.keywordEmail} disabled={busy} onChange={e=>void save({keywordEmail:e.target.checked},'Keyword choice saved.')}/>Email me for keyword matches</label>
  <p role="status">{notice}</p></section>
}
