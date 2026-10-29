import {pushBroadcastChoice} from '../broadcast/policy'
import type {Context} from '../platform/storage/context'
import {fail} from '../family/team-chat/domain'
const fields={mentions:'push_mentions',urgent:'push_urgent',urgentQuiet:'push_urgent_quiet',direct:'push_direct',threads:'push_threads',keywords:'push_keywords'} as const
export async function pushSettings(c:Context){
 const since=Date.now()-7*86400_000
 const [p,problems,caused,workspace]=await Promise.all([c.one('SELECT thread_badge,push_mentions,push_urgent,push_urgent_quiet,push_direct,push_threads,push_keywords FROM nook_notify_preferences WHERE user=?',[c.uid]),
 c.rows("SELECT error,state,updated FROM nook_notify_queue WHERE channel='push' AND user=? AND state IN ('retrying','failed') AND updated>? ORDER BY updated DESC LIMIT 5",[c.uid,since]),
 c.rows("SELECT q.error,q.state,q.updated,o.display_name AS recipient FROM nook_notify_queue q JOIN oa_operators o ON o.id=q.user WHERE q.channel='push' AND q.actor=? AND q.state IN ('retrying','failed') AND q.updated>? ORDER BY q.updated DESC LIMIT 5",[c.uid,since]),
 c.operator.role==='owner'?c.one("SELECT count(*) AS count,(SELECT error FROM nook_notify_queue WHERE channel='push' AND state IN ('retrying','failed') AND updated>? ORDER BY updated DESC LIMIT 1) AS error,(SELECT state FROM nook_notify_queue WHERE channel='push' AND state IN ('retrying','failed') AND updated>? ORDER BY updated DESC LIMIT 1) AS state FROM nook_notify_queue WHERE channel='push' AND state IN ('retrying','failed') AND updated>?",[since,since,since]):null,
 ])
 const broadcasts=!!(await c.one(`SELECT ${pushBroadcastChoice('?')} AS enabled`,[c.uid,c.uid]))?.enabled
 return {threadBadge:p?.thread_badge??'all',broadcasts,...Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,!!p?.[v]])),problems,notDelivered:caused,workspace}
}
export function pushPreferenceStatements(c:Context,input:unknown){
 if(!input||typeof input!=='object'||Array.isArray(input)||!Object.keys(input).length||Object.entries(input).some(([k,v])=>!(Object.hasOwn(fields,k)||k==='broadcasts'||k==='threadBadge')||(k==='threadBadge'?!['all','mentions'].includes(v as string):typeof v!=='boolean')))fail(400,'Only boolean push mentions, urgent, urgentQuiet, direct and threads choices are supported')
 const value=input as Record<string,boolean|string>,entries=Object.entries(value).filter(([k])=>k!=='broadcasts'&&k!=='threadBadge')
 return [...(Object.hasOwn(value,'broadcasts')?[c.sql('INSERT INTO nook_broadcast_choices(user,push) VALUES(?,?) ON CONFLICT(user) DO UPDATE SET push=excluded.push',c.uid,+value.broadcasts)]:[]),c.sql('INSERT OR IGNORE INTO nook_notify_preferences(user,updated,push_initialized) VALUES(?,?,0)',c.uid,Date.now()),...(Object.hasOwn(value,'threadBadge')?[c.sql('UPDATE nook_notify_preferences SET thread_badge=?,updated=? WHERE user=?',value.threadBadge,Date.now(),c.uid)]:[]),...(entries.length?[c.sql(`UPDATE nook_notify_preferences SET push_initialized=1,${entries.map(([k])=>fields[k as keyof typeof fields]+'=?').join(',')},updated=? WHERE user=?`,...entries.map(([,v])=>+v),Date.now(),c.uid)]:[])]
}
