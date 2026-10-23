import {fail} from '../family/team-chat/domain'
const encoder=new TextEncoder()
async function key(secret:string){return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',encoder.encode('nook-poll-custody:'+secret)),{name:'AES-GCM'},false,['encrypt','decrypt'])}
const aad=(message:string,user:string)=>encoder.encode(JSON.stringify([message,user]))
// Only a member's own request, or the internal erasure plan, opens this link.
// Neither readable exports nor operational archives include this table.
export async function sealChoices(choices:number[],secret:string,message:string,user:string){
 const iv=crypto.getRandomValues(new Uint8Array(12)),cipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad(message,user)},await key(secret),encoder.encode(JSON.stringify(choices))))
 return btoa(String.fromCharCode(...iv,...cipher))
}
export async function readChoices(sealed:string,secret:string,message:string,user:string):Promise<number[]>{
 try{const bytes=Uint8Array.from(atob(sealed),c=>c.charCodeAt(0)),plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.slice(0,12),additionalData:aad(message,user)},await key(secret),bytes.slice(12)),choices=JSON.parse(new TextDecoder().decode(plain));if(!Array.isArray(choices)||choices.length>20||choices.some(n=>!Number.isInteger(n)||n<1||n>20)||new Set(choices).size!==choices.length)throw Error();return choices}catch{fail(503,'Poll vote custody is unavailable; no vote was changed')}
}
