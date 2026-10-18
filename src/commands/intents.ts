type CommandIntent={intent:string;conversation:string|null}
const prefix=(user:string)=>`nook:commands:v1:${encodeURIComponent(location.origin)}:${encodeURIComponent(user)}:`
export async function commandIntent(user:string,body:string){
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body)),key=prefix(user)+Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join(''),raw=localStorage.getItem(key)
 let value:CommandIntent
 if(raw){value=JSON.parse(raw);if(!value||typeof value.intent!=='string'||value.conversation!==null&&typeof value.conversation!=='string')throw Error('The saved command could not be read. Its retry identity was kept.')}else{value={intent:crypto.randomUUID(),conversation:null};localStorage.setItem(key,JSON.stringify(value))}
 return {value,setConversation:(conversation:string)=>{value={...value,conversation};localStorage.setItem(key,JSON.stringify(value))},complete:()=>localStorage.removeItem(key)}
}
export function clearCommandIntents(user:string){for(const key of Object.keys(localStorage))if(key.startsWith(prefix(user)))localStorage.removeItem(key)}
