import type {Context} from '../platform/storage/context';
import {fail} from '../family/team-chat/domain';
const fields=['mentions','urgent','urgentQuiet','direct','threads','keywords','broadcasts'];
const owner=(user:string)=>`EXISTS(SELECT 1 FROM oa_operators o JOIN nook_access a ON a.user=o.id WHERE o.id=${user} AND o.role='owner' AND o.status='active' AND a.active=1 AND a.mode='member')`;
export async function notificationDefaults(c:Context){
 if(!await c.one(`SELECT 1 WHERE ${owner('?')}`,[c.uid]))fail(403,'Only owners manage new-member notification defaults');
 const row=await c.one('SELECT * FROM nook_notification_defaults WHERE id=1');
 return {version:row?.version??0,push:row?JSON.parse(row.push_json):Object.fromEntries(fields.map(f=>[f,f!=='urgentQuiet'])),channels:row?JSON.parse(row.channels_json):[],awayEmail:!!row?.away_email,defaultChannels:await c.rows('SELECT c.id,c.name FROM nook_default_channels d JOIN nook_conversations c ON c.id=d.conversation ORDER BY c.name')};
}
export async function updateNotificationDefaults(c:Context,input:any){
 const current=await notificationDefaults(c);
 if(!input||Object.keys(input).sort().join()!=='awayEmail,channels,push,version'||input.version!==current.version||typeof input.awayEmail!=='boolean'||!input.push||Object.keys(input.push).sort().join()!==[...fields].sort().join()||Object.values(input.push).some(v=>typeof v!=='boolean')||!Array.isArray(input.channels)||input.channels.length>50||input.channels.some((r:any)=>!r||Object.keys(r).sort().join()!=='id,level'||!current.defaultChannels.some(d=>d.id===r.id)||!['all','mentions','nothing'].includes(r.level))||new Set(input.channels.map((r:any)=>r.id)).size!==input.channels.length)fail(400,'Choose current default channels, push events and email policy');
 await c.batch([c.sql('INSERT INTO nook_notification_defaults VALUES(1,?,?,?,?) ON CONFLICT(id) DO UPDATE SET version=excluded.version,push_json=excluded.push_json,channels_json=excluded.channels_json,away_email=excluded.away_email',current.version+1,JSON.stringify(input.push),JSON.stringify(input.channels),+input.awayEmail),c.sql("INSERT INTO nook_audit VALUES(?,?,'notification-defaults',?,'policy.notifications','workspace',?,?,'confirmed',?)",crypto.randomUUID(),c.uid,Date.now(),current.version+1,'New-member notification defaults',input.channels.length)],undefined,`${owner('?')} AND COALESCE((SELECT version FROM nook_notification_defaults WHERE id=1),0)=? AND NOT EXISTS(SELECT 1 FROM json_each(?) j WHERE NOT EXISTS(SELECT 1 FROM nook_default_channels d WHERE d.conversation=json_extract(j.value,'$.id')))`,[c.uid,current.version,JSON.stringify(input.channels)]);
 return notificationDefaults(c);
}
export async function initialNotificationStatements(c:Context){
 const row=await c.one('SELECT * FROM nook_notification_defaults WHERE id=1'),pending="EXISTS(SELECT 1 FROM nook_default_admissions WHERE user=? AND state='pending')";
 const push=row?JSON.parse(row.push_json):null,channels=row?JSON.parse(row.channels_json):[];
 const statements=[c.sql(`INSERT OR IGNORE INTO nook_notify_preferences(user,updated,push_initialized) SELECT ?,?,0 WHERE ${pending}`,c.uid,Date.now(),c.uid),c.sql(`UPDATE nook_notify_preferences SET away_email=?,email_offer_seen=? WHERE user=? AND ${pending}`,row?.away_email??0,row?.away_email?1:0,c.uid,c.uid)];
 if(push)statements.push(c.sql(`UPDATE nook_notify_preferences SET push_mentions=?,push_urgent=?,push_urgent_quiet=?,push_direct=?,push_threads=?,push_keywords=?,push_initialized=1 WHERE user=? AND ${pending}`,+push.mentions,+push.urgent,+push.urgentQuiet,+push.direct,+push.threads,+push.keywords,c.uid,c.uid),c.sql(`INSERT INTO nook_broadcast_choices(user,push) SELECT ?,? WHERE ${pending} ON CONFLICT(user) DO UPDATE SET push=excluded.push`,c.uid,+push.broadcasts,c.uid));
 for(const channel of channels)statements.push(c.sql(`INSERT OR IGNORE INTO nook_conversation_notify(user,conversation,level,threads) SELECT ?,?,?,'followed' WHERE ${pending} AND EXISTS(SELECT 1 FROM nook_default_channels WHERE conversation=?)`,c.uid,channel.id,channel.level,c.uid,channel.id));
 statements.push(c.sql(`INSERT INTO nook_audit SELECT ?,?,'notification-defaults',?,'policy.notifications.adopt','workspace',?,'New-member defaults applied','confirmed',? WHERE ${pending}`,crypto.randomUUID(),c.uid,Date.now(),row?.version??0,channels.length,c.uid));
 return {version:row?.version??0,statements};
}
