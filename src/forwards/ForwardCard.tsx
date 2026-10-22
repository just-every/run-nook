import {useState} from 'react'
import {api} from '../chat/api'
import {SafeMarkdown} from '../chat/composition/SafeMarkdown'
export function ForwardCard({message}:{message:any}){
 const f=message.forward,[error,setError]=useState('');if(!f||f.tombstone)return null
 async function open(e:React.MouseEvent){e.preventDefault();try{const m:any=await api('forwards/'+message.id+'/source');window.location.assign('/app?conversation='+encodeURIComponent(m.conversation)+'&focus='+encodeURIComponent(m.id)+(m.parent?'&thread='+encodeURIComponent(m.parent):''))}catch{setError('Message unavailable')}}
 return <section className="forward-card" aria-label="Forwarded message"><p>Forwarded from {f.author}{f.name?' in '+f.name:''} · {new Date(f.created).toLocaleString()}</p>{f.mode==='show'?<div className="forward-body"><SafeMarkdown text={f.body??''}/></div>:<p>Link only · source access required</p>}<a href={'/api/forwards/'+message.id+'/source'} onClick={e=>void open(e)}>Open source</a>{error&&<p role="alert">{error}</p>}</section>
}
