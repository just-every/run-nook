import {fail} from '../family/team-chat/domain'
import type {FilesFilters,FilesPosition,FileType} from './types'

function reference(value:unknown,label:string):string|null{
 if(value===undefined||value===null||value==='')return null
 if(typeof value!=='string'||value.length>128||value.trim()!==value||/[\u0000-\u001f\u007f]/.test(value))return fail(400,'Invalid '+label)
 return value
}
export function filesFilters(input:Record<string,unknown>,user:string):FilesFilters{
 if(Object.keys(input).some(key=>!['conversation','person','type','after'].includes(key)))fail(400,'Unknown files filter')
 const type=input.type??''
 if(!['','image','pdf','text','other'].includes(type as string))fail(400,'Choose a supported file type')
 const person=reference(input.person,'person filter')
 return {conversation:reference(input.conversation,'conversation filter'),person:person==='me'?user:person,type:type as FileType}
}
const binding=(filters:FilesFilters)=>JSON.stringify(filters)
/** This cursor supplies a position, never authority. Every page applies the
 * current session and membership fences, regardless of the supplied position. */
export function filesAfter(value:unknown,filters:FilesFilters):FilesPosition|null{
 if(value===undefined||value===null||value==='')return null
 if(typeof value!=='string'||value.length>2000||!/^[A-Za-z0-9_-]+$/.test(value))return fail(400,'Invalid files cursor')
 try{
  const decoded=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0))))
  if(decoded.v!==1||decoded.filters!==binding(filters)||!Number.isSafeInteger(decoded.stamp)||decoded.stamp<0||typeof decoded.id!=='string'||!decoded.id||reference(decoded.id,'files cursor')!==decoded.id)fail(400,'Files cursor belongs to another listing')
  return {stamp:decoded.stamp,id:decoded.id}
 }catch{return fail(400,'Invalid files cursor')}
}
export function filesCursor(position:FilesPosition,filters:FilesFilters){
 const bytes=new TextEncoder().encode(JSON.stringify({v:1,filters:binding(filters),...position}))
 return btoa(Array.from(bytes,b=>String.fromCharCode(b)).join('')).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'')
}
