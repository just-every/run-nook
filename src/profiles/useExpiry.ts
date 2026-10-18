import {useEffect,useRef} from 'react'

/** Anchor the timer to the server's observation, including clients whose clocks
 * disagree. Long expiries are rearmed within the browser's timer range. */
export function useProfileExpiry(nextExpiry:number|null|undefined,observedAt:number|undefined,expire:()=>void){
 const callback=useRef(expire);callback.current=expire
 useEffect(()=>{
  if(nextExpiry==null||observedAt===undefined)return
  const started=Date.now(),remaining=nextExpiry-observedAt
  let timer:ReturnType<typeof setTimeout>
  const arm=()=>{const delay=remaining-(Date.now()-started);if(delay<=0){callback.current();return}timer=setTimeout(arm,Math.min(delay,2147483647))}
  arm()
  return()=>clearTimeout(timer)
 },[nextExpiry,observedAt])
}
