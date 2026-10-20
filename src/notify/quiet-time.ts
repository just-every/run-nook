import {fail} from '../family/team-chat/domain'
import {profileZone,localDate} from '../profiles/expiry'
import {occurrenceAt} from '../scheduled/time.mjs'
export type QuietDay={day:number;enabled:boolean;start:string;end:string}
export type QuietSchedule={enabled:boolean;zone:string;days:QuietDay[];version:number}
const time=(v:unknown):v is string=>typeof v==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v)
export const defaultDays=():QuietDay[]=>Array.from({length:7},(_,day)=>({day,enabled:day>0&&day<6,start:'22:00',end:'07:00'}))
export function quietInput(value:any):QuietSchedule{
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['enabled','zone','days','version'].includes(k))||typeof value.enabled!=='boolean'||!Number.isSafeInteger(value.version)||value.version<0||!Array.isArray(value.days)||value.days.length!==7)fail(400,'Choose a quiet schedule and its current version')
 const days=value.days as QuietDay[]
 if(new Set(days.map(d=>d?.day)).size!==7||days.some(d=>!d||Object.keys(d).some(k=>!['day','enabled','start','end'].includes(k))||!Number.isInteger(d.day)||d.day<0||d.day>6||typeof d.enabled!=='boolean'||!time(d.start)||!time(d.end)||d.enabled&&d.start===d.end))fail(400,'Choose distinct quiet start and end times for each weekday')
 return {enabled:value.enabled,zone:profileZone(value.zone),days:days.toSorted((a,b)=>a.day-b.day),version:value.version}
}
/** A rule belongs to its START weekday. Overnight quiet continues into the next
 * local calendar day. Resolve each endpoint independently across DST: overlaps
 * choose the earlier occurrence; missing local times advance by the gap. */
export function quietAt(schedule:Pick<QuietSchedule,'enabled'|'zone'|'days'>,now:number){
 if(!schedule.enabled)return {until:0,next:null as number|null}
 const date=new Date(localDate(now,schedule.zone)+'T00:00:00Z'),intervals:{start:number;end:number}[]=[]
 for(let offset=-1;offset<=8;offset++){
  const day=new Date(date);day.setUTCDate(day.getUTCDate()+offset)
  const rule=schedule.days.find(r=>r.day===day.getUTCDay());if(!rule?.enabled)continue
  const end=new Date(day);if(rule.end<rule.start)end.setUTCDate(end.getUTCDate()+1)
  intervals.push({start:occurrenceAt(day.toISOString().slice(0,10)+'T'+rule.start,schedule.zone),end:occurrenceAt(end.toISOString().slice(0,10)+'T'+rule.end,schedule.zone)})
 }
 const merged:{start:number;end:number}[]=[]
 for(const interval of intervals.toSorted((a,b)=>a.start-b.start)){const last=merged.at(-1);if(last&&interval.start<=last.end)last.end=Math.max(last.end,interval.end);else merged.push({...interval})}
 const active=merged.find(p=>p.start<=now&&p.end>now)
 return {until:active?.end??0,next:active?.end??merged.find(p=>p.start>now)?.start??null}
}
