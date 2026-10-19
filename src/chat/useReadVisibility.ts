import {useEffect,useRef} from 'react'
import {api} from './api'
import type {MessageWindow,ReadAcknowledgement} from './types'
type ReadProgress={conversation:string;user:string;isCurrent:()=>boolean;seen:Set<string>;inflight:boolean;sent:number;active:boolean;inspect:(()=>void)|null}
// A loaded item is not read. Outside-window barriers come from the server; the
// viewport check further narrows that bound. Own sends never advance a cursor.
export function useReadVisibility(container:React.RefObject<HTMLElement|null>,conversation:string,window:MessageWindow,user:string,enabled:boolean,isCurrent:()=>boolean,onRead:(ack:ReadAcknowledgement)=>Promise<void>,onError:(e:unknown)=>void,threadRead?:{thread:string;onRead:()=>Promise<void>}){
 if(threadRead)window={...window,readSeq:window.threadReadSeq??window.readSeq,readThrough:window.threadReadThrough??window.readThrough,readBarrierSeq:null}
 const progress=useRef<ReadProgress|null>(null)
 if(!progress.current||progress.current.conversation!==conversation||progress.current.user!==user||progress.current.isCurrent!==isCurrent)progress.current={conversation,user,isCurrent,seen:new Set(),inflight:false,sent:0,active:true,inspect:null}
 const scope=progress.current
 useEffect(()=>{scope.active=true;return()=>{scope.active=false}},[scope])
 useEffect(()=>{
  const root=container.current;if(!root||!enabled)return
  let frame=0,disposed=false
  const messages=[...(window.root?[window.root]:[]),...window.items].filter(m=>!m.immutable||m.retainedSource==='native').sort((a,b)=>a.sequence-b.sequence)
  const retained=new Set(messages.map(m=>m.id));scope.seen=new Set([...scope.seen].filter(id=>retained.has(id)))
  const inspect=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
   if(disposed||!isCurrent()||progress.current!==scope||!scope.active||document.hidden||scope.inflight)return
   const bounds=root.getBoundingClientRect();if(bounds.height===0||bounds.width===0)return
   for(const element of root.querySelectorAll<HTMLElement>('[data-message]')){
    const b=element.getBoundingClientRect(),visible=Math.min(b.bottom,bounds.bottom,innerHeight)-Math.max(b.top,bounds.top,0)
    if(b.height>0&&visible>=Math.min(b.height,100)*.8)scope.seen.add(element.dataset.message!)
   }
   let frontier=Math.max(window.readSeq,scope.sent)
   for(const m of messages){
    if(m.sequence<=frontier||m.author===user)continue
    if(!scope.seen.has(m.id))break
    frontier=m.sequence
   }
   frontier=Math.min(frontier,window.readThrough,window.readBarrierSeq===null?Infinity:window.readBarrierSeq-1)
   if(frontier<=Math.max(window.readSeq,scope.sent))return
   scope.inflight=true
   // A late response belongs to its original identity/conversation. It may
   // acknowledge that server read, but cannot change a replacement scope.
   const current=()=>isCurrent()&&progress.current===scope&&scope.active
   // Only a successful acknowledgement can drain the next visible frontier.
   // A refused write must not schedule another identical request.
   let acknowledged=false
   void api<ReadAcknowledgement>(threadRead?`messages/${threadRead.thread}/read`:`conversations/${conversation}/read`,{seq:frontier,...(threadRead?{conversation}:{})}).then(ack=>{if(current()){acknowledged=true;scope.sent=Math.max(scope.sent,frontier);return threadRead?threadRead.onRead():onRead(ack)}}).catch(error=>{if(current())onError(error)}).finally(()=>{if(current()){scope.inflight=false;if(acknowledged)scope.inspect?.()}})
  })}
  // The list can still be laying out on the first check; check again whenever its size settles.
  const resized=new ResizeObserver(inspect);resized.observe(root)
  scope.inspect=inspect;inspect();root.addEventListener('scroll',inspect);globalThis.addEventListener('resize',inspect);globalThis.addEventListener('focus',inspect);document.addEventListener('visibilitychange',inspect)
  return ()=>{disposed=true;resized.disconnect();if(scope.inspect===inspect)scope.inspect=null;cancelAnimationFrame(frame);root.removeEventListener('scroll',inspect);globalThis.removeEventListener('resize',inspect);globalThis.removeEventListener('focus',inspect);document.removeEventListener('visibilitychange',inspect)}
 },[container,conversation,window,user,enabled,isCurrent,onRead,onError,scope])
}
