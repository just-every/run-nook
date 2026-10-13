import {useCallback,useEffect,useRef,useState} from 'react'
import type {AttentionNotice} from './types'
type Input={userId:string|null;items:AttentionNotice[];activeCount:number;observedAt:number;loaded:boolean;connected:boolean;accessEpoch:number|string;activeConversation:string|null;openConversation:(id:string)=>void;title?:string}
// Notifications contain no cached message body or identity. Clicking returns to
// the ordinary conversation loader, which reauthorizes current access.
export function useOpenTabNotifications(input:Input){
 const {userId,items,activeCount,observedAt,loaded,connected,accessEpoch,activeConversation,openConversation,title='Nook'}=input
 const [permission,setPermission]=useState<NotificationPermission|'unsupported'>('unsupported'),[enabled,setEnabled]=useState(false)
 const baseline=useRef<{user:string|null;epoch:number|string;ready:boolean;since:number;seen:Set<string>}>({user:null,epoch:accessEpoch,ready:false,since:Date.now(),seen:new Set()})
 const handles=useRef(new Set<Notification>()),current=useRef(input);current.current=input
 const close=useCallback(()=>{for(const notice of handles.current)notice.close();handles.current.clear()},[])
 useEffect(()=>{setPermission('Notification' in window?Notification.permission:'unsupported');try{setEnabled(userId!==null&&localStorage.getItem(`nook.notifications.${userId}`)==='on')}catch{setEnabled(false)}},[userId])
 useEffect(()=>{const b=baseline.current;if(b.user!==userId||b.epoch!==accessEpoch||!connected||!loaded||!userId){close();baseline.current={user:userId,epoch:accessEpoch,ready:false,since:Date.now(),seen:new Set()}}
  document.title=userId&&loaded&&connected&&activeCount>0?`(${activeCount}) ${title}`:title
  return()=>{document.title=title}
 },[userId,loaded,connected,accessEpoch,activeCount,title,close])
 useEffect(()=>{
  if(!userId||!loaded||!connected)return
  const b=baseline.current
  if(!b.ready){b.ready=true;b.since=observedAt;b.seen=new Set(items.map(i=>i.id));return}
  for(const item of items){if(b.seen.has(item.id))continue;b.seen.add(item.id)
   if(!enabled||permission!=='granted'||!['mention','urgent-request'].includes(item.reason)||item.state!=='open'||item.message?.author===userId||Date.parse(item.created)<b.since||document.visibilityState==='visible'&&document.hasFocus())continue
   try{const notice=new Notification(item.reason==='urgent-request'?'An urgent request needs your attention':'You have a new mention',{body:'Open Nook to view it.',tag:`nook:${userId}:${item.id}`});handles.current.add(notice);notice.onclose=()=>handles.current.delete(notice);notice.onclick=()=>{notice.close();if(current.current.userId!==userId||current.current.accessEpoch!==accessEpoch||!current.current.connected)return;window.focus();openConversation(item.conversation)}}catch{/* Browsers may revoke permission between the check and constructor. */}
  }
  b.since=observedAt
  if(b.seen.size>2000){b.since=observedAt;b.seen=new Set(items.map(i=>i.id))}
 },[items,observedAt,loaded,connected,userId,enabled,permission,activeConversation,openConversation,accessEpoch])
 useEffect(()=>()=>close(),[close])
 const optIn=useCallback(async()=>{const optEpoch=current.current.accessEpoch;if(!userId||!('Notification'in window))return;let value=Notification.permission;try{if(value==='default')value=await Notification.requestPermission()}catch{value='denied'}if(current.current.userId!==userId||current.current.accessEpoch!==optEpoch)return;setPermission(value);const on=value==='granted';setEnabled(on);try{localStorage.setItem(`nook.notifications.${userId}`,on?'on':'off')}catch{}},[userId])
 const disable=useCallback(()=>{setEnabled(false);close();if(userId)try{localStorage.setItem(`nook.notifications.${userId}`,'off')}catch{}},[userId,close])
 return {permission,enabled,optIn,disable}
}
