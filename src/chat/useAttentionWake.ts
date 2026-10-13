import {useEffect} from 'react'

// The server supplies the earliest authorized deadline, including hidden items.
// A response schedules at most one wake. The refreshed response owns the next one.
export function useAttentionWake(nextWakeAt:number|null,refresh:()=>Promise<void>){
 useEffect(()=>{
  if(nextWakeAt===null)return
  const timeout=setTimeout(()=>{
   // Visibility/focus catch-up in useWorkspace will refresh on return. Do not
   // turn a throttled background timer into an unread/read side effect.
   if(!document.hidden)void refresh()
  },Math.max(0,nextWakeAt-Date.now()))
  return ()=>clearTimeout(timeout)
 },[nextWakeAt,refresh])
}
