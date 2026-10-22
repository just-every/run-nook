import {b64,unb64,concat,utf8} from '../push/crypto'
async function wrapping(secret:string){return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',utf8('nook.ai-search.v1\0'+secret)),'AES-GCM',false,['encrypt','decrypt'])}
export async function seal(value:string,secret:string){const iv=crypto.getRandomValues(new Uint8Array(12));return b64(concat(iv,new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:utf8('nook-ai-search-v1')},await wrapping(secret),utf8(value)))))}
export async function unseal(value:string,secret:string){const bytes=unb64(value);return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.slice(0,12),additionalData:utf8('nook-ai-search-v1')},await wrapping(secret),bytes.slice(12)))}
