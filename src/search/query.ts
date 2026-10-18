import {fail} from '../family/team-chat/domain'
import type {SearchQuery} from './parse'
export {parseSearch} from './parse'
export type {SearchQuery} from './parse'
export type SearchSource='native'|'imported'
export type SearchPosition={source:0|1;id:string}
const bytes=(value:string)=>new TextEncoder().encode(value)
const encode=(value:Uint8Array)=>btoa(Array.from(value,b=>String.fromCharCode(b)).join('')).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'')
function decode(value:string){
 if(!/^[A-Za-z0-9_-]+$/.test(value))fail(400,'Invalid search cursor')
 try{return Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0))}catch{return fail(400,'Invalid search cursor')}
}
/** A cursor authorizes no data. Authentication and ACL are repeated for each
 * page; its MAC only prevents changing its owner, filters or position. */
export async function searchCursor(secret:string,user:string,query:SearchQuery,source?:SearchSource){
 const key=await crypto.subtle.importKey('raw',bytes(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify'])
 const binding=encode(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes(JSON.stringify({user,query,source:source??null})))))
 return {
  async read(value:unknown):Promise<SearchPosition>{
   if(value===undefined||value===null||value==='')return {source:0,id:''}
   if(typeof value!=='string'||value.length>1200)return fail(400,'Invalid search cursor')
   const parts=value.split('.');if(parts.length!==2)fail(400,'Invalid search cursor')
   const body=decode(parts[0]),signature=decode(parts[1])
   if(!await crypto.subtle.verify('HMAC',key,signature,body))fail(400,'Invalid search cursor')
   let decoded:unknown
   try{decoded=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(body))}catch{return fail(400,'Invalid search cursor')}
   if(!decoded||typeof decoded!=='object'||Array.isArray(decoded))return fail(400,'Invalid search cursor')
   const payload=decoded as Record<string,unknown>
   if(payload.v!==1||payload.binding!==binding||(payload.source!==0&&payload.source!==1)||typeof payload.id!=='string'||!payload.id||payload.id.length>128||/[\u0000-\u001f\u007f]/.test(payload.id))return fail(400,'Search cursor belongs to another search')
   return {source:payload.source,id:payload.id}
  },
  async write(position:SearchPosition){
   const body=bytes(JSON.stringify({v:1,binding,...position})),signature=new Uint8Array(await crypto.subtle.sign('HMAC',key,body))
   return encode(body)+'.'+encode(signature)
  },
 }
}
