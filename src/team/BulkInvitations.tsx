import {useState} from 'react'
import type {TeamRequest} from './types'

type Preview={rows:{line:number;email:string;name:string;role:string;status:string;reason:string|null}[];counts:Record<string,number>;limit:number}
type Sent={sent:number;failed:{email:string;reason:string}[];remaining:number}
/** Many invitations through the ordinary one-use invitation door: preview first, then one action sends one per remaining address. */
export function BulkInvitations({request}:{request:TeamRequest}){
 const [csv,setCsv]=useState(''),[preview,setPreview]=useState<Preview|null>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState('')
 async function run(work:()=>Promise<void>){setBusy(true);setNotice('');try{await work()}catch(error){setNotice((error as Error).message)}finally{setBusy(false)}}
 const body=(extra:object={})=>JSON.stringify({csv,...extra})
 const review=()=>run(async()=>setPreview(await request<Preview>('/api/team/invitations/preview',{method:'POST',body:body()})))
 const send=()=>run(async()=>{
  let total=0;const failed:Sent['failed']=[]
  for(;;){
   const result=await request<Sent>('/api/team/invitations/bulk',{method:'POST',body:body({confirm:true})});total+=result.sent;failed.push(...result.failed)
   setNotice(`Sent ${total} invitation${total===1?'':'s'}${result.remaining?`; ${result.remaining} to go…`:'.'}`)
   if(!result.remaining||!result.sent)break
  }
  setNotice(`Sent ${total} invitation${total===1?'':'s'}.${failed.length?` ${failed.length} could not be sent: ${failed.slice(0,5).map(f=>f.email).join(', ')}.`:''}`)
  setPreview(await request<Preview>('/api/team/invitations/preview',{method:'POST',body:body()}))
 })
 const flagged=preview?preview.rows.filter(r=>r.status!=='ok'):[]
 return <div className="team-section"><h2>Invite many people</h2>
  <p>Paste one person per line as <code>email, name, role, channels</code> (role is member or guest; separate channels with a semicolon), or upload a CSV. Up to {1000} rows. Nothing is sent until you review the preview.</p>
  <label>Paste rows or upload a CSV<textarea rows={6} value={csv} onChange={e=>{setCsv(e.target.value);setPreview(null)}} maxLength={262144}/></label>
  <label>Upload a CSV file<input type="file" accept=".csv,text/csv,text/plain" onChange={async e=>{const file=e.target.files?.[0];if(file){setCsv(await file.text());setPreview(null)}e.target.value=''}}/></label>
  <button className="soft-button" disabled={busy||!csv.trim()} onClick={()=>void review()}>Preview invitations</button>
  {preview&&<section aria-label="Invitation preview"><p>{preview.counts.total} rows: {preview.counts.sendable} ready to send, {flagged.length} flagged.</p>
   {flagged.length>0&&<ul className="team-people">{flagged.map(r=><li key={r.line}><div className="team-person"><strong>Line {r.line}: {r.email||'(no address)'}</strong><small>{r.reason}</small></div></li>)}</ul>}
   <button className="soft-button" disabled={busy||!preview.counts.sendable} onClick={()=>void send()}>Send {preview.counts.sendable} invitation{preview.counts.sendable===1?'':'s'}</button></section>}
  {notice&&<p role="status">{notice}</p>}</div>
}
