import type {Context} from '../platform/storage/context'
import {defaultDays,quietAt,quietInput,type QuietSchedule} from './quiet-time'
export type QuietRow={user:string;enabled:number;zone:string;days_json:string;version:number;updated:number;quiet_until:number;next_change:number|null}
export const rowSchedule=(row:QuietRow):QuietSchedule=>({enabled:!!row.enabled,zone:row.zone,days:JSON.parse(row.days_json),version:row.version})
/** Called by both queue runners, including with no browser open. Only expired
 * boundary caches are recomputed, and a raced preference edit wins by version. */
export async function syncQuiet(db:D1Database,now=Date.now(),user?:string){
 const rows=(await db.prepare(`SELECT q.*,v.starts AS vacation_start,v.ends AS vacation_end FROM nook_quiet_schedules q LEFT JOIN nook_vacations v ON v.user=q.user WHERE ${user?'q.user=? AND':'(enabled=1 OR v.ends>0) AND'} (next_change IS NULL OR next_change<=?)`).bind(...(user?[user]:[]),now).all<QuietRow>()).results
 for(const row of rows){const point=quietAt(rowSchedule(row),now);const vacation=row as QuietRow&{vacation_start?:number;vacation_end?:number};if(vacation.vacation_start!==undefined&&vacation.vacation_end!==undefined){if(vacation.vacation_start<=now&&vacation.vacation_end>now)point.until=Math.max(point.until,vacation.vacation_end);const boundaries=[point.next,vacation.vacation_start,vacation.vacation_end].filter((v):v is number=>typeof v==='number'&&v>now);point.next=boundaries.length?Math.min(...boundaries):null;}if(point.until!==row.quiet_until||point.next!==row.next_change)await db.prepare('UPDATE nook_quiet_schedules SET quiet_until=?,next_change=? WHERE user=? AND version=?').bind(point.until,point.next,row.user,row.version).run()}
}
export async function quietSettings(c:Context){
 await syncQuiet(c.db,Date.now(),c.uid)
 const row=await c.one<QuietRow>('SELECT * FROM nook_quiet_schedules WHERE user=?',[c.uid])
 const zone=(await c.one<{zone:string}>('SELECT zone FROM nook_profiles WHERE user=?',[c.uid]))?.zone??'UTC'
 return row?{...rowSchedule(row),until:row.quiet_until,next:row.next_change}:{enabled:false,zone,days:defaultDays(),version:0,until:0,next:null}
}
export function quietStatements(c:Context,input:any,now:number){
 const schedule=quietInput(input),point=quietAt(schedule,now),key=crypto.randomUUID()
 return [c.sql('INSERT INTO nook_guard VALUES(?,CASE WHEN COALESCE((SELECT version FROM nook_quiet_schedules WHERE user=?),0)=? THEN 1 ELSE 0 END)',key,c.uid,schedule.version),c.sql('INSERT INTO nook_quiet_schedules(user,enabled,zone,days_json,version,updated,quiet_until,next_change) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(user) DO UPDATE SET enabled=excluded.enabled,zone=excluded.zone,days_json=excluded.days_json,version=excluded.version,updated=excluded.updated,quiet_until=excluded.quiet_until,next_change=excluded.next_change',c.uid,+schedule.enabled,schedule.zone,JSON.stringify(schedule.days),schedule.version+1,now,point.until,0),c.sql('DELETE FROM nook_guard WHERE id=?',key)]
}
