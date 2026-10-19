import {useEffect,useRef,useState} from 'react'
import {useDismiss} from '../chat/useDismiss'
import {acceptHandoff,addOrigin,handoffUrl,host,installationOrigin,readList,receiveHandoff,recordCurrent,removeOrigin,type DeviceList,type Handoff} from './device-list'
import './workspaces.css'
export type DeviceWorkspaces={list:DeviceList;pending:Handoff|null;open:(origin:string)=>void;add:(address:string)=>boolean;remove:(origin:string)=>void;accept:()=>void;dismiss:()=>void}
// Links saved on the account by earlier Nook versions join this device's list once.
export function useDeviceWorkspaces(account:string,saved:string[]):DeviceWorkspaces{
 const [list,setList]=useState<DeviceList>({entries:[],removed:{}}),[pending,setPending]=useState<Handoff|null>(null)
 useEffect(()=>{recordCurrent(account);const received=receiveHandoff();setList(received.list);setPending(received.pending)},[account])
 useEffect(()=>{if(saved.length){for(const origin of saved)addOrigin(origin,{unlessRemoved:true});setList(readList())}},[saved.join('\n')])
 return {list,pending,
  open:origin=>location.assign(handoffUrl(origin)),
  add:address=>{const origin=installationOrigin(address);if(!origin)return false;setList(addOrigin(origin));if(origin===location.origin)return true;location.assign(handoffUrl(origin));return true},
  remove:origin=>setList(removeOrigin(origin)),
  accept:()=>{if(pending)setList(acceptHandoff(pending));setPending(null)},
  dismiss:()=>setPending(null)}
}
function WorkspaceList({device}:{device:DeviceWorkspaces}){
 const [address,setAddress]=useState(''),[error,setError]=useState('')
 return <div className="workspaces-list">
  <p className="workspaces-note">Kept on this device. Each workspace has its own sign-in, drafts and notifications.</p>
  <ul aria-label="Your workspaces">{device.list.entries.map(e=>{const current=e.origin===location.origin;return <li key={e.origin} className={current?'current':''}>
   {current?<span className="workspace-entry" aria-current="page"><strong>{host(e.origin)}</strong><small>This workspace{e.account?' · '+e.account:''}</small></span>
   :<a className="workspace-entry" href={e.origin+'/app'} onClick={event=>{event.preventDefault();device.open(e.origin)}}><strong>{host(e.origin)}</strong><small>{e.account?'Signed in as '+e.account:'Added on this device'}</small></a>}
   {!current&&<button type="button" className="text-button" onClick={()=>device.remove(e.origin)}>Remove<span className="sr-only"> {host(e.origin)}</span></button>}
  </li>})}</ul>
  <form className="workspace-add" onSubmit={event=>{event.preventDefault();setError(device.add(address)?'':'Enter a workspace address such as chat.example.com.')}}>
   <label className="field">Add a workspace<input value={address} placeholder="chat.example.com" autoComplete="url" onChange={event=>setAddress(event.target.value)}/></label>
   <button className="soft-button">Open</button>
  </form>
  <p role="status" className="workspaces-error">{error}</p>
 </div>
}
export function WorkspacesMenu({device}:{device:DeviceWorkspaces}){
 const menu=useRef<HTMLDetailsElement>(null)
 useDismiss(menu)
 return <details className="workspaces-menu menu" ref={menu}><summary className="soft-button">Your workspaces</summary><div className="popover workspaces-popover"><WorkspaceList device={device}/></div></details>
}
export function WorkspacesSection({device}:{device:DeviceWorkspaces}){
 return <section className="workspaces-section"><h2>Your workspaces</h2><WorkspaceList device={device}/></section>
}
// A fragment can come from any link, so installations this device never listed wait for the member.
export function WorkspaceHandoffPrompt({device}:{device:DeviceWorkspaces}){
 if(!device.pending)return null
 return <div className="workspace-handoff" role="region" aria-label="Add workspaces"><p>Add {device.pending.entries.length===1?'this workspace':'these workspaces'} from {host(device.pending.from)} to Your workspaces on this device?</p><ul>{device.pending.entries.map(e=><li key={e.origin}><strong>{host(e.origin)}</strong>{e.account&&<small> · {e.account}</small>}</li>)}</ul><div className="workspace-handoff-actions"><button className="soft-button" onClick={device.accept}>Add</button><button className="text-button" onClick={device.dismiss}>Not now</button></div></div>
}
