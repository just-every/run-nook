import assert from 'node:assert/strict'
import {until} from './fixture.mjs'
export async function broadcasts(c){
 const {call,member,ownerCookie,room,send,delivered,rows,db}=c
 const channel=await room('Channel broadcast transport')
 // The channel's member has already enabled mentions and a real encrypted Web
 // Push endpoint in the shared public-door transport fixture.
 assert.equal((await call('/api/notify','GET',undefined,member.cookie)).push.broadcasts,true)
 const message=await send(channel,{body:'@channel Private launch details stay in Nook.'})
 const packets=await delivered(message)
 assert.equal(packets.length,1);assert.match(packets[0].value.body,/channel-wide mention/);assert.doesNotMatch(JSON.stringify(packets[0].value),/Private launch details/)
 await call('/api/notify','PATCH',{push:{broadcasts:false}},member.cookie)
 const off=await send(channel,{body:'@channel Teammates please check the launch.'})
 assert.equal((await rows(off)).length,0)
 await call('/api/notify','PATCH',{push:{broadcasts:true}},member.cookie)
 const quiet=Date.now()+3600000
 await call('/api/settings','PATCH',{dndUntil:quiet},member.cookie)
 const held=await send(channel,{body:'@channel Routine broadcast during quiet time.'})
 await until(async()=>{const queue=await rows(held);return queue.length===1&&queue[0].due>=quiet},'broadcast held for quiet time')
 assert.equal((await rows(held))[0].state,'pending')
 await call(`/api/conversations/${channel.id}/broadcast-ignore`,'PATCH',{ignore:true},member.cookie)
 await call('/api/settings','PATCH',{dndUntil:null},member.cookie)
 await until(async()=>(await rows(held))[0]?.state==='cancelled','ignore cancels queued broadcast')
 const ignored=await send(channel,{body:'<!channel> Ignored broadcast'})
 assert.equal((await rows(ignored)).length,0)
 const item=await db.prepare("SELECT id FROM nook_attention WHERE message=? AND user=?").bind(ignored.id,member.user.id).first()
 assert.equal(item,null)
 await call(`/api/conversations/${channel.id}/broadcast-ignore`,'PATCH',{ignore:false},member.cookie)
 // Own sends still exclude the sender even with channel-wide routing.
 const own=await send(channel,{body:'@channel My own broadcast'},member.cookie)
 assert.equal((await rows(own)).length,0)
}
