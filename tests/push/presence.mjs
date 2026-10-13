import assert from 'node:assert/strict';
import {until} from './fixture.mjs';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function presence(c){
 const {call,member,device,room,send,received,delivered,read}=c;
 const conversation=await room('Presence expires without requests'),page=crypto.randomUUID();
 const start=Date.now();await call('/api/devices/presence','POST',{id:device.id,page,visible:true},member.cookie);
 const message=await send(conversation,{mentions:[member.user.id]}),count=received.length;
 // No API traffic, heartbeat, clock rewrite or app helper occurs between send
 // and receipt. Only the real ChatHub alarm can release this visible presence.
 await pause(Math.max(0,start+44_000-Date.now()));assert.equal(received.length,count,'fresh presence holds all forty-four seconds');
 await until(()=>received.length>count,'alarm releases actual 45-second presence',15_000);
 const alert=received.at(-1);assert.equal(new URL(alert.value.url).searchParams.get('focus'),message.id);assert.ok(alert.at-start>=45_000);await delivered(message);await read(conversation);
 const hiddenRoom=await room('Hidden releases presence');await call('/api/devices/presence','POST',{id:device.id,page,visible:true},member.cookie);const hidden=await send(hiddenRoom,{mentions:[member.user.id]});
 await pause(6000);assert.equal(received.some(r=>new URL(r.value.url).searchParams.get('focus')===hidden.id),false);
 const release=Date.now();await call('/api/devices/presence','POST',{id:device.id,page,visible:false},member.cookie);const [notice]=await delivered(hidden);assert.ok(notice.at-release<20_000,'hidden release does not wait for original presence expiration');await read(hiddenRoom);
 c.t.diagnostic('Presence: actual 45-second expiry released by alarm without any intervening request; explicit hidden-page release passed.');
}
