import {useEffect,useState} from 'react'
import {ImportJobs} from './ImportJobs'
async function api(path:string,body?:unknown,file?:File){
 const response=await fetch('/api/campfire-imports'+path,{method:body!==undefined||file?'POST':'GET',headers:file?{'Content-Type':'application/gzip'}:body!==undefined?{'Content-Type':'application/json'}:undefined,body:file??(body!==undefined?JSON.stringify(body):undefined)})
 const value=await response.json() as any;if(!response.ok)throw Error(value.error??'Import unavailable');return value
}
export function CampfireWizard({initial}:any){
 const [live,setLive]=useState(false);useEffect(()=>setLive(true),[])
 const [source,setSource]=useState<any>(null),[actors,setActors]=useState<Record<string,string|null>>({}),[namespace,setNamespace]=useState(''),[preview,setPreview]=useState<any>(null),[accepted,setAccepted]=useState(false)
 const [jobs,setJobs]=useState(initial.campfireJobs),[busy,setBusy]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState('')
 const work=async(action:()=>Promise<void>)=>{setBusy(true);setError('');try{await action()}catch(error){setError(error instanceof Error?error.message:'Import failed')}finally{setBusy(false)}}
 const refresh=async()=>setJobs((await api('')).jobs)
 const action=async(id:string,verb:string,fingerprint?:string)=>work(async()=>{
  let result=await api(`/${id}/${verb}`,{fingerprint})
  for(let previous=-1;!result.job&&result.files&&result.files.staged!==previous;){previous=result.files.staged;result=await api(`/${id}/apply`,{fingerprint})}
  for(let previous='';result.job&&!['completed','undone','rolled_back'].includes(result.job.state);){const progress=`${result.job.state}:${result.job.checkpoint}:${result.job.fence}`;if(progress===previous)break;previous=progress;result=await api(`/${id}/${['undoing','rolling_back'].includes(result.job.state)?'undo':'resume'}`,{})}
  setStatus(result.job?`Import ${result.job.state}: ${result.job.checkpoint} of ${result.job.total} source entries.`:`Files prepared: ${result.files.staged} of ${result.files.total}. Continue with Apply reviewed plan.`);await refresh()
 })
 const change=()=>{setPreview(null);setAccepted(false)}
 return <main className="imports-page"><header><a className="import-back" href="/app">← Back to conversations</a><p className="import-eyebrow">Workspace owner</p><h1>Bring your Campfire history into Nook</h1><p>Review a consistent Campfire backup, map its people, and keep every room’s original audience.</p><a href="/imports">Import Slack history</a></header>
  {error&&<p role="alert" className="import-error">{error}</p>}<p role="status" aria-live="polite">{busy?'Working on your reviewed import…':status}</p>
  <section><h2>1. Upload a consistent backup</h2><label>Campfire backup<input type="file" accept=".tar.gz,application/gzip" disabled={busy||!live} onChange={event=>{const file=event.target.files?.[0];if(file)void work(async()=>{const next=await api('/upload',undefined,file);setSource(next);setActors(Object.fromEntries(next.actors.map((a:any)=>[a.sourceId,null])));change();setStatus('Backup verified. Map every participant to an existing Nook member.')})}}/></label><p>Supported: official Campfire Express backup format 1, bootstrap schema. Rails backup layouts and other schemas are refused. Stop writes while taking the source backup, including its SQLite snapshot and uploads.</p><p>Original files up to 16 MiB retain their source MIME type and exact bytes. No source password, session or source role grants access to Nook.</p><a href="/docs/campfire-import">Backup format and migration guide</a></section>
  {source&&<section><h2>2. Map identities and review audiences</h2><p>Source: {source.source.implementation} · format {source.source.format}. Every room is included. Closed rooms and DMs keep their mapped participant sets; the importing owner receives no extra membership.</p>
   <label>Source namespace<input value={namespace} disabled={busy} onChange={event=>{setNamespace(event.target.value);change()}} placeholder="campfire-team"/></label>
   {source.actors.map((actor:any)=><label key={actor.sourceId}>{actor.label} · {actor.participant?'room participant':'historical author'}<select aria-label={'Map '+actor.label} disabled={busy} value={actors[actor.sourceId]??''} onChange={event=>{setActors({...actors,[actor.sourceId]:event.target.value||null});change()}}><option value="">{actor.participant?'Choose an existing full member':'Keep as an external historical author'}</option>{source.users.filter((u:any)=>u.active&&u.mode==='member').map((u:any)=><option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}</select></label>)}
   <ul>{source.channels.map((room:any)=><li key={room.sourceId}><strong>{room.name}</strong> · {room.kind} · {room.sourceMembers.map((id:string)=>source.actors.find((a:any)=>a.sourceId===id)?.label??id).join(', ')}</li>)}</ul>
   <button disabled={busy||!namespace||source.actors.some((a:any)=>a.participant&&!actors[a.sourceId])} onClick={()=>void work(async()=>{const next=await api('/preview',{upload:source.upload,review:{namespace,actors,acceptedOmissions:accepted&&preview?[preview.omissionDigest]:[]}});setPreview(next);setStatus(next.needsOmissionReview?'Review the exact omissions and preview again.':'The exact plan is ready for approval.');await refresh()})}>Preview exact import</button>
  </section>}
  {preview&&<section><h2>3. Approve the historical import</h2><dl className="import-counts">{Object.entries(preview.counts).map(([name,count])=><div key={name}><dt>{name}</dt><dd>{String(count)}</dd></div>)}</dl><p>Historical messages keep original authors, times and file relationships. They create no unread activity, notifications or accepted work. This source version supplies no native reply relationship; none is invented.</p>
   <h3>Original files</h3><ul className="import-omissions">{preview.fileHashes.map((file:any)=><li key={file.key+file.sourceId}><strong>{file.name}</strong><span>{file.size} bytes · {file.mime}</span><code>SHA-256 {file.sha256}</code></li>)}</ul>
   {!!preview.omissions.length&&<><h3>Named omissions</h3><ul className="import-omissions">{preview.omissions.map((item:any,index:number)=><li key={index}><span>{item.kind}: {item.reason}</span><code>{item.key}</code></li>)}</ul><label className="import-check"><input type="checkbox" checked={accepted} disabled={busy} onChange={event=>setAccepted(event.target.checked)}/>I reviewed and accept these exact omissions</label></>}
   {preview.fingerprint&&<><p>Review binds this backup, identity mapping, audiences and file hashes.</p><button className="import-primary" disabled={busy} onClick={()=>void action(preview.review,'apply',preview.fingerprint)}>Apply reviewed plan</button></>}
  </section>}
  <ImportJobs jobs={jobs} busy={busy} onAction={action} onRefresh={()=>work(refresh)} onCleanup={()=>work(async()=>{await api('/cleanup',{});await refresh()})} onRelease={id=>work(async()=>{await api(`/uploads/${id}`,{});await refresh()})} onReviewAgain={id=>work(async()=>{const result=await api(`/${id}/review`,{});setSource(result.source);setActors(result.review.actors);setNamespace(result.review.namespace);change()})}/>
 </main>
}
