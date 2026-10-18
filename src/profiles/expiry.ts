import {fail} from '../family/team-chat/domain'
import {occurrenceAt} from '../scheduled/time.mjs'
import {bounded,object} from './policy'
import type {CustomStatus} from './types'

export function profileZone(value:unknown):string{
 const zone=bounded(value,100,'IANA time zone',false)
 if(/^[+-]/.test(zone))fail(400,'Choose an IANA time zone')
 try{return new Intl.DateTimeFormat('en',{timeZone:zone}).resolvedOptions().timeZone}catch{return fail(400,'Choose an IANA time zone')}
}
export function localDate(epoch:number,zone:string){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',calendar:'gregory',numberingSystem:'latn'}).formatToParts(epoch).map(part=>[part.type,part.value]))
 return `${parts.year}-${parts.month}-${parts.day}`
}
export function statusInput(input:unknown,zone:string,now:number):CustomStatus|null{
 if(input===null)return null
 const data=object(input,['emoji','text','clearAfter','localAt']),emoji=bounded(data.emoji,64,'status emoji'),text=bounded(data.text,160,'status text')
 if(!emoji&&!text)return null
 let expiresAt:number|null=null
 switch(data.clearAfter){
  case 'never':break
  case '30m':expiresAt=now+1800000;break
  case '1h':expiresAt=now+3600000;break
  case '4h':expiresAt=now+14400000;break
  case 'today':case 'week':{
   const date=new Date(localDate(now,zone)+'T00:00:00Z'),days=data.clearAfter==='today'?1:7-((date.getUTCDay()+6)%7)
   date.setUTCDate(date.getUTCDate()+days)
   expiresAt=occurrenceAt(date.toISOString().slice(0,10)+'T00:00',zone);break
  }
  case 'date':expiresAt=occurrenceAt(bounded(data.localAt,16,'local expiry date and time',false),zone);break
  default:fail(400,'Choose when the status clears')
 }
 if(expiresAt!==null&&expiresAt<=now)fail(400,'Choose a future status expiry')
 return {emoji,text,expiresAt}
}
