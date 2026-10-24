import type {Context} from '../platform/storage/context';
import {fail} from '../family/team-chat/domain';
import {defaultDays} from './quiet-time';
export function vacationStatements(c:Context,input:any,now:number){
 if(input!==null&&(!input||Object.keys(input).sort().join()!=='ends,starts'||!Number.isSafeInteger(input.starts)||!Number.isSafeInteger(input.ends)||input.starts<0||input.starts>=input.ends||input.ends<=now||input.ends>now+366*86400000))fail(400,'Choose a vacation ending in the next year, after its start');
 return [c.sql("INSERT OR IGNORE INTO nook_quiet_schedules(user,enabled,zone,days_json,version,updated,quiet_until,next_change) VALUES(?,0,'UTC',?,1,?,0,0)",c.uid,JSON.stringify(defaultDays()),now),...(input===null?[c.sql('DELETE FROM nook_vacations WHERE user=?',c.uid)]:[c.sql('INSERT INTO nook_vacations VALUES(?,?,?) ON CONFLICT(user) DO UPDATE SET starts=excluded.starts,ends=excluded.ends',c.uid,input.starts,input.ends)]),c.sql('UPDATE nook_quiet_schedules SET next_change=0,version=version+1 WHERE user=?',c.uid)];
}
