// NOOK-079 token format: `nookit_<token id>.<secret>`. Only a keyed hash of the
// whole token is stored; the secret is shown once, when it is created or rotated.
const encoder=new TextEncoder()
const hex=(bytes:ArrayBuffer)=>[...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('')
const base64url=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'')
export function newSecret(id:string){return `nookit_${id}.${base64url(crypto.getRandomValues(new Uint8Array(32)))}`}
export function parseToken(value:string|null):{id:string;token:string}|null{
 const match=/^Bearer (nookit_([0-9a-f-]{36})\.[A-Za-z0-9_-]{43})$/.exec(value??'')
 return match?{id:match[2],token:match[1]}:null
}
// Sealed with the installation's SESSION_SECRET, so a copy of the database alone cannot test guesses.
export async function sealToken(token:string,key:string){
 const hmac=await crypto.subtle.importKey('raw',encoder.encode('nook-integration-token:'+key),{name:'HMAC',hash:'SHA-256'},false,['sign'])
 return hex(await crypto.subtle.sign('HMAC',hmac,encoder.encode(token)))
}
export function sameHash(a:string,b:string){
 if(a.length!==b.length)return false
 let difference=0;for(let i=0;i<a.length;i++)difference|=a.charCodeAt(i)^b.charCodeAt(i)
 return difference===0
}
