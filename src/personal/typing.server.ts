import type {Context} from '../platform/storage/context'
import {fail} from '../family/team-chat/domain'
import {allowedGrant,visibleIdentity} from '../team/access'
import {literal} from '../broadcast/policy'

const clock="CAST(unixepoch('subsec')*1000 AS INTEGER)"
const enabled=(user:string)=>`COALESCE((SELECT typing_enabled FROM nook_profiles WHERE user=${user}),1)=1`
export async function typing(c:Context,conversation:string){
 const observedAt=Date.now()
 // Both ends are current members in this snapshot. A retained heartbeat from
 // a revoked session, removed guest grant or disabled preference is invisible.
 const rows=await c.rows<{id:string;name:string;expires:number;count:number;next_expiry:number}>(`SELECT id,name,expires,count(*) OVER() AS count,min(expires) OVER() AS next_expiry FROM (
  SELECT o.id,o.display_name AS name,max(t.expires) AS expires FROM nook_typing t
  JOIN oa_sessions s ON s.id=t.session AND s.operator_id=t.user
  JOIN oa_operators o ON o.id=t.user AND o.version=s.operator_version
  JOIN nook_members m ON m.user=t.user AND m.conversation=t.conversation
  WHERE t.conversation=? AND t.user<>? AND t.expires>${clock}
  AND o.status='active' AND s.revoked_at IS NULL AND s.expires_at>${clock}
  AND ${allowedGrant('m.user','m.conversation')}
  AND ${visibleIdentity(literal(c.uid),'o.id')}
  AND ${enabled('t.user')} AND ${enabled(literal(c.uid))}
  GROUP BY o.id,o.display_name
 ) ORDER BY name COLLATE NOCASE,id LIMIT 50`,[conversation,c.uid],conversation)
 return {people:rows.map(row=>({id:row.id,name:row.name,expiresAt:row.expires})),count:rows[0]?.count??0,nextExpiry:rows[0]?.next_expiry??null,observedAt}
}
export async function updateTyping(c:Context,conversation:string,input:unknown){
 if(!input||typeof input!=='object'||Array.isArray(input))return fail(400,'Provide a typing page and choice')
 const data=input as Record<string,unknown>
 if(Object.keys(data).some(key=>!['page','typing'].includes(key))||typeof data.page!=='string'||!data.page.trim()||data.page.length>128||typeof data.typing!=='boolean')return fail(400,'Provide a typing page up to 128 characters and a boolean choice')
 if(data.typing&&!await c.one(`SELECT 1 WHERE ${enabled(literal(c.uid))}`,[],conversation))return fail(403,'Typing indicators are disabled')
 await c.batch([
  c.sql('DELETE FROM nook_typing WHERE session=? AND page=? AND conversation=?',c.session.id,data.page,conversation),
  ...(data.typing?[c.sql(`INSERT INTO nook_typing(session,page,user,conversation,expires) VALUES(?,?,?,?,${clock}+7000) ON CONFLICT(session,page) DO UPDATE SET user=excluded.user,conversation=excluded.conversation,expires=excluded.expires`,c.session.id,data.page,c.uid,conversation)]:[]),
  c.sql(`DELETE FROM nook_typing WHERE expires<=${clock}`),
 ],conversation,data.typing?enabled(literal(c.uid)):'1')
 return {ok:true as const}
}
