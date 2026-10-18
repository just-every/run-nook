import {fail} from '../family/team-chat/domain'
import {occurrenceAt} from '../scheduled/time.mjs'
import {searchFold,type SearchTerm} from './terms'
export type SearchQuery={text:string;terms:SearchTerm[];conversation:string|null;person:string|null;participant:string|null;directToMe:boolean;conversationType:string|null;afterDate:string|null;beforeDate:string|null;afterAt:number|null;beforeAt:number|null;timeZone:string;hasFile:boolean;hasLink:boolean;reaction:string|null;thread:boolean;saved:boolean;pinned:boolean;hints:string[]}
const supported='Supported filters: from:, in:, with:, to:me, type:channel|private|dm, has:file|link|pin|:emoji:, is:thread|saved, before:, after:, on: and during:.'
export function searchReference(value:unknown,label:string):string|null{
 if(value===undefined||value===null||value==='')return null
 if(typeof value!=='string'||value.length>128||value.trim()!==value||/[\u0000-\u001f\u007f]/.test(value))return fail(400,`Invalid ${label} filter`)
 return value
}
function day(value:unknown,label:string){
 const result=searchReference(value,label);if(result===null)return null
 if(!/^\d{4}-\d{2}-\d{2}$/.test(result)||!Number.isFinite(Date.parse(result+'T00:00Z'))||new Date(result+'T00:00Z').toISOString().slice(0,10)!==result)fail(400,`Use a valid YYYY-MM-DD date for ${label}`)
 return result
}
const nextDay=(value:string)=>new Date(Date.parse(value+'T00:00Z')+86400000).toISOString().slice(0,10)
function same(previous:string|null,next:string,label:string){if(previous!==null&&previous!==next)fail(400,`Choose one ${label} filter`);return next}
export function parseSearch(input:Record<string,unknown>):SearchQuery{
 const raw=input.q??''
 if(typeof raw!=='string'||raw.length>512||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(raw))return fail(400,'Search must contain at most 512 characters')
 let timeZone='UTC';try{timeZone=new Intl.DateTimeFormat('en-US',{timeZone:typeof input.timeZone==='string'?input.timeZone:'UTC'}).resolvedOptions().timeZone}catch{fail(400,'Choose an IANA time zone')}
 const result:SearchQuery={text:'',terms:[],conversation:searchReference(input.conversation,'conversation'),person:searchReference(input.person,'person'),participant:null,directToMe:false,conversationType:searchReference(input.conversationType,'conversation type'),afterDate:day(input.afterDate,'after'),beforeDate:day(input.beforeDate,'before'),afterAt:null,beforeAt:null,timeZone,hasFile:false,hasLink:false,reaction:null,thread:false,saved:false,pinned:false,hints:[]}
 const tokens:string[]=[];let token='',quoted=false
 for(const character of raw){if(character==='"')quoted=!quoted;if(/\s/u.test(character)&&!quoted){if(token)tokens.push(token);token=''}else token+=character}
 if(quoted)fail(400,'Close the quoted search phrase');if(token)tokens.push(token)
 const dates=(after:string|null,before:string|null)=>{if(after)result.afterDate=result.afterDate&&result.afterDate>after?result.afterDate:after;if(before)result.beforeDate=result.beforeDate&&result.beforeDate<before?result.beforeDate:before}
 for(const part of tokens){
  const colon=part.indexOf(':'),modifier=colon>0?part.slice(0,colon).toLowerCase():'',value=colon>0?part.slice(colon+1).replace(/^"(.*)"$/,'$1'):''
  if(['from','with'].includes(modifier)||modifier==='in'&&value.startsWith('@')){
   const who=searchReference(value.replace(/^@/,''),'person')??fail(400,`Choose a person after ${modifier}:`)
   if(modifier==='from')result.person=same(result.person,who,'person');else result.participant=same(result.participant,who,'participant')
   if(modifier==='in')result.conversationType='dm'
  }else if(modifier==='in')result.conversation=same(result.conversation,searchReference(value.replace(/^#/,''),'conversation')??fail(400,'Choose a channel after in:'),'conversation')
  else if(modifier==='to'&&value==='me'){result.directToMe=true;result.conversationType='dm'}
  else if(modifier==='type')result.conversationType=same(result.conversationType,value,'conversation type')
  else if(modifier==='has'&&value==='file')result.hasFile=true
  else if(modifier==='has'&&value==='link')result.hasLink=true
  else if(modifier==='has'&&value==='pin')result.pinned=true
  else if(modifier==='has'&&/^:[^:]+:$/.test(value))result.reaction=same(result.reaction,value.slice(1,-1),'reaction')
  else if(modifier==='is'&&value==='saved')result.saved=true
  else if(modifier==='is'&&value==='thread')result.thread=true
  else if(['after','before','on'].includes(modifier)){const date=day(value,modifier)??fail(400,`Choose a date after ${modifier}:`);dates(modifier==='before'?null:date,modifier==='after'?null:modifier==='on'?nextDay(date):date)}
  else if(modifier==='during'){
   const months=['january','february','march','april','may','june','july','august','september','october','november','december'],month=months.indexOf(value.toLowerCase())+1
   const year=Number(new Intl.DateTimeFormat('en-US',{year:'numeric',timeZone}).format(Date.now()))
   const start=month?`${year}-${String(month).padStart(2,'0')}-01`:/^\d{4}(-\d{2})?$/.test(value)?value+(value.length===4?'-01-01':'-01'):fail(400,'Use a month name, YYYY or YYYY-MM after during:')
   day(start,'during');const date=new Date(start+'T00:00Z');if(!month&&value.length===4)date.setUTCFullYear(date.getUTCFullYear()+1);else date.setUTCMonth(date.getUTCMonth()+1)
   dates(start,date.toISOString().slice(0,10))
  }else{
   const exclude=part.startsWith('-')&&part.length>1,literal=exclude?part.slice(1):part,phrase=literal.startsWith('"')&&literal.endsWith('"'),prefix=!phrase&&literal.endsWith('*'),term=literal.slice(phrase?1:0,phrase?-1:prefix?-1:undefined)
   if(!term)fail(400,'Enter text before the prefix wildcard')
   result.terms.push({value:searchFold(term),prefix,exclude,phrase})
   if(modifier&&!result.hints.length)result.hints.push('Unrecognized modifiers are searched as text. '+supported)
  }
 }
 if(result.conversationType&&!['channel','private','dm'].includes(result.conversationType))fail(400,'Choose channel, private or dm for conversation type')
 result.text=result.terms.filter(t=>!t.exclude).map(t=>t.value).join(' ')
 if(result.afterDate)result.afterAt=occurrenceAt(result.afterDate+'T00:00',timeZone)
 if(result.beforeDate)result.beforeAt=occurrenceAt(result.beforeDate+'T00:00',timeZone)
 if(result.afterAt!==null&&result.beforeAt!==null&&result.afterAt>=result.beforeAt)fail(400,'The before date must follow the after date')
 if(!tokens.length&&!Object.values(input).some(Boolean))fail(400,'Enter search text or choose a filter')
 if(!result.terms.length&&!result.conversation&&!result.person&&!result.participant&&!result.directToMe&&!result.conversationType&&!result.afterDate&&!result.beforeDate&&!result.hasFile&&!result.hasLink&&!result.reaction&&!result.thread&&!result.saved&&!result.pinned)fail(400,'Enter search text or choose a filter')
 return result
}
