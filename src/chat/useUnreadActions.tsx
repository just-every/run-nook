import {useEffect,useState} from 'react'
import {api} from './api'
export function useUnreadActions(signal:AbortSignal,refresh:()=>Promise<void>,onError:(e:unknown)=>void){
 const [operation,setOperation]=useState<{token:string;expires:number;count:number}|null>(null),[busy,setBusy]=useState(false)
 useEffect(()=>{if(!operation)return;const timer=setTimeout(()=>setOperation(null),Math.max(0,operation.expires-Date.now()));return()=>clearTimeout(timer)},[operation])
 useEffect(()=>{setOperation(null)},[signal])
 const act=async(input:unknown)=>{setBusy(true);try{const value=await api<{token:string;expires:number;count:number}>('unreads',input);if(!signal.aborted){setOperation(value.token&&value.count?value:null);await refresh()}}catch(e){if(!signal.aborted)onError(e)}finally{if(!signal.aborted)setBusy(false)}}
 return {busy,mark:(conversation?:string)=>void act({action:'read',...(conversation?{conversation}:{})}),notice:operation?<div className="read-undo" role="status"><span>{operation.count} {operation.count===1?'conversation':'conversations'} marked read.</span><button className="soft-button" disabled={busy} onClick={()=>void act({action:'undo',token:operation.token})}>Undo mark read</button></div>:null}
}
