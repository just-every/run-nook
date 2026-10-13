import {useEffect,useRef} from 'react'
import type {LocationState} from './types'
import {usePrivateScope} from './usePrivateScope'
// Store only DOM identity, never message text. Reload and history restore the same field.
export function useViewFocus(user:string,route:LocationState,ready:boolean,privateSignal:AbortSignal){
 const restored=useRef('')
 const key=`nook:focus:${user}:${route.view}:${route.conversation||''}:${route.thread||''}`
 // Invalidate accepted-view handlers during render, before effect cleanup.
 const isCurrent=usePrivateScope(privateSignal,ready?key:'')
 useEffect(()=>{
  if(!ready)return
  const save=(event:FocusEvent)=>{const el=event.target as HTMLElement;if(isCurrent()&&el.id)sessionStorage.setItem(key,el.id)}
  document.addEventListener('focusin',save);return ()=>document.removeEventListener('focusin',save)
 },[key,ready,isCurrent])
 useEffect(()=>{
  if(!isCurrent()||!ready){restored.current='';return}
  if(restored.current===key)return
  restored.current=key
  const target=sessionStorage.getItem(key)
  if(target&&!route.focus)document.getElementById(target)?.focus({preventScroll:true})
 },[key,ready,route.focus,isCurrent])
}
