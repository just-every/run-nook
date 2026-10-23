import {useId,useRef,useState} from 'react'
import {POLL_OPTIONS_MAX} from './poll-limits'
import './polls.css'
// Creates a poll as a message in this conversation. The same intent is kept until the form changes, so a retry after a lost reply is one poll.
export function PollForm({onPost,onClose}:{onPost:(input:unknown)=>Promise<void>;onClose:()=>void}){
 const id=useId(),intent=useRef(crypto.randomUUID())
 const [question,setQuestion]=useState(''),[options,setOptions]=useState(['','']),[multiple,setMultiple]=useState(false),[anonymous]=useState(true),[closes,setCloses]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const touch=()=>{intent.current=crypto.randomUUID()}
 const submit=async(event:React.FormEvent)=>{
  event.preventDefault();if(busy)return;setBusy(true);setError('')
  try{await onPost({question:question.trim(),options:options.map(o=>o.trim()),multiple,anonymous,closes:closes?new Date(closes).getTime():null,intent:intent.current});onClose()}
  catch(e){setError(e instanceof Error?e.message:'The poll was not posted.')}finally{setBusy(false)}
 }
 return <form className="poll-form" onSubmit={e=>void submit(e)} aria-label="Create a poll">
  <div className="field"><label htmlFor={id+'-q'}>Question</label><input id={id+'-q'} value={question} maxLength={500} required onChange={e=>{touch();setQuestion(e.target.value)}}/></div>
  <fieldset className="field"><legend>Options (2 to {POLL_OPTIONS_MAX})</legend>{options.map((value,index)=><div className="poll-form-option" key={index}>
   <input aria-label={'Option '+(index+1)} value={value} maxLength={120} required onChange={e=>{touch();setOptions(options.map((o,i)=>i===index?e.target.value:o))}}/>
   {options.length>2&&<button type="button" className="text-button" aria-label={'Remove option '+(index+1)} onClick={()=>{touch();setOptions(options.filter((_,i)=>i!==index))}}>Remove</button>}
  </div>)}{options.length<POLL_OPTIONS_MAX&&<button type="button" className="text-button" onClick={()=>{touch();setOptions([...options,''])}}>Add option</button>}</fieldset>
  <div className="poll-form-choices"><label><input type="checkbox" checked={multiple} onChange={e=>{touch();setMultiple(e.target.checked)}}/> Allow several choices</label><span>Anonymous votes; results show counts only.</span></div>
  <div className="field"><label htmlFor={id+'-c'}>Closes (optional)</label><input id={id+'-c'} type="datetime-local" value={closes} onChange={e=>{touch();setCloses(e.target.value)}}/></div>
  {error&&<p className="warning" role="alert">{error}</p>}
  <div className="poll-form-actions"><button className="soft-button" disabled={busy||!question.trim()||options.some(o=>!o.trim())}>{busy?'Posting…':'Post poll'}</button><button type="button" className="text-button" onClick={onClose}>Cancel</button></div>
 </form>
}
