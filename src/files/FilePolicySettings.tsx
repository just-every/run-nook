import {useEffect,useId,useState} from 'react'
import type {TeamRequest} from '../team/types'
type Policy={version:number;maxBytes:number;blockedExtensions:string[]}
export function FilePolicySettings({request}:{request:TeamRequest}){
 const id=useId(),[value,setValue]=useState<Policy|null>(null),[extensions,setExtensions]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('')
 const load=async()=>{try{const next=await request<Policy>('/api/team/file-policy');setValue(next);setExtensions(next.blockedExtensions.join('\n'));setError('')}catch(e){setError((e as Error).message)}}
 useEffect(()=>{void load()},[request])
 const save=async(event:React.FormEvent)=>{event.preventDefault();if(!value)return;setBusy(true);setNotice('');setError('');try{const next=await request<Policy>('/api/team/file-policy',{method:'PATCH',body:JSON.stringify({...value,blockedExtensions:extensions.split(/[\s,]+/).filter(Boolean)})});setValue(next);setExtensions(next.blockedExtensions.join('\n'));setNotice('File policy saved.')}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <section className="team-section file-policy" aria-labelledby={id+'-heading'}><h2 id={id+'-heading'}>File policy</h2>
 <p>Owners set the size and file extensions accepted for new files. Existing files stay available. Scanning and quarantine are not available, and no file is marked scanned, clean or safe.</p>
 <p>While this policy is restricted, history-import uploads are refused before storing their embedded bytes. Uploads already in progress must finish or be reconciled before you change this policy.</p>
 {value&&<form className="integration-create" onSubmit={e=>void save(e)}>
 <div className="field"><label htmlFor={id+'-size'}>Maximum file size (MiB)</label><input id={id+'-size'} type="number" min={1/1048576} max={25} step="any" required value={value.maxBytes/1048576} onChange={e=>setValue({...value,maxBytes:Math.round(Number(e.target.value)*1048576)})}/></div>
 <div className="field"><label htmlFor={id+'-extensions'}>Blocked file extensions</label><textarea id={id+'-extensions'} rows={3} maxLength={1700} value={extensions} onChange={e=>setExtensions(e.target.value)} placeholder="exe\nzip"/></div>
 <p>Enter extensions separated by spaces, commas or new lines. Matching ignores case and includes compound extensions such as tar.gz.</p>
 <div className="profile-row"><button className="soft-button" disabled={busy}>Save file policy</button><button type="button" className="text-button" disabled={busy} onClick={()=>void load()}>Reload file policy</button></div>
 </form>}{notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}</section>
}
