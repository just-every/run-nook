import assert from 'node:assert/strict'
import {until} from './fixture.mjs'
export async function quietPush(c){
 const {call,member,room,send,rows,received,delivered,read}=c,prefs=await call('/api/notify','GET',undefined,member.cookie)
 const minute=new Date().getUTCHours()*60+new Date().getUTCMinutes(),time=n=>String(Math.floor((n%1440)/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')
 const schedule={enabled:true,zone:'UTC',version:prefs.quietSchedule.version,days:Array.from({length:7},(_,day)=>({day,enabled:true,start:time((minute+1439)%1440),end:time((minute+60)%1440)}))}
 const saved=await call('/api/notify','PATCH',{quietSchedule:schedule},member.cookie),conversation=await room('Recurring quiet delivery'),message=await send(conversation,{mentions:[member.user.id]})
 await until(async()=>(await rows(message)).some(r=>r.due===saved.quietSchedule.until&&r.state==='pending'),'the actual push alarm holds the queued item until the calendar boundary')
 assert.equal(received.filter(r=>new URL(r.value.url).searchParams.get('focus')===message.id).length,0)
 const delivery=await call('/api/devices','GET',undefined,member.cookie);assert.ok(delivery.alerts.some(r=>r.id&&(r.explanation??'').includes('by your quiet schedule')))
 await call('/api/notify','PATCH',{quietSchedule:{...schedule,enabled:false,version:saved.quietSchedule.version}},member.cookie)
 assert.equal((await delivered(message)).length,1);await read(conversation)
}
