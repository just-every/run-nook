import type {Context} from '../platform/storage/context'
import {fail} from '../family/team-chat/domain'
import {subscription,endpointHash} from './subscription'
import {vapid} from './crypto'
import {PUSH_GATHER_MS} from './queue'
import {activeDesktopUntil} from './activity'
export const PRESENCE_MS=45_000
const id=(v:unknown)=>typeof v==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(v)?v:fail(400,'Invalid device or page')
export async function devices(c:Context){
 const now=Date.now(),until=activeDesktopUntil('d.user')
 const devices=await c.rows(`SELECT d.id,d.name,d.transport,d.device_class AS deviceClass,d.created,d.updated,COALESCE((SELECT max(last_input_at) FROM nook_push_presence WHERE device=d.id),0) AS lastInputAt,EXISTS(SELECT 1 FROM nook_push_presence p JOIN oa_sessions s ON s.id=p.session JOIN oa_operators o ON o.id=p.user WHERE p.device=d.id AND min(p.expires,p.last_input_at+600000,s.expires_at)>? AND s.revoked_at IS NULL AND s.operator_version=o.version AND d.version=o.version AND o.status='active') AS active,EXISTS(SELECT 1 FROM nook_notify_queue q WHERE q.device=d.id AND q.user=d.user AND q.state IN ('pending','retrying') AND q.held_at IS NOT NULL AND q.released_at IS NULL) AS waiting,${until}>? AS activeElsewhere,COALESCE((SELECT mobile_when_active FROM nook_notify_preferences WHERE user=d.user),'inactive') AS mobileWhenActive FROM nook_push_devices d WHERE d.user=? ORDER BY d.created`,[now,now,c.uid])
 const clients=await c.rows("SELECT p.device AS id,'Web client' AS name,'web' AS transport,p.device_class AS deviceClass,p.last_input_at AS lastInputAt,min(p.expires,p.last_input_at+600000)>? AS active,0 AS activeElsewhere,'inactive' AS mobileWhenActive FROM nook_push_presence p JOIN oa_sessions s ON s.id=p.session JOIN oa_operators o ON o.id=p.user WHERE p.user=? AND p.device='web-'||p.page AND p.expires>? AND s.revoked_at IS NULL AND s.expires_at>? AND s.operator_version=o.version AND o.status='active'",[now,c.uid,now,now])
 const alerts=await c.rows("SELECT id,device,reason,state,error,created,updated,held_at AS heldAt,released_at AS releasedAt,active_until AS activeUntil,due FROM nook_notify_queue WHERE channel='push' AND user=? AND held_at IS NOT NULL ORDER BY created DESC LIMIT 100",[c.uid])
 const activeNames=[...devices,...clients].filter(d=>d.deviceClass==='desktop'&&d.active).map(d=>d.name).join(', ')||'desktop/web'
 return {publicKey:(await vapid(c.env)).publicKey,transport:'webpush',devices:[...devices,...clients].map(d=>({...d,lockState:'unavailable',routing:d.deviceClass==='mobile'&&d.activeElsewhere&&d.mobileWhenActive==='inactive'?'Phone held: active on '+activeNames:d.waiting?'Phone held: waiting for mobile delay':'Alerts enabled'})),alerts}
}
export async function register(c:Context,input:Record<string,any>){
 if(Object.keys(input).some(k=>!['transport','subscription','deviceClass','name'].includes(k)))fail(400,'Unsupported device field')
 if(input.transport!=='webpush')fail(400,'Only webpush transport is supported; relay and direct are unavailable')
 const deviceClass=input.deviceClass??'desktop';if(!['desktop','mobile'].includes(deviceClass))fail(400,'Choose desktop or mobile device class')
 const name=input.name??(deviceClass==='mobile'?'Phone or tablet':'Desktop web');if(typeof name!=='string'||!name.trim()||name.length>80)fail(400,'Invalid device name')
 const sub=await subscription(input.subscription),hash=await endpointHash(sub.endpoint)
 const old=await c.one('SELECT id,user,session,version FROM nook_push_devices WHERE endpoint_hash=?',[hash])
 if(old&&old.user!==c.uid)fail(409,'Subscription unavailable; unsubscribe in this browser and enable again')
 const count=await c.one('SELECT count(*) AS n FROM nook_push_devices WHERE user=?',[c.uid]);if(!old&&count.n>=10)fail(409,'Remove an old device first')
 const reuse=old?.session===c.session.id&&old?.version===c.session.operator.version,device=reuse?old.id:crypto.randomUUID(),now=Date.now()
 await c.batch([...(old&&!reuse?[c.sql('DELETE FROM nook_push_devices WHERE id=? AND user=?',old.id,c.uid)]:[]),c.sql(`INSERT INTO nook_push_devices(id,user,session,version,transport,endpoint_hash,subscription,created,updated,device_class,name) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET session=excluded.session,version=excluded.version,subscription=excluded.subscription,updated=excluded.updated,device_class=excluded.device_class,name=excluded.name`,device,c.uid,c.session.id,c.session.operator.version,'webpush',hash,JSON.stringify(sub),now,now,deviceClass,name.trim()),c.sql('INSERT OR IGNORE INTO nook_notify_preferences(user,updated,push_initialized) VALUES(?,?,0)',c.uid,now),c.sql('UPDATE nook_notify_preferences SET push_mentions=1,push_direct=1,push_threads=1,push_initialized=1,updated=? WHERE user=? AND push_initialized=0',now,c.uid)],undefined,'NOT EXISTS(SELECT 1 FROM nook_push_devices WHERE endpoint_hash=? AND user<>?) AND (? OR (SELECT count(*) FROM nook_push_devices WHERE user=?)<10)',[hash,c.uid,old?1:0,c.uid])
 await c.hint();return {id:device,transport:'webpush'}
}
export async function remove(c:Context,input:Record<string,any>){
 if(Object.keys(input).some(k=>k!=='id'))fail(400,'Unsupported device field')
 const device=id(input.id);await c.batch([c.sql('DELETE FROM nook_push_devices WHERE id=? AND user=?',device,c.uid),c.sql("UPDATE nook_notify_queue SET due=max(created+?,min(due,?)) WHERE channel='push' AND user=? AND state='pending'",PUSH_GATHER_MS,Date.now(),c.uid)]);await c.hint();return {ok:true}
}
export async function presence(c:Context,input:Record<string,any>){
 if(Object.keys(input).some(k=>!['id','page','visible','lastInputAt','deviceClass'].includes(k))||typeof input.visible!=='boolean')fail(400,'Invalid presence')
 const now=Date.now(),lastInputAt=input.lastInputAt??0;if(!Number.isSafeInteger(lastInputAt)||lastInputAt<0||lastInputAt>now)fail(400,'Invalid last input time')
 const device=id(input.id),page=id(input.page),owned=await c.one('SELECT id FROM nook_push_devices WHERE id=? AND user=? AND session=?',[device,c.uid,c.session.id]);if(!owned&&device!=='web-'+page)fail(404,'Device unavailable')
 const deviceClass=input.deviceClass??'desktop';if(!['desktop','mobile'].includes(deviceClass))fail(400,'Invalid device class')
 await c.batch([c.sql('DELETE FROM nook_push_presence WHERE page=? AND user=?',page,c.uid),c.sql('INSERT INTO nook_push_presence(page,device,user,session,expires,last_input_at,device_class) VALUES(?,?,?,?,?,?,?)',page,device,c.uid,c.session.id,input.visible?now+PRESENCE_MS:now,lastInputAt,deviceClass),c.sql("UPDATE nook_notify_queue SET due=max(created+?,min(due,?)) WHERE channel='push' AND user=? AND state='pending'",PUSH_GATHER_MS,Date.now(),c.uid)],undefined,'(EXISTS(SELECT 1 FROM nook_push_devices WHERE id=? AND user=? AND session=?) OR ?=?)',[device,c.uid,c.session.id,device,'web-'+page])
 await c.hint();return {ok:true}
}
export async function revokeSession(c:Context){await c.batch([c.sql('DELETE FROM nook_push_devices WHERE user=? AND session=?',c.uid,c.session.id),c.sql("UPDATE nook_notify_queue SET due=max(created+?,min(due,?)) WHERE channel='push' AND user=? AND state='pending'",PUSH_GATHER_MS,Date.now(),c.uid)]);await c.hint()}
