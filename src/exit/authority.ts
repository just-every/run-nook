import {fail} from '../family/team-chat/domain'
import type {Context} from '../platform/storage/context'

export const currentOwner=(user:string)=>`EXISTS(SELECT 1 FROM oa_operators eo WHERE eo.id=${user} AND eo.role='owner' AND eo.status='active')`
export const workspaceAuthority=`${currentOwner('ej.owner')} AND EXISTS(SELECT 1 FROM nook_exit_policy ep WHERE ep.id=1 AND ep.enabled=1 AND ep.version=ej.workspace_policy_version)`
export async function exportPolicy(c:Context){
 const policy=await c.one<{enabled:number;version:number;owner:number}>(`SELECT enabled,version,(${currentOwner('?')}) AS owner FROM nook_exit_policy WHERE id=1`,[c.uid])
 return {enabled:!!policy!.enabled,version:policy!.version,canManage:!!policy!.owner}
}
export async function updateExportPolicy(c:Context,input:Record<string,any>){
 if(!await c.one(`SELECT 1 WHERE ${currentOwner('?')}`,[c.uid]))fail(403,'Only a current owner may set workspace export policy')
 if(typeof input.enabled!=='boolean'||!Number.isSafeInteger(input.version)||Object.keys(input).some(k=>!['enabled','version'].includes(k)))fail(400,'Choose the workspace export policy and its current version')
 await c.batch([c.sql('UPDATE nook_exit_policy SET enabled=?,version=version+1 WHERE id=1',input.enabled?1:0)],undefined,`${currentOwner('?')} AND EXISTS(SELECT 1 FROM nook_exit_policy WHERE id=1 AND version=?)`,[c.uid,input.version])
 return exportPolicy(c)
}
