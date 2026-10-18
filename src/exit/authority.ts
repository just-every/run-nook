import {fail} from '../family/team-chat/domain'
import type {Context} from '../platform/storage/context'

export const currentOwner=(user:string)=>`EXISTS(SELECT 1 FROM oa_operators eo WHERE eo.id=${user} AND eo.role='owner' AND eo.status='active')`
export const workspaceAuthority=`${currentOwner('ej.owner')} AND EXISTS(SELECT 1 FROM nook_exit_policy ep WHERE ep.id=1 AND ep.enabled=1 AND ep.version=ej.workspace_policy_version)`
export async function exportPolicy(c:Context){
 const policy=await c.one<{enabled:number;version:number;owner:number}>(`SELECT enabled,version,(${currentOwner('?')}) AS owner FROM nook_exit_policy WHERE id=1`,[c.uid])
 const announcement=await c.one('SELECT version,enabled,created FROM nook_exit_policy_notices WHERE user=? ORDER BY version DESC LIMIT 1',[c.uid])
 const actions=policy!.owner?await c.rows('SELECT p.version,p.enabled,p.actor,a.name AS actorName,p.created,p.recipients FROM nook_exit_policy_actions p LEFT JOIN nook_actor_history a ON a.id=p.actor ORDER BY p.id DESC LIMIT 20'):undefined
 return {enabled:!!policy!.enabled,version:policy!.version,canManage:!!policy!.owner,announcement,actions}
}
export async function updateExportPolicy(c:Context,input:Record<string,any>){
 if(!await c.one(`SELECT 1 WHERE ${currentOwner('?')}`,[c.uid]))fail(403,'Only a current owner may set workspace export policy')
 if(typeof input.enabled!=='boolean'||!Number.isSafeInteger(input.version)||Object.keys(input).some(k=>!['enabled','version'].includes(k)))fail(400,'Choose the workspace export policy and its current version')
 const created=new Date().toISOString()
 await c.batch([c.sql('UPDATE nook_exit_policy SET enabled=?,version=version+1 WHERE id=1',input.enabled?1:0),
  c.sql("INSERT INTO nook_exit_policy_notices(user,version,enabled,created) SELECT a.user,p.version,p.enabled,? FROM nook_access a JOIN nook_actors u ON u.id=a.user JOIN nook_exit_policy p ON p.id=1 WHERE a.active=1 AND u.active=1",created),
  c.sql('INSERT INTO nook_exit_policy_actions(version,enabled,actor,created,recipients) SELECT version,enabled,?,?,(SELECT COUNT(*) FROM nook_exit_policy_notices WHERE version=nook_exit_policy.version) FROM nook_exit_policy WHERE id=1',c.uid,created)],undefined,`${currentOwner('?')} AND EXISTS(SELECT 1 FROM nook_exit_policy WHERE id=1 AND version=?)`,[c.uid,input.version])
 return exportPolicy(c)
}
