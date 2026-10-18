import type {Context} from '../platform/storage/context'
import {fail} from '../family/team-chat/domain'
import {subscription,endpointHash} from './subscription'
import {vapid} from './crypto'
import {PUSH_GATHER_MS} from './queue'
export const PRESENCE_MS=45_000
const id=(v:unknown)=>typeof v==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(v)?v:fail(400,'Invalid device or page')
export async function devices(c:Context){return {publicKey:(await vapid(c.env)).publicKey,transport:'webpush',devices:await c.rows('SELECT id,transport,device_class AS deviceClass,created,updated FROM nook_push_devices WHERE user=? ORDER BY created',[c.uid])}}
export async function register(c:Context,input:Record<string,any>){
 if(Object.keys(input).some(k=>!['transport','subscription','deviceClass'].includes(k)))fail(400,'Unsupported device field')
 if(input.transport!=='webpush')fail(400,'Only webpush transport is supported; relay and direct are unavailable')
 const deviceClass=input.deviceClass??'desktop';if(!['desktop','mobile'].includes(deviceClass))fail(400,'Choose desktop or mobile device class')
 const sub=await subscription(input.subscription),hash=await endpointHash(sub.endpoint)
 const old=await c.one('SELECT id,user,session,version FROM nook_push_devices WHERE endpoint_hash=?',[hash])
 if(old&&old.user!==c.uid)fail(409,'Subscription unavailable; unsubscribe in this browser and enable again')
 const count=await c.one('SELECT count(*) AS n FROM nook_push_devices WHERE user=?',[c.uid]);if(!old&&count.n>=10)fail(409,'Remove an old device first')
 const reuse=old?.session===c.session.id&&old?.version===c.session.operator.version,device=reuse?old.id:crypto.randomUUID(),now=Date.now()
 await c.batch([...(old&&!reuse?[c.sql('DELETE FROM nook_push_devices WHERE id=? AND user=?',old.id,c.uid)]:[]),c.sql(`INSERT INTO nook_push_devices(id,user,session,version,transport,endpoint_hash,subscription,created,updated,device_class) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET session=excluded.session,version=excluded.version,subscription=excluded.subscription,updated=excluded.updated,device_class=excluded.device_class`,device,c.uid,c.session.id,c.session.operator.version,'webpush',hash,JSON.stringify(sub),now,now,deviceClass),c.sql('INSERT OR IGNORE INTO nook_notify_preferences(user,updated,push_initialized) VALUES(?,?,0)',c.uid,now),c.sql('UPDATE nook_notify_preferences SET push_mentions=1,push_direct=1,push_threads=1,push_initialized=1,updated=? WHERE user=? AND push_initialized=0',now,c.uid)],undefined,'NOT EXISTS(SELECT 1 FROM nook_push_devices WHERE endpoint_hash=? AND user<>?) AND (? OR (SELECT count(*) FROM nook_push_devices WHERE user=?)<10)',[hash,c.uid,old?1:0,c.uid])
 await c.hint();return {id:device,transport:'webpush'}
}
export async function remove(c:Context,input:Record<string,any>){
 if(Object.keys(input).some(k=>k!=='id'))fail(400,'Unsupported device field')
 const device=id(input.id);await c.batch([c.sql('DELETE FROM nook_push_devices WHERE id=? AND user=?',device,c.uid)]);await c.hint();return {ok:true}
}
export async function presence(c:Context,input:Record<string,any>){
 if(Object.keys(input).some(k=>!['id','page','visible'].includes(k))||typeof input.visible!=='boolean')fail(400,'Invalid presence')
 const device=id(input.id),page=id(input.page),owned=await c.one('SELECT id FROM nook_push_devices WHERE id=? AND user=? AND session=?',[device,c.uid,c.session.id]);if(!owned)fail(404,'Device unavailable')
 await c.batch([c.sql('DELETE FROM nook_push_presence WHERE page=? AND user=?',page,c.uid),...(input.visible?[c.sql('INSERT INTO nook_push_presence VALUES(?,?,?,?,?)',page,device,c.uid,c.session.id,Date.now()+PRESENCE_MS)]:[]),c.sql("UPDATE nook_notify_queue SET due=max(created+?,min(due,?)) WHERE channel='push' AND user=? AND state='pending'",PUSH_GATHER_MS,Date.now(),c.uid)],undefined,'EXISTS(SELECT 1 FROM nook_push_devices WHERE id=? AND user=? AND session=?)',[device,c.uid,c.session.id])
 await c.hint();return {ok:true}
}
export async function revokeSession(c:Context){await c.batch([c.sql('DELETE FROM nook_push_devices WHERE user=? AND session=?',c.uid,c.session.id)])}
