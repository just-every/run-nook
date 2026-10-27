import {createContext,useContext,useEffect,useState,type ReactNode} from 'react'
import {api} from '../chat/api'
type Availability='off'|'ready'|'capped'
type Value={state:Availability|null;refresh:()=>void}
const Context=createContext<Value>({state:null,refresh:()=>{}})
// One read shared by every AI surface for this private page lifetime. An owner
// changing the setting explicitly invalidates it; background refresh does not.
const reads=new WeakMap<AbortSignal,Promise<Availability>>()
export function AiAvailability({signal,children}:{signal:AbortSignal;children:ReactNode}){
 const [value,setValue]=useState<{signal:AbortSignal;state:Availability}|null>(null),[revision,setRevision]=useState(0)
 useEffect(()=>{
  let live=true
  if(signal.aborted)return
  let read=reads.get(signal)
  if(!read){read=api<{state:Availability}>('ai-search').then(value=>value.state).catch(()=> 'off' as const);reads.set(signal,read)}
  void read.then(state=>{if(live&&!signal.aborted)setValue({signal,state})})
  return()=>{live=false}
 },[signal,revision])
 return <Context.Provider value={{state:value?.signal===signal&&!signal.aborted?value.state:null,refresh:()=>{reads.delete(signal);setValue(null);setRevision(value=>value+1)}}}>{children}</Context.Provider>
}
export const useAiAvailability=()=>useContext(Context)
