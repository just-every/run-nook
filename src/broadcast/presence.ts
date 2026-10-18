import type {Context} from '../platform/storage/context'
import {fail} from '../family/team-chat/domain'
export async function broadcastPresence(c:Context,input:Record<string,unknown>){
 if(Object.keys(input).some(k=>!['page','visible','zone','away'].includes(k))||typeof input.page!=='string'||!input.page||input.page.length>128||typeof input.visible!=='boolean'||input.away!==undefined&&typeof input.away!=='boolean'||typeof input.zone!=='string')fail(400,'Provide page, visible and a time zone')
 try{new Intl.DateTimeFormat('en',{timeZone:input.zone as string})}catch{fail(400,'Choose a valid time zone')}
 await c.batch([
  c.sql('DELETE FROM nook_broadcast_presence WHERE session=? AND page=?',c.session.id,input.page),
  ...(input.visible?[c.sql('INSERT INTO nook_broadcast_presence VALUES(?,?,?,?)',input.page,c.uid,c.session.id,Date.now())]:[]),
  c.sql('INSERT INTO nook_broadcast_choices(user,zone,away) VALUES(?,?,COALESCE(?,0)) ON CONFLICT(user) DO UPDATE SET zone=excluded.zone,away=COALESCE(?,away)',c.uid,input.zone,input.away===undefined?null:Number(input.away),input.away===undefined?null:Number(input.away)),
  c.sql('DELETE FROM nook_broadcast_presence WHERE heartbeat<?',Date.now()-600000),
 ])
 return {ok:true,away:!!(await c.one('SELECT away FROM nook_broadcast_choices WHERE user=?',[c.uid]))?.away}
}
