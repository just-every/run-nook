import {useEffect,useState} from 'react'
export type WorkspaceExportPolicy={enabled:boolean;version:number;canManage:boolean;announcement?:{version:number;enabled:number;created:string}|null;actions?:{version:number;enabled:number;actor:string|null;actorName:string|null;created:string;recipients:number}[]}
export function OwnerExportPolicy({policy,busy,onChange}:{policy:WorkspaceExportPolicy;busy:boolean;onChange:(enabled:boolean)=>void}){
 const [enabled,setEnabled]=useState(policy.enabled)
 useEffect(()=>setEnabled(policy.enabled),[policy.enabled,policy.version])
 if(!policy.canManage)return null
 return <details><summary>Owner workspace export policy</summary>
  <p>Enabling this policy allows current owners to export every published conversation, including private channels and other people’s DMs. Members and admins keep their existing conversation access. Protected held copies and credentials remain excluded.</p>
  <label className="readable-export-ack"><input type="checkbox" checked={enabled} disabled={busy} onChange={event=>setEnabled(event.target.checked)}/>Allow owners to export the whole workspace, including private conversations</label>
  <button className="soft-button" disabled={busy||enabled===policy.enabled} onClick={()=>onChange(enabled)}>Save workspace export policy</button>
  {!!policy.actions?.length&&<details><summary>Recent workspace export policy changes</summary><ul>{policy.actions.map(action=><li key={action.created+action.version}>Version {action.version}: {action.enabled?'enabled':'disabled'} by {action.actorName??'Former owner'} at <time>{action.created}</time>; announced to {action.recipients} members.</li>)}</ul></details>}
  <p className="muted">Disabled by default. Changing this policy ends access to earlier workspace jobs; a new export requires the current policy version. An owner must explicitly enable it again after an operational restore.</p>
 </details>
}
