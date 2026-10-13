import {useCallback,useEffect,useRef,useState} from 'react'
import {api,ApiError,projection,attentionPages,windowKey} from './api'
import {useAttentionWake} from './useAttentionWake'
import {usePrivateScope} from './usePrivateScope'
import type {Attention,Conversation,InitialWorkspace,LocationState,Person,Projection} from './types'
const emptyAttention:Attention={items:[],deferredCount:0,observedAt:0,dndUntil:null,nextWakeAt:null}
export function useWorkspace(initial:InitialWorkspace,route:LocationState) {
 const [user,setUser]=useState(initial.user),[attentionLoaded,setAttentionLoaded]=useState(false),[conversations,setConversations]=useState(initial.conversations),[users,setUsers]=useState<Person[]>([]),[data,setData]=useState<Projection|null>(null),[attention,setAttention]=useState<Attention>(emptyAttention),[error,setError]=useState(''),[loading,setLoading]=useState(false),[revision,setRevision]=useState(0),[connected,setConnected]=useState(false),[accessEpoch,setAccessEpoch]=useState(0)
 const current=useRef(route),cache=useRef<Projection|null>(null),generation=useRef(0),running=useRef<{signal:AbortSignal;promise:Promise<void>}|null>(null),again=useRef(false)
 const privateAccess=useRef({user:initial.user.id,controller:new AbortController()})
 // The live socket's 4001 close and a 401 response can both report a lost session;
 // a second replace would abort the first navigation, so leave once.
 const leaving=useRef(false)
 if(privateAccess.current.user!==initial.user.id){privateAccess.current.controller.abort();privateAccess.current={user:initial.user.id,controller:new AbortController()};generation.current++;cache.current=null}
 const privateSignal=privateAccess.current.controller.signal
 const conversationCurrent=usePrivateScope(privateSignal,`${initial.user.id}:${route.view}:${route.conversation||''}`)
 const threadCurrent=usePrivateScope(privateSignal,`${initial.user.id}:${route.view}:${route.conversation||''}:${route.thread||'root'}`)
 current.current=route
 const clearPrivate=useCallback(()=>{
  // Revoke captured callbacks synchronously, before deleting their storage.
  // A fresh render gets a new lifetime; old callbacks retain the aborted one.
  privateAccess.current.controller.abort();privateAccess.current.controller=new AbortController();generation.current++;again.current=false
  const ids=[current.current.conversation,cache.current?.conversation];cache.current=null
  for(const key of Object.keys(sessionStorage))if(key.startsWith('nook:')&&ids.some(id=>id&&key.includes(':'+id+':')))sessionStorage.removeItem(key)
  setConversations([]);setUsers([]);setData(null);setAttention(emptyAttention);setAttentionLoaded(false);setRevision(r=>r+1);setAccessEpoch(r=>r+1)
 },[])
 const onError=useCallback((e:unknown)=>{
  if(privateSignal.aborted)return
  if(e instanceof ApiError && e.status===401){if(leaving.current)return;leaving.current=true;clearPrivate();setConversations([]);setUsers([]);sessionStorage.clear();window.location.replace('/signin');return}
  if(e instanceof ApiError && e.status===403)clearPrivate()
  setError(e instanceof Error?e.message:'Something went wrong. Please try again.')
 },[clearPrivate,privateSignal])
 const refresh=useCallback(async():Promise<void>=>{
  if(privateSignal.aborted)return
  if(running.current){const previous=running.current;if(previous.signal===privateSignal){again.current=true;await previous.promise}else{await previous.promise;await refresh()}return}
  const task=async()=>{do{
   again.current=false;const epoch=generation.current
   try {
    const [list,people,inbox,me]=await Promise.all([api<Conversation[]>('conversations'),api<Person[]>('users'),attentionPages(),api<Person>('me')])
    if(privateSignal.aborted)return
    if(epoch!==generation.current)continue
    const allowed=new Set(list.map(c=>c.id))
    const named=await Promise.all(list.map(async c=>c.kind==='dm'?{...c,participants:await api<Person[]>(`conversations/${c.id}/roster`)}:c))
    if(privateSignal.aborted)return
    if(epoch!==generation.current)continue
    setUser(me);setConversations(named);setUsers(people);setAttention(inbox);setAttentionLoaded(true);setRevision(r=>r+1)
    if(cache.current&&!allowed.has(cache.current.conversation)){clearPrivate();setError('You no longer have access to this conversation.');return}
    const id=current.current.conversation
    if(!id)continue
    if(!allowed.has(id)){cache.current=null;setData(null);setError('This conversation is unavailable. Choose a conversation you can access.');continue}
    const routeSnapshot=current.current,previous=cache.current?.key===windowKey(routeSnapshot)?cache.current:null
    const activeConversation=list.find(c=>c.id===id)!
    const next=await projection(id,routeSnapshot,previous,activeConversation.readSeq,activeConversation.unread)
    if(privateSignal.aborted)return
    if(epoch!==generation.current||windowKey(current.current)!==next.key){again.current=true;continue}
    cache.current=next;setData(next)
   } catch(e){if(privateSignal.aborted)return;setAttentionLoaded(false);if(e instanceof ApiError&&e.status===404){cache.current=null;setData(null)}onError(e)}
  }while(again.current&&!privateSignal.aborted)}
  const pending={signal:privateSignal,promise:task()};running.current=pending
  try{await pending.promise}finally{if(running.current===pending)running.current=null;if(!privateSignal.aborted)setLoading(false)}
 },[onError,clearPrivate,privateSignal])
 useAttentionWake(attention.nextWakeAt,refresh)
 useEffect(()=>{if(privateSignal.aborted)return;generation.current++;cache.current=null;setData(null);setError('');setLoading(true);void refresh()},[initial.user.id,route.conversation,route.landing,refresh,privateSignal])
 useEffect(()=>{void refresh()},[route.view,route.thread,route.focus,route.before,route.threadBefore,route.landing,refresh])
 useEffect(()=>{
  let stopped=false,socket:WebSocket|undefined,reconnect:ReturnType<typeof setTimeout>|undefined,attempt=0
  const wake=()=>{if(!document.hidden)void refresh()}
  const connect=()=>{
   if(stopped||privateSignal.aborted)return
   socket=new WebSocket(`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}/api/live`)
   socket.onopen=()=>{if(privateSignal.aborted)return;attempt=0;setConnected(true);void refresh()}
   socket.onmessage=()=>{void refresh()}
   socket.onclose=event=>{if(!stopped&&!privateSignal.aborted){setConnected(false);if(event.code===4001){onError(new ApiError(401,'Sign in required'));return}if(event.code===4003){clearPrivate();setError('You no longer have access to this conversation.');return}void refresh();reconnect=setTimeout(connect,Math.min(30000,1000*2**attempt++))}}
   socket.onerror=()=>socket?.close()
  }
  connect();window.addEventListener('focus',wake);window.addEventListener('online',wake);document.addEventListener('visibilitychange',wake)
  return ()=>{stopped=true;clearTimeout(reconnect);socket?.close();window.removeEventListener('focus',wake);window.removeEventListener('online',wake);document.removeEventListener('visibilitychange',wake)}
 },[refresh,clearPrivate,onError,privateSignal])
 async function mutate<T>(path:string,input:unknown,method?:string):Promise<T>{try{if(privateSignal.aborted)throw Error('This workspace view is no longer active.');setError('');const result=await api<T>(path,input,method);if(privateSignal.aborted)throw Error('This workspace view is no longer active.');await refresh();if(privateSignal.aborted)throw Error('This workspace view is no longer active.');return result}catch(e){if(!privateSignal.aborted){onError(e);if(e instanceof ApiError&&e.status===409)await refresh()}throw e}}
 return {user,attentionLoaded,conversations,users,data:data===cache.current&&data?.key===windowKey(route)?data:null,attention,error,setError,loading,revision,accessEpoch,privateSignal,conversationCurrent,threadCurrent,connected,refresh,mutate,onError,clearPrivate}
}
