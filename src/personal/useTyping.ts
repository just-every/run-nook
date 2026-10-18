import {useCallback,useEffect,useRef,useState} from 'react'
import {api} from '../chat/api'

type Options={conversation:string;user:string;signal:AbortSignal;enabled:boolean}
type TypingPerson={id:string;name:string;expiresAt:number}
type TypingResult={people:TypingPerson[];count:number;nextExpiry:number|null;observedAt:number}
function description(people:TypingPerson[],count:number){
 if(!people.length)return ''
 if(count===1)return `${people[0].name} is typing…`
 if(count===2)return `${people[0].name} and ${people[1].name} are typing…`
 return `${people[0].name}, ${people[1].name} and ${count-2} ${count===3?'other':'others'} are typing…`
}
export function useTyping({conversation,user,signal,enabled}:Options){
 const [label,setLabel]=useState(''),input=useRef<()=>void>(()=>{})
 useEffect(()=>{
  let active=true,polling=false,lastPost=-Infinity,announced=false
  let idle:ReturnType<typeof setTimeout>|undefined,expiry:ReturnType<typeof setTimeout>|undefined,interval:ReturnType<typeof setInterval>|undefined
  let serial=Promise.resolve()
  const page=crypto.randomUUID(),path=`conversations/${encodeURIComponent(conversation)}/typing`
  const showFailure=()=>{if(active&&!signal.aborted)setLabel('Typing updates unavailable.')}
  // Serialize the final clear behind an in-flight announcement so a slow
  // response cannot resurrect this page after its composer was closed.
  const post=(typing:boolean)=>{
   serial=serial.then(async()=>{
    if(typing&&(!active||signal.aborted))return
    try{await api(path,{page,typing})}catch{showFailure()}
   })
  }
  const stop=()=>{
   if(idle)clearTimeout(idle)
   if(announced){announced=false;post(false)}
  }
  const poll=async()=>{
   if(!active||signal.aborted||polling)return
   polling=true
   try{
    const result=await api<TypingResult>(path)
    if(!active||signal.aborted)return
    if(expiry)clearTimeout(expiry)
    setLabel(description(result.people,result.count))
    if(result.nextExpiry!==null)expiry=setTimeout(()=>{if(active&&!signal.aborted){setLabel('');void poll()}},Math.max(0,result.nextExpiry-result.observedAt))
   }catch{showFailure()}finally{polling=false}
  }
  input.current=()=>{
   if(!active||signal.aborted||!enabled||!conversation)return
   if(idle)clearTimeout(idle)
   idle=setTimeout(stop,5000)
   const now=Date.now()
   if(!announced||now-lastPost>=2000){lastPost=now;announced=true;post(true)}
  }
  if(!signal.aborted)setLabel('')
  const abort=()=>{active=false;input.current=()=>{};if(interval)clearInterval(interval);if(idle)clearTimeout(idle);if(expiry)clearTimeout(expiry);stop()}
  signal.addEventListener('abort',abort,{once:true})
  if(signal.aborted)abort()
  if(enabled&&conversation&&!signal.aborted){void poll();interval=setInterval(()=>void poll(),3000)}
  return()=>{active=false;input.current=()=>{};if(interval)clearInterval(interval);if(idle)clearTimeout(idle);if(expiry)clearTimeout(expiry);stop();signal.removeEventListener('abort',abort)}
 },[conversation,user,signal,enabled])
 const onInput=useCallback(()=>input.current(),[])
 return {onInput,label:signal.aborted||!enabled?'':label}
}
