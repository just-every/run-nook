import {channelDeparture} from './channel-departure'
import {channelWritable} from './channel-policy'
import {fail,text} from '../family/team-chat/domain'
import {Context} from '../platform/storage/context'
// @ts-ignore Base's canonical mailbox normalization, unchanged.
import {normalizeEmail} from '../base/modules/operator-auth/policy.mjs'
import {cancelledInvitation,fullMember} from './access'
const manager=`EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND status='active' AND role IN ('owner','admin'))`
function requireManager(c:Context,role='member'){if(c.session.operator.role!=='owner'&&(c.session.operator.role!=='admin'||role!=='member'))fail(403,'Team management is restricted to an authorized owner or admin')}
async function targetAuthority(c:Context,user:string){requireManager(c);const target=await c.one('SELECT role FROM oa_operators WHERE id=?',[user]);if(!target)fail(404,'Teammate unavailable');if(c.session.operator.role!=='owner'&&target.role!=='member')fail(403,'Only an owner can manage privileged teammates')}
function configuration(input:Record<string,any>){
 const role=input.role??'member',mode=input.mode??'member';
 if(!['owner','admin','member'].includes(role)||!['member','guest'].includes(mode)||mode==='guest'&&role!=='member')fail(400,'Guests use the member role')
 if(!Array.isArray(input.scopes)||input.scopes.length<1||input.scopes.length>50||input.scopes.some((s:any)=>typeof s!=='string'||!s||s.length>128)||new Set(input.scopes).size!==input.scopes.length)fail(400,'Choose distinct initial channels')
 return {role,mode,scopes:[...input.scopes].sort() as string[]}
}
export async function prepareInvitation(c:Context,input:Record<string,any>){
 const email=normalizeEmail(input.email),cfg=configuration(input),scopes=JSON.stringify(cfg.scopes);requireManager(c,cfg.role)
 const selected=await c.rows("SELECT c.id FROM nook_conversations c JOIN nook_members m ON m.conversation=c.id WHERE c.id IN (SELECT value FROM json_each(?)) AND c.kind<>'dm' AND NOT EXISTS(SELECT 1 FROM nook_channel_settings WHERE conversation=c.id AND archived=1) AND m.user=? AND (SELECT count(*) FROM nook_members cap WHERE cap.conversation=c.id)<1000",[scopes,c.uid]);if(selected.length!==cfg.scopes.length)fail(400,'Choose current channels you can access')
 const current=await c.one("SELECT * FROM nook_invite_plans WHERE email=? AND state<>'cancelled'",[email]);
 if(current){
  if(current.state==='accepted'||current.role!==cfg.role||current.mode!==cfg.mode||current.scopes!==scopes||current.issuer!==c.uid||current.issuer_version!==c.session.operator.version)fail(409,'Cancel the pending invitation before changing its scope')
  await c.batch([],undefined,`${manager} AND ${fullMember('?')} AND EXISTS(SELECT 1 FROM nook_invite_plans WHERE id=? AND state='prepared' AND issuer=? AND issuer_version=?)`,[c.uid,c.uid,current.id,c.uid,c.session.operator.version]);
  return {prepared:true,email,role:cfg.role,generation:current.generation}
 }
 const id=crypto.randomUUID();
 await c.batch([c.sql(`INSERT INTO nook_invite_plans(id,email,role,mode,scopes,generation,issuer,issuer_version,issuer_session,state) SELECT ?,?,?,?,?,COALESCE(max(generation),0)+1,?,?,?,'prepared' FROM nook_invite_plans WHERE email=?`,id,email,cfg.role,cfg.mode,scopes,c.uid,c.session.operator.version,c.session.id,email)],undefined,`${manager} AND ${fullMember('?')} AND NOT EXISTS(SELECT 1 FROM oa_operators WHERE email=? AND (status='active' OR status='inactive' AND NOT EXISTS(SELECT 1 FROM oa_invitation_cancellations WHERE operator_id=oa_operators.id))) AND NOT EXISTS(SELECT 1 FROM json_each(?) j JOIN nook_channel_settings s ON s.conversation=j.value WHERE s.archived=1)`,[c.uid,c.uid,email,scopes]);
 return {prepared:true,email,role:cfg.role,generation:(await c.one('SELECT generation FROM nook_invite_plans WHERE id=?',[id])).generation}
}
export async function teamDirectory(c:Context){
 requireManager(c);await c.batch([],undefined,manager,[c.uid]);
 return c.rows(`SELECT o.id,o.display_name AS name,o.email,o.role,o.status,COALESCE(a.mode,'unprovisioned') AS mode,COALESCE(a.active,0) AS productActive FROM oa_operators o LEFT JOIN nook_access a ON a.user=o.id WHERE NOT ${cancelledInvitation('o')} ORDER BY o.created_at,o.id LIMIT 1000`)
}
export async function regrant(c:Context,input:Record<string,any>){
 const user=text(input.user,128),cfg=configuration(input),scopes=JSON.stringify(cfg.scopes);await targetAuthority(c,user)
 const former=await c.rows('SELECT id FROM nook_conversations c LEFT JOIN nook_channel_settings s ON s.conversation=c.id WHERE EXISTS(SELECT 1 FROM nook_members WHERE conversation=c.id AND user=?) OR CASE WHEN s.conversation IS NULL THEN c.owner ELSE s.manager END=?',[user,user])
 if(await c.one('SELECT 1 AS x FROM nook_access WHERE user=? AND active=1',[user]))fail(409,'This teammate already has access. Fresh access is only for someone whose product access is inactive; use Remove channel access to narrow it.')
 // Base status reactivation and a fresh login are separate deliberate actions.
 // This operation grants only explicitly selected channels; it cannot revive DMs.
 await c.batch([
  ...former.flatMap(row=>channelDeparture(c,row.id,user)),
  c.sql('DELETE FROM nook_members WHERE user=?',user),c.sql('DELETE FROM nook_guest_grants WHERE user=?',user),
  c.sql('INSERT INTO nook_access VALUES(?,?,1,1) ON CONFLICT(user) DO UPDATE SET mode=excluded.mode,active=1,generation=nook_access.generation+1',user,cfg.mode),
  c.sql('UPDATE nook_actors SET active=1 WHERE id=?',user),
  ...(cfg.mode==='guest'?[c.sql('INSERT INTO nook_guest_grants SELECT ?,value FROM json_each(?)',user,scopes)]:[]),
  c.sql('INSERT INTO nook_members SELECT value,? FROM json_each(?)',user,scopes)
 ],undefined,`${manager} AND ${fullMember('?')} AND ?<>? AND EXISTS(SELECT 1 FROM oa_operators target JOIN oa_operators actor ON actor.id=? WHERE target.id=? AND target.status='active' AND NOT EXISTS(SELECT 1 FROM nook_access cur WHERE cur.user=target.id AND cur.active=1) AND (actor.role='owner' OR target.role='member') AND (?='member' OR target.role='member')) AND NOT EXISTS(SELECT 1 FROM json_each(?) j WHERE NOT EXISTS(SELECT 1 FROM nook_conversations ch JOIN nook_members m ON m.conversation=ch.id WHERE ch.id=j.value AND ch.kind<>'dm' AND ${channelWritable('ch.id')} AND m.user=? AND (SELECT count(*) FROM nook_members cap WHERE cap.conversation=ch.id)<1000))`,[c.uid,c.uid,user,c.uid,c.uid,user,cfg.mode,scopes,c.uid]);
 await c.hint();return {ok:true}
}
export async function removeAccess(c:Context,input:Record<string,any>){
 const user=text(input.user,128),conversation=text(input.conversation,128);await targetAuthority(c,user)
 await c.batch([...c.event(conversation,'membership',user),...channelDeparture(c,conversation,user),c.sql('DELETE FROM nook_members WHERE user=? AND conversation=?',user,conversation)],conversation,`${manager} AND ?<>? AND EXISTS(SELECT 1 FROM oa_operators t JOIN oa_operators a ON a.id=? WHERE t.id=? AND (a.role='owner' OR t.role='member')) AND EXISTS(SELECT 1 FROM nook_conversations WHERE id=? AND kind<>'dm')`,[c.uid,user,c.uid,c.uid,user,conversation]);await c.hint();return {ok:true}
}
export async function cancelPreparation(c:Context,input:Record<string,any>){
 const email=normalizeEmail(input.email);requireManager(c)
 await c.batch([c.sql("UPDATE nook_invite_plans SET state='cancelled' WHERE email=? AND state='prepared'",email)],undefined,`${manager} AND ${fullMember('?')} AND NOT EXISTS(SELECT 1 FROM oa_operators WHERE email=?) AND EXISTS(SELECT 1 FROM nook_invite_plans p JOIN oa_operators actor ON actor.id=? WHERE p.email=? AND p.state='prepared' AND (actor.role='owner' OR p.role='member'))`,[c.uid,c.uid,email,c.uid,email]);return {ok:true}
}
