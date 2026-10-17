import {fail} from '../family/team-chat/domain'

export type SearchSource='native'|'imported'
export type SearchQuery={text:string;conversation:string|null;person:string|null;afterDate:string|null;beforeDate:string|null;hasFile:boolean;saved:boolean;pinned:boolean;hints:string[]}
export type SearchPosition={source:0|1;id:string}
const supported='Supported filters: from:, in:, has:file, has:pin, is:saved, before:, after: and on:.'

function reference(value:unknown,label:string):string|null{
 if(value===undefined||value===null||value==='')return null
 if(typeof value!=='string'||value.length>128||value.trim()!==value||/[\u0000-\u001f\u007f]/.test(value))return fail(400,`Invalid ${label} filter`)
 return value
}
function date(value:unknown,label:string){
 const valueString=reference(value,label)
 if(valueString===null)return null
 if(!/^\d{4}-\d{2}-\d{2}$/.test(valueString))fail(400,`Use YYYY-MM-DD for ${label}`)
 const at=Date.parse(valueString+'T00:00:00.000Z')
 if(!Number.isFinite(at)||new Date(at).toISOString().slice(0,10)!==valueString)fail(400,`Invalid ${label} date`)
 return valueString
}
function same(previous:string|null,next:string,label:string){
 if(previous!==null&&previous!==next)fail(400,`Choose one ${label} filter`)
 return next
}
/** Plain words retain substring semantics; recognized modifiers are removed.
 * Dates are UTC days, with inclusive after and exclusive before boundaries. */
export function parseSearch(input:Record<string,unknown>):SearchQuery{
 const raw=input.q??''
 if(typeof raw!=='string'||raw.length>512||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(raw))return fail(400,'Search must contain at most 512 characters')
 const result:SearchQuery={text:'',conversation:reference(input.conversation,'conversation'),person:reference(input.person,'person'),afterDate:date(input.afterDate,'after'),beforeDate:date(input.beforeDate,'before'),hasFile:false,saved:false,pinned:false,hints:[]}
 const tokens:string[]=[];let token='',quoted=false
 for(const character of raw){
  if(character==='"'){quoted=!quoted;continue}
  if(/\s/u.test(character)&&!quoted){if(token)tokens.push(token);token=''}else token+=character
 }
 if(quoted)fail(400,'Close the quoted search phrase')
 if(token)tokens.push(token)
 const words:string[]=[]
 for(const part of tokens){
  const colon=part.indexOf(':'),modifier=colon>0?part.slice(0,colon).toLowerCase():'',value=colon>0?part.slice(colon+1):''
  if(modifier==='from'){
   const person=reference(value.replace(/^@/,''),'person')??fail(400,'Choose a person after from:')
   result.person=same(result.person,person,'person')
  }else if(modifier==='in'&&!value.startsWith('@')){
   const conversation=reference(value.replace(/^#/,''),'conversation')??fail(400,'Choose a channel after in:')
   result.conversation=same(result.conversation,conversation,'conversation')
  }else if(modifier==='has'&&value==='file')result.hasFile=true
  else if(modifier==='has'&&value==='pin')result.pinned=true
  else if(modifier==='is'&&value==='saved')result.saved=true
  else if(['after','before','on'].includes(modifier)){
   const day=date(value,modifier)??fail(400,`Choose a date after ${modifier}:`)
   if(modifier!=='before')result.afterDate=result.afterDate&&result.afterDate>day?result.afterDate:day
   const end=modifier==='on'?new Date(Date.parse(day+'T00:00:00.000Z')+86400_000).toISOString().slice(0,10):day
   if(modifier!=='after')result.beforeDate=result.beforeDate&&result.beforeDate<end?result.beforeDate:end
  }else{
   words.push(part)
   if(modifier&&!result.hints.length)result.hints.push('Unrecognized modifiers are searched as text. '+supported)
  }
 }
 result.text=(tokens.length===words.length&&!raw.includes('"')?raw.trim():words.join(' ')).toLowerCase()
 if(result.afterDate&&result.beforeDate&&result.afterDate>=result.beforeDate)fail(400,'The before date must follow the after date')
 if(!result.text&&!result.conversation&&!result.person&&!result.afterDate&&!result.beforeDate&&!result.hasFile&&!result.saved&&!result.pinned)fail(400,'Enter search text or choose a filter')
 return result
}

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
