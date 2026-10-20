import type {Context} from '../platform/storage/context'
import {fail} from '../family/team-chat/domain'
export async function mobileSettings(c:Context){const row=await c.one('SELECT mobile_when_active,mobile_delay_minutes FROM nook_notify_preferences WHERE user=?',[c.uid]);return {mobileWhenActive:row?.mobile_when_active??'inactive',mobileDelayMinutes:row?.mobile_delay_minutes??0}}
export function mobileStatements(c:Context,input:Record<string,any>){
 if(input.mobileWhenActive!==undefined&&!['inactive','always'].includes(input.mobileWhenActive)||input.mobileDelayMinutes!==undefined&&![0,1,2,5,10,15,30].includes(input.mobileDelayMinutes))fail(400,'Choose mobile routing and a supported delay')
 return [c.sql('INSERT OR IGNORE INTO nook_notify_preferences(user,updated,push_initialized) VALUES(?,?,0)',c.uid,Date.now()),c.sql('UPDATE nook_notify_preferences SET mobile_when_active=COALESCE(?,mobile_when_active),mobile_delay_minutes=COALESCE(?,mobile_delay_minutes),updated=? WHERE user=?',input.mobileWhenActive??null,input.mobileDelayMinutes??null,Date.now(),c.uid)]
}
