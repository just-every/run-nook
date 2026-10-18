import type {FileRecord} from './types'
import type {PendingUpload} from './useAttachmentUpload'

export type Intent={confirmBroadcast?:true;adminOverride?:true;body:string;intent:string;parent:string|null;attachments:string[];mentions:string[];urgent:boolean;urgentReason:string|null}
export type Draft={body:string;files:FileRecord[];recipient:string;urgent:boolean;reason:string;pending:Intent|null;upload:PendingUpload|null;delivery:'draft'|'pending'|'unconfirmed'|'failed';failure:string}
export type DraftScope={user:string;conversation:string;parent:string|null}
export const blankDraft=():Draft=>({body:'',files:[],recipient:'',urgent:false,reason:'',pending:null,upload:null,delivery:'draft',failure:''})
const part=encodeURIComponent
const accountPrefix=(user:string)=>`nook:drafts:v1:${part(window.location.origin)}:${part(user)}:`
export const draftKey=(scope:DraftScope)=>typeof window==='undefined'?'':accountPrefix(scope.user)+`${part(scope.conversation)}:${part(scope.parent??'')}`
const legacyKey=(scope:DraftScope)=>`nook:draft:${scope.user}:${scope.conversation}:${scope.parent||'root'}`
const strings=(value:unknown):value is string[]=>Array.isArray(value)&&value.every(v=>typeof v==='string')
function decode(raw:string):Draft{
 const value=JSON.parse(raw)
 if(!value||typeof value.body!=='string'||!Array.isArray(value.files)||value.files.some((file:FileRecord)=>!file||typeof file.id!=='string'||typeof file.name!=='string')||typeof value.recipient!=='string'||typeof value.urgent!=='boolean'||typeof value.reason!=='string')throw Error('Saved draft could not be read. Its stored contents have not been changed.')
 const pending=value.pending??null,upload=value.upload??null
 if(pending&&((pending.confirmBroadcast!==undefined&&pending.confirmBroadcast!==true)||(pending.adminOverride!==undefined&&pending.adminOverride!==true)||typeof pending.body!=='string'||typeof pending.intent!=='string'||!(pending.parent===null||typeof pending.parent==='string')||!strings(pending.attachments)||!strings(pending.mentions)||typeof pending.urgent!=='boolean'||!(pending.urgentReason===null||typeof pending.urgentReason==='string')))throw Error('Saved send could not be read. Its stored contents have not been changed.')
 if(upload&&(!['name','mime','sha256','intent'].every(key=>typeof upload[key]==='string')||typeof upload.size!=='number'))throw Error('Saved upload could not be read. Its stored contents have not been changed.')
 return {...blankDraft(),...value,pending,upload,delivery:pending?'unconfirmed':value.delivery==='failed'?'failed':'draft',failure:typeof value.failure==='string'?value.failure:''}
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
export function clearSentDraft(scope:DraftScope,intent:string){
 const key=draftKey(scope),stored=localStorage.getItem(key)
 // An acknowledgement from an older tab must never erase a newer draft.
 if(stored!==null&&decode(stored).pending?.intent===intent)localStorage.removeItem(key)
}
export function recordSendFailure(scope:DraftScope,intent:string,failure:string,refused:boolean){
 const stored=localStorage.getItem(draftKey(scope))
 if(stored===null)return
 const draft=decode(stored)
 if(draft.pending?.intent===intent)writeDraft(scope,{...draft,pending:refused?null:draft.pending,delivery:refused?'failed':'unconfirmed',failure})
}
export function clearUserDrafts(user:string){
 if(typeof window==='undefined')return
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
