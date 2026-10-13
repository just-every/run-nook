import {createContext,useCallback,useContext,useRef} from 'react'
import {ApiError} from '../chat/api'
import type {TeamRequest} from './types'
type Bindings={request:TeamRequest;accessEpoch:number;revision:number;onDenied:()=>void}
export const TeamBindings=createContext<Bindings|null>(null)
export function useTeamBindings(){const value=useContext(TeamBindings);if(!value)throw Error('Team bindings unavailable');return value}
export function useTeamRequest(accessEpoch:number,onError:(error:unknown)=>void):TeamRequest{
 const current=useRef(accessEpoch);current.current=accessEpoch
 return useCallback(async<T,>(path:string,init:RequestInit={})=>{
  const epoch=current.current
  try{
   const headers=new Headers(init.headers);if(init.body)headers.set('Content-Type','application/json')
   const response=await fetch(path,{...init,headers,credentials:'same-origin',cache:'no-store'})
   const value=await response.json() as T & {error?:string}
   if(epoch!==current.current)throw new DOMException('Access changed','AbortError')
   if(!response.ok)throw new ApiError(response.status,value.error||'The request could not be completed.')
   return value
  }catch(error){if(!(error instanceof DOMException&&error.name==='AbortError'))onError(error);throw error}
 },[onError])
}
