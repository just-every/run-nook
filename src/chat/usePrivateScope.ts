import {useCallback,useEffect,useLayoutEffect,useMemo,useRef} from 'react'

// Commit-time only: a render React discards must not retire the committed scope.
const useCommitEffect=typeof window==='undefined'?useEffect:useLayoutEffect

// A local cache lifetime, not an authorization decision. The server still
// checks every request. Old handlers cannot adopt a replacement scope/signal.
export function usePrivateScope(signal:AbortSignal,scope:string){
 const token=useMemo(()=>({signal,scope}),[signal,scope])
 const current=useRef(token)
 useCommitEffect(()=>{current.current=token},[token])
 return useCallback(()=>!signal.aborted&&current.current===token,[signal,token])
}
