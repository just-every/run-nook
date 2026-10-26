import {quietSettings} from '../notify/quiet'
import {explainDelivery} from '../notify/explain'
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
 const devices=await c.rows(`SELECT d.id,d.name,d.transport,d.session=? AS current,d.device_class AS deviceClass,d.mobile_always AS mobileAlways,d.created,d.updated,COALESCE((SELECT max(last_input_at) FROM nook_push_presence WHERE device=d.id),0) AS lastInputAt,EXISTS(SELECT 1 FROM nook_push_presence p JOIN oa_sessions s ON s.id=p.session JOIN oa_operators o ON o.id=p.user WHERE p.device=d.id AND min(p.expires,p.last_input_at+600000,s.expires_at)>? AND s.revoked_at IS NULL AND s.operator_version=o.version AND d.version=o.version AND o.status='active') AS active,EXISTS(SELECT 1 FROM nook_notify_queue q WHERE q.device=d.id AND q.user=d.user AND q.state IN ('pending','retrying') AND q.held_at IS NOT NULL AND q.released_at IS NULL) AS waiting,${until}>? AS activeElsewhere,COALESCE((SELECT mobile_when_active FROM nook_notify_preferences WHERE user=d.user),'inactive') AS mobileWhenActive FROM nook_push_devices d WHERE d.user=? ORDER BY current DESC,d.created`,[c.session.id,now,now,c.uid])
 const clients=await c.rows("SELECT min(p.device) AS id,'Browser' AS name,'web' AS transport,p.session=? AS current,CASE WHEN max(p.device_class='mobile') THEN 'mobile' ELSE 'desktop' END AS deviceClass,0 AS mobileAlways,max(p.last_input_at) AS lastInputAt,max(min(p.expires,p.last_input_at+600000)>?) AS active,0 AS activeElsewhere,'inactive' AS mobileWhenActive FROM nook_push_presence p JOIN oa_sessions s ON s.id=p.session JOIN oa_operators o ON o.id=p.user WHERE p.user=? AND p.device='web-'||p.page AND p.expires>? AND s.revoked_at IS NULL AND s.expires_at>? AND s.operator_version=o.version AND o.status='active' AND NOT EXISTS(SELECT 1 FROM nook_push_devices d WHERE d.user=p.user AND d.session=p.session) GROUP BY p.session ORDER BY current DESC",[c.session.id,now,c.uid,now,now])
 const quiet=await quietSettings(c),manual=(await c.one('SELECT dnd_until FROM nook_settings WHERE user=?',[c.uid]))?.dnd_until??0
 const alerts=await c.rows("SELECT q.id,q.channel,q.device,q.reason,q.state,q.error,q.created,q.updated,q.held_at AS heldAt,q.released_at AS releasedAt,q.active_until AS activeUntil,q.due,(SELECT snooze_until FROM nook_attention a WHERE a.id=COALESCE(q.attention,q.dedupe) AND a.state='snoozed') AS snoozeUntil,(SELECT CASE q.channel WHEN 'email' THEN urgent_quiet ELSE push_urgent_quiet END FROM nook_notify_preferences p WHERE p.user=q.user) AS quietBypass FROM nook_notify_queue q WHERE q.user=? AND q.updated>? ORDER BY q.created DESC LIMIT 100",[c.uid,now-7*86400_000])
 for(const alert of alerts)alert.explanation=explainDelivery(alert,quiet.until,manual,now)
 const activeNames=[...devices,...clients].filter(d=>d.deviceClass==='desktop'&&d.active).map(d=>d.current?'this browser':['Desktop web','Web client'].includes(d.name)?'another browser':d.name).join(', ')||'another browser'
 return {publicKey:(await vapid(c.env)).publicKey,transport:'webpush',devices:[...devices,...clients].sort((a,b)=>b.current-a.current).map(d=>({...d,lockState:'unavailable',routing:d.deviceClass==='mobile'&&d.mobileAlways?'Always send: this device':d.deviceClass==='mobile'&&d.activeElsewhere&&d.mobileWhenActive==='inactive'?'Phone held: active on '+activeNames:d.waiting?'Phone held: waiting for mobile delay':'Alerts enabled'})),alerts}
}
/** One phone or tablet may alert while the member is active elsewhere even when the
 * account holds phones. Only the member sets it, only on their own device. */
