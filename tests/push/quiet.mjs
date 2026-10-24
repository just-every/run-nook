import assert from 'node:assert/strict'
import {deliveries} from './retention.mjs'
import {until} from './fixture.mjs'
export async function quietPush(c){
 const {call,member,room,send,rows,received,delivered,read}=c,prefs=await call('/api/notify','GET',undefined,member.cookie)
 const minute=new Date().getUTCHours()*60+new Date().getUTCMinutes(),time=n=>String(Math.floor((n%1440)/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')
 const schedule={enabled:true,zone:'UTC',version:prefs.quietSchedule.version,days:Array.from({length:7},(_,day)=>({day,enabled:true,start:time((minute+1439)%1440),end:time((minute+60)%1440)}))}
 const saved=await call('/api/notify','PATCH',{quietSchedule:schedule},member.cookie),conversation=await room('Recurring quiet delivery'),message=await send(conversation,{mentions:[member.user.id]},c.ownerCookie)
 await until(async()=>(await rows(message)).some(r=>r.due===saved.quietSchedule.until&&r.state==='pending'),'the actual push alarm holds the queued item until the calendar boundary')
 assert.equal(received.filter(r=>new URL(r.value.url).searchParams.get('focus')===message.id).length,0)
 const delivery=await call('/api/devices','GET',undefined,member.cookie);assert.ok(delivery.alerts.some(r=>r.id&&(r.explanation??'').includes('by your quiet schedule')))
 const canceledRoom=await room('Read during recurring quiet'),canceled=await send(canceledRoom,{mentions:[member.user.id]},c.ownerCookie);await read(canceledRoom);
 const canceledRecord=(await deliveries(c,canceledRoom)).find(r=>r.id.startsWith('push:'+canceled.id+':'));assert.equal(canceledRecord.error,'seen');assert.equal(canceledRecord.state,'cancelled');assert.ok(canceledRecord.holds.some(h=>h.kind==='quiet-schedule'&&h.release>=h.start));
 await call('/api/notify','PATCH',{quietSchedule:{...schedule,enabled:false,version:saved.quietSchedule.version}},member.cookie)
 assert.equal((await delivered(message)).length,1);await read(conversation)
 const vacation={starts:Date.now()-60000,ends:Date.now()+3600000};await call('/api/notify','PATCH',{vacation},member.cookie);
 const vacationRoom=await room('synthetic-nook vacation push'),held=await send(vacationRoom,{mentions:[member.user.id]},c.ownerCookie);
 await until(async()=>(await rows(held)).some(r=>r.state==='pending'&&r.due===vacation.ends),'vacation holds device alerts');
 assert.equal(received.filter(r=>new URL(r.value.url).searchParams.get('focus')===held.id).length,0);
 await call('/api/notify','PATCH',{push:{urgent:true,urgentQuiet:true}},member.cookie);
 // Isolate the urgent witness from the ordinary room's existing ten-minute fold window.
 const urgentRoom=await room('synthetic-nook urgent vacation exception');
 const urgent=await send(urgentRoom,{mentions:[member.user.id],urgent:true,urgentReason:'synthetic-nook urgent vacation exception'},c.ownerCookie);assert.equal((await delivered(urgent)).length,1);await read(urgentRoom);
 await call('/api/notify','PATCH',{vacation:null,push:{urgent:prefs.push.urgent,urgentQuiet:prefs.push.urgentQuiet}},member.cookie);assert.equal((await delivered(held)).length,1);await read(vacationRoom);
 const record=(await deliveries(c,conversation)).find(r=>r.id.startsWith('push:'+message.id+':'));assert.ok(record);assert.equal(record.state,'sent');assert.ok(record.holds.some(h=>h.kind==='quiet-schedule'&&h.start>0&&h.release>=h.start));c.holdWitnesses=[record,canceledRecord];

}
