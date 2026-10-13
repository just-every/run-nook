import {fail,text,acl,type State,type Identity} from './domain'
export const maxFileBytes = 1024 * 1024
export type Attachment = {id:string;conversation:string;author:string;message:string|null;name:string;mime:string;data:string|null;size:number;sha256:string|null;expires:number;state:'staged'|'attached'|'deleted';created:string}
export function metadata(a:Attachment) { const {data,...safe}=a;return safe }
export const fileBytes = (data:string):Uint8Array => {
 if(typeof data!=='string'||!data||data.length>1398104||data.length%4!==0||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data)) fail(400,'Canonical base64 file required')
 let binary:string;try{binary=atob(data)}catch{return fail(400,'Invalid base64 file')}
 if(binary.length<1||binary.length>maxFileBytes)fail(400,'File must contain1–1048576 bytes')
 if(btoa(binary)!==data)fail(400,'Canonical base64 file required')
 return Uint8Array.from(binary,c=>c.charCodeAt(0))
}
export async function inspectFile(input:Record<string,any>) {
 const name=text(input.name,120);if(/[\u0000-\u001f\u007f/\\<>:"|?*]/.test(input.name))fail(400,'Invalid filename')
 const mime=input.mime;if(!['text/plain','image/png','image/jpeg','application/pdf'].includes(mime))fail(415,'Unsupported file type')
 const bytes=fileBytes(input.data)
 const signature=(prefix:number[])=>prefix.every((v,i)=>bytes[i]===v)
 if(mime==='image/png'&&!signature([137,80,78,71,13,10,26,10]))fail(415,'PNG signature mismatch')
 if(mime==='image/jpeg'&&!signature([255,216,255]))fail(415,'JPEG signature mismatch')
 if(mime==='application/pdf'&&!signature([37,80,68,70,45]))fail(415,'PDF signature mismatch')
 if(mime==='text/plain') {let content:string;try{content=new TextDecoder('utf-8',{fatal:true}).decode(bytes)}catch{return fail(415,'Plain text must be UTF8')};if(content.includes('\u0000'))fail(415,'Plain text contains binary bytes')}
 const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',Uint8Array.from(bytes).buffer))).map(v=>v.toString(16).padStart(2,'0')).join('')
 return {name,mime,data:input.data as string,size:bytes.length,sha256}
}
export function admission(s:State,u:Identity,id:string) {const a=s.attachments.find(a=>a.id===id)??fail(404,'Attachment missing');acl(s,u,a.conversation);if(a.state==='deleted')fail(404,'Attachment deleted');if(a.state==='staged'&&(a.author!==u.id||a.expires<Date.now()))fail(404,'Attachment unavailable');return a}
export function erase(a:Attachment) {a.name='';a.data=null;a.mime='application/octet-stream';a.size=0;a.sha256=null;a.state='deleted'}
