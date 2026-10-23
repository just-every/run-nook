import {useEffect,useId,useState} from 'react'
import type {TeamRequest} from '../team/types'
type Value={enabled:number;base_url:string;model:string;daily_cap:number;version:number;hasKey:boolean;calls:number;state:string;provider:string}
// The owner's door for provider-generated clip transcripts: off until enabled, the key sealed and never shown again, the provider named as a subprocessor.
export function TranscriptSettings({request}:{request:TeamRequest}){
 const id=useId(),[value,setValue]=useState<Value|null>(null),[key,setKey]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false)
 useEffect(()=>{let live=true;void request<Value>('/api/transcripts/settings').then(v=>{if(live)setValue(v)}).catch(()=>{if(live)setNotice('Provider transcript settings could not be loaded')});return()=>{live=false}},[request])
 async function save(e:React.FormEvent,removeKey=false){
  e.preventDefault();if(!value)return;setBusy(true);setNotice('')
  try{setValue(await request<Value>('/api/transcripts/settings',{method:'POST',body:JSON.stringify({enabled:!!value.enabled&&!removeKey,model:value.model,baseUrl:value.base_url,dailyCap:value.daily_cap,version:value.version,...(removeKey?{key:null}:key?{key}:{})})}));setKey('');setNotice(removeKey?'The provider key was removed and provider transcripts are off.':'Provider transcript settings saved. The key is never shown again.')}
  catch(error){setNotice((error as Error).message)}finally{setBusy(false)}
 }
 return <section className="team-section integration-tokens" aria-labelledby={id+'-heading'}><h2 id={id+'-heading'}>Provider transcripts</h2>
  <p className="team-lead">Off until you enable it. When a clip's author or an owner or admin asks, that clip's audio is sent to the provider you choose below, as data only, to create a transcript. The provider is a subprocessor for clip audio: it receives nothing else and nothing before a request. A provider transcript is added as a new, labelled revision and never replaces a person's text. Restores turn this off and require a new key.</p>
  {value&&<form className="integration-create" onSubmit={e=>void save(e)}>
   <p role="status">{value.state} · {value.provider} · {value.calls} of {value.daily_cap} calls today</p>
   <label className="check"><input type="checkbox" checked={!!value.enabled} onChange={e=>setValue({...value,enabled:+e.target.checked})}/>Enable provider transcripts</label>
   <label className="field">Provider base URL<input type="url" required value={value.base_url} onChange={e=>setValue({...value,base_url:e.target.value})}/></label>
   <label className="field">Model ID<input required maxLength={120} value={value.model} onChange={e=>setValue({...value,model:e.target.value})}/></label>
   <label className="field">Provider key<input type="password" autoComplete="new-password" value={key} onChange={e=>setKey(e.target.value)} placeholder={value.hasKey?'Key stored · enter a replacement to rotate':'Supply a key to enable'}/></label>
   <label className="field">Daily call cap<input type="number" min={1} max={1000} value={value.daily_cap} onChange={e=>setValue({...value,daily_cap:Number(e.target.value)})}/></label>
   <p>Each attempted call uses one daily reservation, whether or not the provider answers. This is a cost control.</p>
   <button className="soft-button" disabled={busy}>Save provider transcript settings</button>
   {value.hasKey&&<button type="button" className="text-button" disabled={busy} onClick={e=>void save(e as unknown as React.FormEvent,true)}>Remove provider key</button>}
  </form>}<p role="status">{notice}</p></section>
}
