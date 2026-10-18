import {allowedGrant,fullMember,productAccess,visibleIdentity} from '../team/access'
import {literal} from '../broadcast/policy'
import {fail} from '../family/team-chat/domain'

export const profileAdmin=(user:string)=>`EXISTS(SELECT 1 FROM oa_operators profile_admin WHERE profile_admin.id=${user} AND profile_admin.status='active' AND profile_admin.role IN ('owner','admin') AND ${fullMember('profile_admin.id')})`
export const sharedProfileConversation=(viewer:string,target:string)=>`EXISTS(SELECT 1 FROM nook_members profile_viewer JOIN nook_members profile_target ON profile_target.conversation=profile_viewer.conversation WHERE profile_viewer.user=${viewer} AND profile_target.user=${target} AND ${allowedGrant('profile_viewer.user','profile_viewer.conversation')} AND ${allowedGrant('profile_target.user','profile_target.conversation')})`
export const profileIdentity=(viewer:string,target:string)=>`${productAccess(target)} AND ${visibleIdentity(viewer,target)} AND (${fullMember(viewer)} OR ${viewer}=${target} OR ${sharedProfileConversation(viewer,target)})`
export const fieldVisible=(viewer:string,target:string,field='f')=>`(${viewer}=${target} OR ${field}.visibility='members' AND ${fullMember(viewer)} OR ${field}.visibility='shared-conversation' AND ${sharedProfileConversation(viewer,target)} OR ${field}.visibility='admins' AND ${profileAdmin(viewer)})`
export const viewerSql=(id:string)=>literal(id)
export function object(value:unknown,keys:string[]):Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!keys.includes(key)))fail(400,'Invalid profile command')
 return value as Record<string,unknown>
}
export function bounded(value:unknown,max:number,label:string,empty=true):string{
 if(typeof value!=='string'||value.length>max||!empty&&!value.trim()||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))return fail(400,`Provide a valid ${label}`)
 return value.trim()
}
