import {clearCommandIntents} from '../commands/intents'
import type {FileRecord} from './types'
import type {PendingUpload} from './useAttachmentUpload'

export type Intent={confirmBroadcast?:true;adminOverride?:true;body:string;intent:string;parent:string|null;attachments:string[];mentions:string[];urgent:boolean;urgentReason:string|null}
export type SendPlan={kind:'split'|'snippet';parts:Intent[];next:number;snippet?:{intent:string;name:string;file:FileRecord|null}}
export type Draft={body:string;files:FileRecord[];recipient:string;mentionIds?:string[];urgent:boolean;reason:string;pending:Intent|null;upload:PendingUpload|null;plan?:SendPlan|null;delivery:'draft'|'pending'|'unconfirmed'|'failed';failure:string}
export type DraftScope={user:string;conversation:string;parent:string|null}
export const blankDraft=():Draft=>({body:'',files:[],recipient:'',urgent:false,reason:'',pending:null,upload:null,delivery:'draft',failure:''})
const part=encodeURIComponent
const accountPrefix=(user:string)=>`nook:drafts:v1:${part(window.location.origin)}:${part(user)}:`
export const draftKey=(scope:DraftScope)=>typeof window==='undefined'?'':accountPrefix(scope.user)+`${part(scope.conversation)}:${part(scope.parent??'')}`
const legacyKey=(scope:DraftScope)=>`nook:draft:${scope.user}:${scope.conversation}:${scope.parent||'root'}`
const strings=(value:unknown):value is string[]=>Array.isArray(value)&&value.every(v=>typeof v==='string')
const validIntent=(pending:Intent)=>pending&&!(pending.confirmBroadcast!==undefined&&pending.confirmBroadcast!==true)&&!(pending.adminOverride!==undefined&&pending.adminOverride!==true)&&typeof pending.body==='string'&&typeof pending.intent==='string'&&(pending.parent===null||typeof pending.parent==='string')&&strings(pending.attachments)&&strings(pending.mentions)&&typeof pending.urgent==='boolean'&&(pending.urgentReason===null||typeof pending.urgentReason==='string')
function decode(raw:string):Draft{
 const value=JSON.parse(raw)
 if(!value||typeof value.body!=='string'||!Array.isArray(value.files)||value.files.some((file:FileRecord)=>!file||typeof file.id!=='string'||typeof file.name!=='string')||typeof value.recipient!=='string'||typeof value.urgent!=='boolean'||typeof value.reason!=='string')throw Error('Saved draft could not be read. Its stored contents have not been changed.')
 const pending=value.pending??null,upload=value.upload??null
 if(value.mentionIds!==undefined&&!strings(value.mentionIds))throw Error('Saved mentions could not be read. Its stored contents have not been changed.')
 if(pending&&!validIntent(pending))throw Error('Saved send could not be read. Its stored contents have not been changed.')
 const plan=value.plan??null
 if(plan&&(!['split','snippet'].includes(plan.kind)||!Array.isArray(plan.parts)||!plan.parts.length||!plan.parts.every(validIntent)||!Number.isInteger(plan.next)||plan.next<0||plan.next>=plan.parts.length||new Set(plan.parts.map((p:Intent)=>p.intent)).size!==plan.parts.length||(pending&&pending.intent!==plan.parts[plan.next].intent)||(plan.kind==='snippet'&&(!plan.snippet||typeof plan.snippet.intent!=='string'||typeof plan.snippet.name!=='string'||(plan.snippet.file!==null&&typeof plan.snippet.file?.id!=='string')))))throw Error('Saved multi-part send could not be read. Its stored contents have not been changed.')
 if(upload&&(!['name','mime','sha256','intent'].every(key=>typeof upload[key]==='string')||typeof upload.size!=='number'))throw Error('Saved upload could not be read. Its stored contents have not been changed.')
 return {...blankDraft(),...value,pending,upload,plan,delivery:value.delivery==='failed'?'failed':pending||plan?'unconfirmed':'draft',failure:typeof value.failure==='string'?value.failure:''}
}
export function readDraft(scope:DraftScope):Draft{
 if(typeof window==='undefined')return blankDraft()
 const key=draftKey(scope),stored=localStorage.getItem(key),legacy=sessionStorage.getItem(legacyKey(scope))
 if(stored!==null){const draft=decode(stored);sessionStorage.removeItem(legacyKey(scope));return draft}
 if(legacy===null)return blankDraft()
 const draft=decode(legacy)
 // Retire the session-only copy only after its durable replacement succeeds.
 localStorage.setItem(key,JSON.stringify(draft));sessionStorage.removeItem(legacyKey(scope))
 return draft
}
export function writeDraft(scope:DraftScope,draft:Draft){localStorage.setItem(draftKey(scope),JSON.stringify(draft))}
// Persist each acknowledgement before the next network request. If storage fails,
// retrying the previous exact intent is safe; it never creates a replacement part.
export function acknowledgePart(scope:DraftScope,intent:string):Draft|null|undefined{
 const key=draftKey(scope),stored=localStorage.getItem(key)
 if(stored===null)return undefined
 const draft=decode(stored)
 if(draft.pending?.intent!==intent)return undefined
 const plan=draft.plan
 if(!plan||plan.next===plan.parts.length-1){localStorage.removeItem(key);return null}
 const next={...draft,files:[],plan:{...plan,next:plan.next+1},pending:plan.parts[plan.next+1],delivery:'unconfirmed' as const,failure:''}
 writeDraft(scope,next);return next
}
export function recordSendFailure(scope:DraftScope,intent:string,failure:string,refused:boolean){
 const stored=localStorage.getItem(draftKey(scope))
 if(stored===null)return
 const draft=decode(stored)
 if(draft.pending?.intent===intent)writeDraft(scope,{...draft,pending:refused&&!draft.plan?null:draft.pending,delivery:refused?'failed':'unconfirmed',failure})
}
export function clearUserDrafts(user:string){
 if(typeof window==='undefined')return
 clearCommandIntents(user)
 const prefix=accountPrefix(user)
 for(const key of Object.keys(localStorage))if(key.startsWith(prefix))localStorage.removeItem(key)
 for(const key of Object.keys(sessionStorage))if(key.startsWith(`nook:draft:${user}:`))sessionStorage.removeItem(key)
}
export function clearConversationDrafts(user:string,conversations:Iterable<string>){
 if(typeof window==='undefined')return
 const prefixes=[...conversations].map(conversation=>({durable:accountPrefix(user)+part(conversation)+':',legacy:`nook:draft:${user}:${conversation}:`}))
 for(const key of Object.keys(localStorage))if(prefixes.some(prefix=>key.startsWith(prefix.durable)))localStorage.removeItem(key)
 for(const key of Object.keys(sessionStorage))if(prefixes.some(prefix=>key.startsWith(prefix.legacy)))sessionStorage.removeItem(key)
}
