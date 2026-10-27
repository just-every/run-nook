import {useAiAvailability} from '../ai-search/availability'
import {RecapResult} from './RecapResult'
import {useEffect,useState} from 'react'
import {api} from '../chat/api'
import {usePrivateScope} from '../chat/usePrivateScope'
import './recaps.css'
export function RecapPanel({onClose,conversation,thread,revision,privateSignal,onOpen}:{onClose:()=>void;conversation:string;thread:string|null;revision:number;privateSignal:AbortSignal;onOpen:(message:string,parent:string|null)=>void}){
 const {state}=useAiAvailability(),opened=true
 const current=usePrivateScope(privateSignal,'recap:'+conversation+':'+(thread??''))
 const [mode,setMode]=useState('channel'),[from,setFrom]=useState(''),[through,setThrough]=useState(''),[answer,setAnswer]=useState<any>(null),[receipt,setReceipt]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[source,setSource]=useState(''),[correction,setCorrection]=useState('')
 useEffect(()=>{setAnswer(null);setReceipt('');setNotice('');setMode(thread?'thread':'channel')},[conversation,thread])
 useEffect(()=>{
  if(!receipt||!opened)return;let live=true
  const recheck=()=>{setAnswer(null);void api('recaps/show',{receipt}).then(value=>{if(live&&current())setAnswer(value)}).catch(()=>{if(live&&current()){setAnswer(null);setReceipt('');setNotice('Recap unavailable. Your access or its sources changed.')}})}
  recheck();const timer=setInterval(recheck,10000);return()=>{live=false;clearInterval(timer)}
 },[receipt,revision,opened,current])
 async function ask(e:React.FormEvent){e.preventDefault();setBusy(true);setAnswer(null);setReceipt('');setNotice('');try{const value:any=await api('recaps',{conversation,...(mode==='thread'?{thread}:{}),...(from?{from:new Date(from).toISOString()}:{}),...(through?{through:new Date(through).toISOString()}:{}),unread:mode==='unread'});if(current()){setAnswer(value);setReceipt(value.receipt??'')}}catch(e){if(current())setNotice((e as Error).message)}finally{if(current())setBusy(false)}}
 async function feedback(kind:string){try{await api('recaps/feedback',{receipt,kind,message:source,correction});if(current()){setCorrection('');setSource('');if(kind==='dismissal'){setReceipt('');setAnswer(null);setNotice('Recap dismissed. Source messages unchanged.')}else{const value=await api('recaps/show',{receipt});if(current()){setAnswer(value);setNotice('Correction saved separately. Source messages unchanged.')}}}}catch(e){if(current())setNotice((e as Error).message)}}
 if(state!=='ready'&&state!=='capped')return null
 return <div className="recap-door"><section className="recap-panel" aria-label="Conversation recap"><button className="text-button" onClick={onClose}>Close recap</button><h2>Catch up with sources</h2>{state==='capped'?<p role="status">Daily limit reached.</p>:<><form onSubmit={e=>void ask(e)}><label className="field">Recap range<select aria-label="Recap range" value={mode} onChange={e=>setMode(e.target.value)}><option value="channel">This conversation</option>{thread&&<option value="thread">This thread</option>}<option value="unread">Unread since my current read marker</option></select></label><div className="recap-dates"><label className="field">From (local time)<input type="datetime-local" value={from} onChange={e=>setFrom(e.target.value)}/></label><label className="field">Through (local time)<input type="datetime-local" value={through} onChange={e=>setThrough(e.target.value)}/></label></div><button className="soft-button" disabled={busy}>{busy?'Reading sources…':'Ask for recap'}</button></form>
 {answer&&<RecapResult formatDate={value=>new Date(value).toLocaleString()} answer={answer} receipt={receipt} onCorrect={setSource} onDismiss={()=>void feedback('dismissal')} onOpen={claim=>onOpen(claim.source.message,claim.source.parent)}/>}
 {source&&<form onSubmit={e=>{e.preventDefault();void feedback('correction')}}><label className="field">Your correction<textarea required maxLength={2000} value={correction} onChange={e=>setCorrection(e.target.value)}/></label><button className="soft-button">Save correction</button></form>}<p role="status">{notice}</p></>}</section></div>
}
