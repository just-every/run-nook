import {b64,unb64,concat,utf8} from '../push/crypto'
async function wrapping(secret:string){return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',utf8('nook.public-apps.v1\0'+secret)),'AES-GCM',false,['encrypt','decrypt'])}
export async function sealSigning(value:string,secret:string){const iv=crypto.getRandomValues(new Uint8Array(12));return b64(concat(iv,new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:utf8('nook-public-apps-v1')},await wrapping(secret),utf8(value)))))}
export async function unsealSigning(value:string,secret:string){const bytes=unb64(value);return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.slice(0,12),additionalData:utf8('nook-public-apps-v1')},await wrapping(secret),bytes.slice(12)))}
export const hex=(bytes:ArrayBuffer)=>[...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('')
export async function signature(secret:string,timestamp:string,body:string){const key=await crypto.subtle.importKey('raw',utf8(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return 'v0='+hex(await crypto.subtle.sign('HMAC',key,utf8('v0:'+timestamp+':'+body)))}
export async function requestKey(value:string){return hex(await crypto.subtle.digest('SHA-256',utf8(value)))}
