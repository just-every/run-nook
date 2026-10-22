import type {Context} from '../platform/storage/context'
import {fail} from '../family/team-chat/domain'
import type {Range,Passage} from './range'
const utf8=(value:string)=>new TextEncoder().encode(value)
export const digest=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',utf8(value))),b=>b.toString(16).padStart(2,'0')).join('')
export type Selection={id:string;hash:string;start:number;length:number;question:boolean}
export type Receipt={range:Range;points:Selection[];version:number;created:number}
async function key(c:Context){return crypto.subtle.importKey('raw',utf8(c.env.SESSION_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign','verify'])}
const encode=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'')
const decode=(s:string)=>Uint8Array.from(atob(s.replaceAll('-','+').replaceAll('_','/')),v=>v.charCodeAt(0))
export async function sign(c:Context,value:Receipt){const bytes=utf8(JSON.stringify(value)),signature=new Uint8Array(await crypto.subtle.sign('HMAC',await key(c),bytes));return encode(bytes)+'.'+encode(signature)}
export async function verify(c:Context,value:unknown):Promise<Receipt>{
 if(typeof value!=='string'||value.length>16000)fail(404,'Recap unavailable')
 try{const [body,signature,...extra]=(value as string).split('.');if(extra.length||!await crypto.subtle.verify('HMAC',await key(c),decode(signature),decode(body)))throw Error();const result=JSON.parse(new TextDecoder().decode(decode(body)));if(Date.now()-result.created>86400000||!Array.isArray(result.points)||result.points.length>16)throw Error();return result}catch{return fail(404,'Recap unavailable')}
}
export async function selection(p:Passage,quote:string,question=false):Promise<Selection>{return {id:p.id,hash:await digest(p.text),start:p.text.indexOf(quote),length:quote.length,question}}