export async function setMobile(c:Context,input:Record<string,any>){
 if(Object.keys(input).some(k=>!['id','mobileWhenActive'].includes(k))||!['account','always'].includes(input.mobileWhenActive))fail(400,'Choose the account setting or always send for this device')
 const device=id(input.id),owned=await c.one("SELECT device_class FROM nook_push_devices WHERE id=? AND user=?",[device,c.uid]);if(!owned)fail(404,'Device unavailable')
 if(owned.device_class!=='mobile')fail(400,'Only a phone or tablet can always receive alerts')
 await c.batch([c.sql('UPDATE nook_push_devices SET mobile_always=?,updated=? WHERE id=? AND user=?',input.mobileWhenActive==='always'?1:0,Date.now(),device,c.uid),c.sql("UPDATE nook_notify_queue SET due=max(created+?,min(due,?)) WHERE channel='push' AND user=? AND device=? AND state='pending'",PUSH_GATHER_MS,Date.now(),c.uid,device)]);await c.hint()
 return {id:device,mobileWhenActive:input.mobileWhenActive}
}
export async function register(c:Context,input:Record<string,any>){
 if(Object.keys(input).some(k=>!['transport','subscription','deviceClass','name'].includes(k)))fail(400,'Unsupported device field')
 if(input.transport!=='webpush')fail(400,'Only webpush transport is supported; relay and direct are unavailable')
 const deviceClass=input.deviceClass??'desktop';if(!['desktop','mobile'].includes(deviceClass))fail(400,'Choose desktop or mobile device class')
 const name=input.name??(deviceClass==='mobile'?'Phone or tablet':'Browser');if(typeof name!=='string'||!name.trim()||name.length>80)fail(400,'Invalid device name')
 const sub=await subscription(input.subscription),hash=await endpointHash(sub.endpoint)
 const old=await c.one('SELECT id,user,session,version FROM nook_push_devices WHERE endpoint_hash=?',[hash])
 if(old&&old.user!==c.uid)fail(409,'Subscription unavailable; unsubscribe in this browser and enable again')
 const count=await c.one('SELECT count(*) AS n FROM nook_push_devices WHERE user=?',[c.uid]);if(!old&&count.n>=10)fail(409,'Remove an old device first')
 const reuse=old?.session===c.session.id&&old?.version===c.session.operator.version,device=reuse?old.id:crypto.randomUUID(),now=Date.now()
 await c.batch([...(old&&!reuse?[c.sql('DELETE FROM nook_push_devices WHERE id=? AND user=?',old.id,c.uid)]:[]),c.sql(`INSERT INTO nook_push_devices(id,user,session,version,transport,endpoint_hash,subscription,created,updated,device_class,name) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET session=excluded.session,version=excluded.version,subscription=excluded.subscription,updated=excluded.updated,device_class=excluded.device_class,name=excluded.name`,device,c.uid,c.session.id,c.session.operator.version,'webpush',hash,JSON.stringify(sub),now,now,deviceClass,name.trim()),c.sql('INSERT OR IGNORE INTO nook_notify_preferences(user,updated,push_initialized) VALUES(?,?,0)',c.uid,now),c.sql('UPDATE nook_notify_preferences SET push_mentions=1,push_direct=1,push_threads=1,push_keywords=1,push_initialized=1,updated=? WHERE user=? AND push_initialized=0',now,c.uid)],undefined,'NOT EXISTS(SELECT 1 FROM nook_push_devices WHERE endpoint_hash=? AND user<>?) AND (? OR (SELECT count(*) FROM nook_push_devices WHERE user=?)<10)',[hash,c.uid,old?1:0,c.uid])
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
