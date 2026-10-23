import type {Context} from '../platform/storage/context'
import {fail} from '../family/team-chat/domain'
import {fullMember} from './access'
import {channelManagement} from './channel-policy'

const administrative=(user:string,owner=false)=>`EXISTS(SELECT 1 FROM oa_operators wp_actor WHERE wp_actor.id=${user} AND wp_actor.status='active' AND wp_actor.role IN (${owner?"'owner'":"'owner','admin'"}) AND ${fullMember('wp_actor.id')})`
const permitted=(user:string,column:string)=>`EXISTS(SELECT 1 FROM oa_operators wp_actor WHERE wp_actor.id=${user} AND wp_actor.status='active' AND ${fullMember('wp_actor.id')} AND (COALESCE((SELECT ${column} FROM nook_workspace_channel_policy WHERE id=1),'members')='members' OR wp_actor.role='owner' OR wp_actor.role='admin' AND (SELECT ${column} FROM nook_workspace_channel_policy WHERE id=1)='admins'))`
export const creationAllowed=(user:string,kind:string)=>kind==='dm'?fullMember(user):permitted(user,kind==='private'?'create_private':'create_public')
export const archiveAllowed=(user:string,conversation:string)=>`CASE WHEN EXISTS(SELECT 1 FROM nook_workspace_channel_policy WHERE id=1) THEN ${permitted(user,'archive')} ELSE ${channelManagement(user,conversation)} END`
export async function workspacePolicy(c:Context){
 const rights=await c.one(`SELECT ${administrative('?',true)} AS canManage WHERE ${administrative('?')}`,[c.uid,c.uid])
 if(!rights)fail(403,'Only owners and admins can read the workspace channel policy')
 const policy=await c.one('SELECT version,create_public,create_private,archive FROM nook_workspace_channel_policy WHERE id=1')
 return {...(policy??{version:0,create_public:'members',create_private:'members',archive:'managers'}),canManage:!!rights.canManage}
}
export async function updateWorkspacePolicy(c:Context,input:Record<string,any>){
 if(!await c.one(`SELECT 1 WHERE ${administrative('?',true)}`,[c.uid]))fail(403,'Only installation owners can change workspace channel policy; delegation is unavailable')
 if(Object.keys(input).sort().join()!=='archive,create_private,create_public,version'||!Number.isSafeInteger(input.version)||input.version<0||['create_public','create_private','archive'].some(key=>!['owners','admins','members'].includes(input[key])))fail(400,'Choose who may create public and private channels and archive channels, with the current policy version')
 const current=await workspacePolicy(c)
 if(current.version!==input.version)fail(409,'Workspace channel policy changed; reload before saving')
 await c.batch([
  c.sql('INSERT INTO nook_workspace_channel_policy VALUES(1,?,?,?,?) ON CONFLICT(id) DO UPDATE SET version=excluded.version,create_public=excluded.create_public,create_private=excluded.create_private,archive=excluded.archive',input.version+1,input.create_public,input.create_private,input.archive),
  c.sql("INSERT INTO nook_audit VALUES(?,?, 'workspace-channel-policy',?,'policy.channels','workspace',?,?,'confirmed',0)",crypto.randomUUID(),c.uid,Date.now(),input.version+1,`Public creation: ${input.create_public}; private creation: ${input.create_private}; archive: ${input.archive}`),
 ],undefined,`${administrative('?',true)} AND COALESCE((SELECT version FROM nook_workspace_channel_policy WHERE id=1),0)=?`,[c.uid,input.version])
 await c.hint();return workspacePolicy(c)
}
