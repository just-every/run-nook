import {useCallback,useEffect,useRef,useState} from 'react'
import {api,ApiError,workspace,sendWorkspace,completeSnapshot,windowKey} from './api'
import {useAttentionWake} from './useAttentionWake'
import {usePrivateScope} from './usePrivateScope'
import {clearPushNotices} from '../push/notices'
import {clearConversationDrafts,clearUserDrafts} from './drafts'
import type {Attention,InitialWorkspace,LocationState,Person,Projection,WorkspaceSnapshot,ReadAcknowledgement} from './types'
const emptyAttention:Attention={items:[],deferredCount:0,observedAt:0,dndUntil:null,nextWakeAt:null}
export function useWorkspace(initial:InitialWorkspace,route:LocationState,navigate:(next:Partial<LocationState>,replace?:boolean)=>void) {
 const [user,setUser]=useState(initial.user),[attentionLoaded,setAttentionLoaded]=useState(false),[conversations,setConversations]=useState(initial.conversations),[users,setUsers]=useState<Person[]>([]),[data,setData]=useState<Projection|null>(null),[attention,setAttention]=useState<Attention>(emptyAttention),[error,setError]=useState(''),[loading,setLoading]=useState(false),[revision,setRevision]=useState(0),[connected,setConnected]=useState(false),[accessEpoch,setAccessEpoch]=useState(0)
 const [snapshot,setSnapshot]=useState<WorkspaceSnapshot|null>(null)
 const latest=useRef(initial.snapshot??null),bootstrap=useRef<WorkspaceSnapshot|null>(null),preparedRoute=useRef<string|null>(null),bootstrapped=useRef(false),writes=useRef(0),hints=useRef(new Map<string,number>())
 const current=useRef(route),cache=useRef<Projection|null>(null),generation=useRef(0),running=useRef<{signal:AbortSignal;promise:Promise<void>}|null>(null),again=useRef(false)
 const privateAccess=useRef({user:initial.user.id,controller:new AbortController()})
 // The live socket's 4001 close and a 401 response can both report a lost session;
 // a second replace would abort the first navigation, so leave once.
 const leaving=useRef(false),socketReady=useRef(false)
 if(privateAccess.current.user!==initial.user.id){privateAccess.current.controller.abort();privateAccess.current={user:initial.user.id,controller:new AbortController()};generation.current++;cache.current=null}
 const privateSignal=privateAccess.current.controller.signal
 const conversationCurrent=usePrivateScope(privateSignal,`${initial.user.id}:${route.view}:${route.conversation||''}`)
 const threadCurrent=usePrivateScope(privateSignal,`${initial.user.id}:${route.view}:${route.conversation||''}:${route.thread||'root'}`)
 current.current=route
 const clearPrivate=useCallback(()=>{
  // Revoke captured callbacks synchronously, before deleting their storage.
  // A fresh render gets a new lifetime; old callbacks retain the aborted one.
  privateAccess.current.controller.abort();privateAccess.current.controller=new AbortController();generation.current++;again.current=false;hints.current.clear();latest.current=null
  const ids=[current.current.conversation,cache.current?.conversation];cache.current=null
  clearConversationDrafts(initial.user.id,ids.filter((id):id is string=>Boolean(id)))
  for(const key of Object.keys(sessionStorage))if(key.startsWith('nook:')&&ids.some(id=>id&&key.includes(':'+id+':')))sessionStorage.removeItem(key)
  setSnapshot(null);setConversations([]);setUsers([]);setData(null);setAttention(emptyAttention);setAttentionLoaded(false);setRevision(r=>r+1);setAccessEpoch(r=>r+1)
 },[])
 const onError=useCallback((e:unknown)=>{
  if(privateSignal.aborted)return
  if(e instanceof ApiError && e.status===401){if(leaving.current)return;leaving.current=true;clearUserDrafts(initial.user.id);clearPrivate();setConversations([]);setUsers([]);sessionStorage.clear();void clearPushNotices().finally(()=>window.location.replace('/signin'));return}
  if(e instanceof ApiError && e.status===403)clearPrivate()
  setError(e instanceof Error?e.message:'Something went wrong. Please try again.')
 },[clearPrivate,privateSignal])
 const refresh=useCallback(async():Promise<void>=>{
  if(privateSignal.aborted)return
  if(running.current){const previous=running.current;if(previous.signal===privateSignal){again.current=true;await previous.promise}else{await previous.promise;await refresh()}return}
  const task=async()=>{do{
   // Route changes and same-frame live hints share the read that starts after
   // React has committed navigation. Later invalidations still request a pass.
   await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()))
   if(privateSignal.aborted)return
   again.current=false;const epoch=generation.current
   try {
    const routeSnapshot=current.current,previous=cache.current?.key===windowKey(routeSnapshot)?cache.current:null
    const nextSnapshot=await workspace(routeSnapshot,previous)
    if(privateSignal.aborted)return
    if(epoch!==generation.current)continue
    const {user:me,conversations:list,users:people,attention:inbox,data:next}=nextSnapshot,allowed=new Set(list.map(c=>c.id))
    for(const [id,frontier] of hints.current){const item=list.find(c=>c.id===id);if(!item||item.seq>=frontier&&(next?.conversation!==id||next.frontier>=frontier))hints.current.delete(id);else again.current=true}
    latest.current=nextSnapshot;setSnapshot(nextSnapshot);setUser(me);setConversations(list);setUsers(people);setAttention(inbox);setAttentionLoaded(true);setRevision(r=>r+1)
    if(cache.current&&!allowed.has(cache.current.conversation)){clearPrivate();setError('You no longer have access to this conversation.');return}
    const id=current.current.conversation
    if(!id)continue
    if(!allowed.has(id)){cache.current=null;setData(null);setError('This conversation is unavailable. Choose a conversation you can access.');continue}
    if(nextSnapshot.dataError){cache.current=null;setData(null);setAttentionLoaded(false);onError(new ApiError(nextSnapshot.dataError.status,nextSnapshot.dataError.message));continue}
    if(!next||windowKey(current.current)!==next.key){again.current=true;continue}
    cache.current=next;setData(next)
   } catch(e){if(privateSignal.aborted)return;setAttentionLoaded(false);if(e instanceof ApiError&&e.status===404){cache.current=null;setData(null)}onError(e)}
  }while(again.current&&!privateSignal.aborted)}
  const pending={signal:privateSignal,promise:task()};running.current=pending
  try{await pending.promise}finally{if(running.current===pending)running.current=null;if(!privateSignal.aborted)setLoading(false)}
 },[onError,clearPrivate,privateSignal])
 const beginWrite=useCallback(()=>{
  writes.current++
  return ()=>{writes.current=Math.max(0,writes.current-1);if(!privateSignal.aborted&&!writes.current&&(again.current||hints.current.size)&&!running.current)void refresh()}
 },[refresh,privateSignal])
 async function sendMessage(input:unknown){
  const previous=current.current,positioned=Boolean(previous.before||previous.threadBefore||previous.focus),nextRoute={...previous,landing:false,before:null,threadBefore:null,focus:null},epoch=++generation.current
  setError('');again.current=false
  const next=await sendWorkspace(nextRoute,input)
  if(privateSignal.aborted||epoch!==generation.current||JSON.stringify(current.current)!==JSON.stringify(previous))return
  if(next.dataError)throw new ApiError(next.dataError.status,next.dataError.message)
  for(const [id,frontier] of hints.current){const item=next.conversations.find(c=>c.id===id);if(!item||item.seq>=frontier&&(next.data?.conversation!==id||next.data.frontier>=frontier))hints.current.delete(id)}
  latest.current=next;cache.current=next.data;setSnapshot(next);setUser(next.user);setConversations(next.conversations);setUsers(next.users);setAttention(next.attention);setAttentionLoaded(true);setData(next.data);setLoading(false);setRevision(r=>r+1)
  if(positioned||previous.landing){preparedRoute.current=JSON.stringify(nextRoute);navigate(nextRoute,!positioned&&previous.landing)}
 }
 const onRead=useCallback(async(ack:ReadAcknowledgement)=>{
  if(privateSignal.aborted||ack.user!==initial.user.id)return
  const previous=latest.current
  if(!previous)return
  const list=ack.conversations.map(c=>({...c,...(c.kind==='dm'?{participants:previous.conversations.find(old=>old.id===c.id)?.participants}:{} )}))
  if(cache.current?.conversation===ack.conversation){const readSeq=list.find(c=>c.id===ack.conversation)?.readSeq??0;const next={...cache.current,rootWindow:{...cache.current.rootWindow,readSeq:Math.max(cache.current.rootWindow.readSeq,readSeq)},threadWindow:cache.current.threadWindow?{...cache.current.threadWindow,readSeq:Math.max(cache.current.threadWindow.readSeq,readSeq)}:null};cache.current=next;setData(next)}
  latest.current={...previous,conversations:list,pushSync:ack.pushSync};setConversations(list);setSnapshot(latest.current)
 },[initial.user.id,privateSignal])
 useAttentionWake(attention.nextWakeAt,refresh)
 useEffect(()=>{
  // A revoked scope must never rehydrate its old document snapshot when its
  // AbortSignal changes. Only a new loader result may bootstrap again.
  if(!initial.snapshot||bootstrap.current===initial.snapshot)return
  bootstrap.current=initial.snapshot
  const epoch=generation.current
  void completeSnapshot(initial.snapshot).then(next=>{if(privateSignal.aborted||epoch!==generation.current)return;latest.current=next;cache.current=next.data;setSnapshot(next);setUser(next.user);setConversations(next.conversations);setUsers(next.users);setAttention(next.attention);setAttentionLoaded(true);setData(next.data);setLoading(false);if(initial.route?.conversation&&!next.conversations.some(c=>c.id===initial.route?.conversation))setError('This conversation is unavailable. Choose a conversation you can access.');else if(next.dataError)setError(next.dataError.message)}).catch(onError)
 },[initial.snapshot,privateSignal,onError])
 useEffect(()=>{
  if(privateSignal.aborted)return
  if(preparedRoute.current===JSON.stringify(route)){preparedRoute.current=null;return}
  preparedRoute.current=null
  if(!bootstrapped.current&&initial.snapshot&&JSON.stringify(route)===JSON.stringify(initial.route)){
   bootstrapped.current=true
   if(!(route.view==='chat'&&route.landing&&window.matchMedia('(max-width: 850px)').matches&&initial.conversations.some(c=>c.id===route.conversation&&c.unread>0)))return
  }
  generation.current++;setError('');setLoading(true);void refresh()
 },[initial.user.id,route.view,route.conversation,route.thread,route.focus,route.before,route.threadBefore,route.landing,refresh,privateSignal])
 useEffect(()=>{
  let stopped=false,socket:WebSocket|undefined,reconnect:ReturnType<typeof setTimeout>|undefined,attempt=0
  const wake=()=>{if(!document.hidden)void refresh()}
  const connect=()=>{
   if(stopped||privateSignal.aborted)return
   socket=new WebSocket(`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}/api/live`)
   socket.onopen=()=>{if(privateSignal.aborted)return;attempt=0;socketReady.current=true;setConnected(true)}
   socket.onmessage=event=>{const hint=JSON.parse(event.data);if(hint.type==='ready'){const snapshot=latest.current,same=snapshot&&snapshot.signature===hint.signature&&snapshot.conversations.length===hint.conversations.length&&(!snapshot.data||!hint.conversations.some((c:{id:string;seq:number})=>c.id===snapshot.data?.conversation&&c.seq>snapshot.data.frontier))&&hint.conversations.every((c:{id:string;seq:number})=>snapshot.conversations.some(old=>old.id===c.id&&old.seq===c.seq));if(!same)void refresh();return}if(typeof hint.conversation==='string'&&Number.isSafeInteger(hint.frontier)){hints.current.set(hint.conversation,Math.max(hints.current.get(hint.conversation)??0,hint.frontier));if(!writes.current&&!running.current)void refresh()}else if(writes.current)again.current=true;else void refresh()}
   socket.onclose=event=>{if(!stopped&&!privateSignal.aborted){socketReady.current=false;setConnected(false);if(event.code===4001){onError(new ApiError(401,'Sign in required'));return}if(event.code===4003){clearPrivate();setError('You no longer have access to this conversation.');return}void refresh();reconnect=setTimeout(connect,Math.min(30000,1000*2**attempt++))}}
   socket.onerror=()=>socket?.close()
  }
  connect();window.addEventListener('focus',wake);window.addEventListener('online',wake);document.addEventListener('visibilitychange',wake)
  return ()=>{stopped=true;socketReady.current=false;clearTimeout(reconnect);socket?.close();window.removeEventListener('focus',wake);window.removeEventListener('online',wake);document.removeEventListener('visibilitychange',wake)}
 },[refresh,clearPrivate,onError,privateSignal])
 async function mutate<T>(path:string,input:unknown,method?:string):Promise<T>{const end=beginWrite();try{if(privateSignal.aborted)throw Error('This workspace view is no longer active.');setError('');const result=await api<T>(path,input,method);if(privateSignal.aborted)throw Error('This workspace view is no longer active.');await refresh();if(privateSignal.aborted)throw Error('This workspace view is no longer active.');return result}catch(e){if(!privateSignal.aborted){onError(e);if(e instanceof ApiError&&e.status===409)await refresh()}throw e}finally{end()}}
 return {snapshot,user,attentionLoaded,conversations,users,data:data===cache.current&&data?.key===windowKey(route)?data:null,attention,error,setError,loading,revision,accessEpoch,privateSignal,conversationCurrent,threadCurrent,connected,refresh,beginWrite,sendMessage,onRead,mutate,onError,clearPrivate}
}
