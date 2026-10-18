import {useCallback,useEffect,useRef,useState} from 'react'
import type {TeamRequest} from '../team/types'
import {clearPushNotices} from './notices'
import type {WorkspaceSnapshot} from '../chat/types'
export type Choices={broadcasts:boolean;mentions:boolean;urgent:boolean;urgentQuiet:boolean;direct:boolean;threads:boolean}
export type PushSettings=Choices&{problems:{error:string;state:string}[];notDelivered:{recipient:string;error:string}[];workspace:{count:number;error:string|null;state:string|null}|null}
const decode=(value:string)=>Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0))
const STORE='nook.push.device'
const supported=()=>typeof window!=='undefined'&&'serviceWorker'in navigator&&'PushManager'in window&&'Notification'in window
export function usePush(user:string,request:TeamRequest,snapshot:WorkspaceSnapshot|null,privateSignal:AbortSignal){
 const [settings,setSettings]=useState<PushSettings|null>(null),[permission,setPermission]=useState<NotificationPermission|'unsupported'>('unsupported'),[enabled,setEnabled]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 const [install,setInstall]=useState<any>(null),[standalone,setStandalone]=useState(false)
 useEffect(()=>{const show=(event:Event)=>{event.preventDefault();setInstall(event)};const installed=()=>{setStandalone(true);setInstall(null)};setStandalone(matchMedia('(display-mode: standalone)').matches);window.addEventListener('beforeinstallprompt',show);window.addEventListener('appinstalled',installed);return()=>{window.removeEventListener('beforeinstallprompt',show);window.removeEventListener('appinstalled',installed)}},[])
 const device=useRef<string|null>(null),registration=useRef<ServiceWorkerRegistration|null>(null),current=useRef(user);current.current=user
 const page=useRef(crypto.randomUUID()),inflight=useRef<Promise<void>|null>(null)
 // Delivery status belongs to the account, even without browser push support.
 const settingsVersion=useRef(0)
 const loadSettings=useCallback(async()=>{
  if(privateSignal.aborted)return
  const version=++settingsVersion.current,value=await request<{push:PushSettings}>('/api/notify')
  if(!privateSignal.aborted&&current.current===user&&version===settingsVersion.current)setSettings(value.push)
 },[request,user,privateSignal])
 const post=useCallback((path:string,value:unknown,method='POST')=>request(path,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(value)}),[request])
 const sync=useCallback(async()=>{
  if(privateSignal.aborted||document.visibilityState!=='visible')return
  const value=await request<{active:string[];badge:number}>('/api/devices/sync')
  const reg=registration.current??await navigator.serviceWorker.getRegistration('/')
  if(privateSignal.aborted||current.current!==user)return
  reg?.active?.postMessage({type:'nook-sync',user,...value})
 },[request,user,privateSignal])
 const reconcile=useCallback(async()=>{
  if(!supported())return
  if(inflight.current)return inflight.current
  const job=(async()=>{
   const reg=await navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'});registration.current=await navigator.serviceWorker.ready
   if(current.current!==user)return
   let stored:{user:string;id:string}|null=null;try{stored=JSON.parse(localStorage.getItem(STORE)??'null')}catch{}
   let sub=await reg.pushManager.getSubscription()
   if(stored?.user!==user&&sub){await sub.unsubscribe();sub=null;reg.active?.postMessage({type:'nook-sync',user,active:[],badge:0})}
   const allowed=localStorage.getItem('nook.push.'+user)==='on'
   setPermission(Notification.permission)
   if(!allowed||Notification.permission!=='granted'){
    if(stored?.user===user){await post('/api/devices',{id:stored.id},'DELETE');localStorage.removeItem(STORE)}
    if(sub)await sub.unsubscribe();device.current=null;setEnabled(false);return
   }
   const info=await request<{publicKey:string;devices:{id:string}[]}>('/api/devices')
   if(sub&&sub.expirationTime!==null&&sub.expirationTime<=Date.now()){await sub.unsubscribe();sub=null}
   if(sub&&stored?.user===user&&!info.devices.some(d=>d.id===stored.id)){await sub.unsubscribe();sub=null}
   if(sub&&sub.options.applicationServerKey){const key=new Uint8Array(sub.options.applicationServerKey),expected=decode(info.publicKey);if(key.length!==expected.length||key.some((v,i)=>v!==expected[i])){await sub.unsubscribe();sub=null}}
   if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decode(info.publicKey)})
   if(current.current!==user){await sub.unsubscribe();return}
   const result=await post('/api/devices',{transport:'webpush',subscription:sub.toJSON()})
   device.current=result.id;localStorage.setItem(STORE,JSON.stringify({user,id:result.id}));setEnabled(true)
   await post('/api/devices/presence',{id:result.id,page:page.current,visible:document.visibilityState==='visible'})
   await sync()
  })();inflight.current=job
  try{await job}finally{if(inflight.current===job)inflight.current=null}
 },[user,request,post,sync])
 useEffect(()=>{
  let gone=false
  setSettings(null);setError('');setBusy(false)
  if(!supported()){setPermission('unsupported');return}
  void reconcile().catch(e=>{if(!gone&&!privateSignal.aborted)setError(e instanceof Error?e.message:'Push unavailable')})
  return()=>{gone=true;device.current=null}
 },[user,request,reconcile,privateSignal])
 useEffect(()=>{
  let gone=false
  const heartbeat=async()=>{try{
   if(privateSignal.aborted)return
   if(supported()&&device.current)await post('/api/devices/presence',{id:device.current,page:page.current,visible:document.visibilityState==='visible'})
   if(document.visibilityState==='visible'){
    await Promise.all([loadSettings(),...(supported()?[sync()]:[])])
    if(!gone&&!privateSignal.aborted&&supported())setPermission(Notification.permission)
   }
  }catch(e){if(!gone&&!privateSignal.aborted)setError(e instanceof Error?e.message:'Push unavailable')}}
  const visible=()=>{void heartbeat();if(document.visibilityState==='visible')void reconcile().catch(e=>setError(e.message))}
  const changed=(event:MessageEvent)=>{if(event.data?.type==='nook-resubscribe')void reconcile().catch(e=>setError(e.message))};if(supported())navigator.serviceWorker.addEventListener('message',changed);document.addEventListener('visibilitychange',visible);const timer=setInterval(()=>{void heartbeat()},15_000)
  return()=>{gone=true;clearInterval(timer);document.removeEventListener('visibilitychange',visible);if(supported())navigator.serviceWorker.removeEventListener('message',changed);if(device.current)void post('/api/devices/presence',{id:device.current,page:page.current,visible:false}).catch(()=>{})}
 },[post,sync,reconcile,loadSettings,privateSignal])
 useEffect(()=>{
  if(!snapshot||privateSignal.aborted)return
  settingsVersion.current++;setSettings(snapshot.notify.push as PushSettings)
 },[snapshot?.notify,user,privateSignal])
 useEffect(()=>{
  if(!snapshot||privateSignal.aborted)return
  if(supported())void (async()=>{const reg=registration.current??await navigator.serviceWorker.getRegistration('/');if(!privateSignal.aborted&&current.current===user)reg?.active?.postMessage({type:'nook-sync',user,...snapshot.pushSync})})().catch(()=>{})
 },[snapshot?.pushSync,user,privateSignal])
 const change=useCallback(async(value:Partial<Choices>)=>{setBusy(true);setError('');try{const next=await post('/api/notify',{push:value},'PATCH');if(!privateSignal.aborted&&current.current===user){settingsVersion.current++;setSettings(next.push)}}catch(e){if(!privateSignal.aborted)setError(e instanceof Error?e.message:'Push unavailable')}finally{if(!privateSignal.aborted)setBusy(false)}},[post,user,privateSignal])
 const enable=useCallback(async()=>{
  if(!supported())return
  setBusy(true);setError('')
  try{const permission=Notification.permission==='default'?await Notification.requestPermission():Notification.permission;setPermission(permission);if(permission!=='granted')return;localStorage.setItem('nook.push.'+user,'on');await reconcile();if(!settings?.mentions&&!settings?.urgent&&!settings?.direct&&!settings?.threads){const next=await post('/api/notify',{push:{mentions:true}},'PATCH');if(!privateSignal.aborted&&current.current===user){settingsVersion.current++;setSettings(next.push)}}}catch(e){if(!privateSignal.aborted)setError(e instanceof Error?e.message:'Push unavailable; try enabling again')}finally{if(!privateSignal.aborted)setBusy(false)}
 },[user,reconcile,post,settings,privateSignal])
 const disable=useCallback(async()=>{
  setBusy(true);setError('')
  try{await clearPushNotices();localStorage.removeItem('nook.push.'+user);let stored;try{stored=JSON.parse(localStorage.getItem(STORE)??'null')}catch{}
   if(stored?.user===user)await post('/api/devices',{id:stored.id},'DELETE')
   const reg=registration.current??await navigator.serviceWorker.getRegistration('/');await (await reg?.pushManager.getSubscription())?.unsubscribe();reg?.active?.postMessage({type:'nook-sync',user,active:[],badge:0});localStorage.removeItem(STORE);device.current=null;setEnabled(false)
  }catch(e){setError(e instanceof Error?e.message:'Push unavailable');throw e}finally{setBusy(false)}
 },[post,user])
 return {settings,permission,enabled,error,busy,change,enable,disable,install,standalone,installApp:()=>{void install?.prompt();setInstall(null)}}
}
