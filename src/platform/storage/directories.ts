import {fail} from '../../family/team-chat/domain'
import {allowedGrant,cancelledInvitation,productAccess,visibleIdentity} from '../../team/access'
import {Context} from './context'
export async function directoryPage(c:Context,kind:'users'|'members'|'team',id='',input:Record<string,any>={}){
 const after=input.after??'',q=input.q??'',limit=Number(input.limit??1000)
 if(typeof after!=='string'||after.length>128||typeof q!=='string'||q.length>200||!Number.isSafeInteger(limit)||limit<1||limit>1000)fail(400,'Invalid directory page')
 let rows:any[]
 if(kind==='team'){
  if(!['owner','admin'].includes(c.session.operator.role))fail(403,'Team management is restricted to an authorized owner or admin')
  await c.batch([],undefined,"EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND status='active' AND role IN ('owner','admin'))",[c.uid])
  rows=await c.rows(`SELECT o.id,o.display_name AS name,o.email,o.role,o.status,COALESCE(a.mode,'unprovisioned') AS mode,COALESCE(a.active,0) AS productActive FROM oa_operators o LEFT JOIN nook_access a ON a.user=o.id WHERE NOT ${cancelledInvitation('o')} AND o.id>? AND (instr(lower(o.display_name),lower(?))>0 OR instr(lower(o.email),lower(?))>0) ORDER BY o.id LIMIT ?`,[after,q,q,limit+1])
 }else if(kind==='users')rows=await c.rows(`SELECT o.id,o.display_name AS name,(SELECT mode FROM nook_access WHERE user=o.id) AS mode FROM oa_operators o WHERE o.status='active' AND ${productAccess('o.id')} AND ${visibleIdentity('?', 'o.id')} AND o.id>? AND instr(lower(o.display_name),lower(?))>0 ORDER BY o.id LIMIT ?`,[c.uid,c.uid,c.uid,after,q,limit+1])
 else rows=await c.rows(`SELECT o.id,o.display_name AS name FROM nook_members m JOIN oa_operators o ON o.id=m.user WHERE m.conversation=? AND ${allowedGrant('m.user','m.conversation')} AND o.id>? AND instr(lower(o.display_name),lower(?))>0 ORDER BY o.id LIMIT ?`,[id,after,q,limit+1],id)
 const items=rows.slice(0,limit),hasMore=rows.length>limit
 const count=kind==='members'?(await c.one('SELECT count(*) AS n FROM nook_members WHERE conversation=?',[id],id))!.n:0
 return {items,hasMore,cursor:hasMore?items.at(-1)!.id:null,warning:count>=900?{bound:'Channel membership',count,limit:1000}:null}
}
