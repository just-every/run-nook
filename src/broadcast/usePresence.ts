import {useEffect} from 'react'
import {api} from '../chat/api'
export function useBroadcastPresence(user:string,signal:AbortSignal){
 useEffect(()=>{
  const page=crypto.randomUUID(),zone=Intl.DateTimeFormat().resolvedOptions().timeZone
  const beat=()=>{if(!signal.aborted)void api('broadcast/presence',{page,visible:document.visibilityState==='visible',zone}).catch(()=>{})}
  beat();const timer=window.setInterval(beat,60000);document.addEventListener('visibilitychange',beat)
  return()=>{window.clearInterval(timer);document.removeEventListener('visibilitychange',beat);if(!signal.aborted)void api('broadcast/presence',{page,visible:false,zone}).catch(()=>{})}
 },[user,signal])
}
