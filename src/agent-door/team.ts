import type {TeamAdapter,ManagedMember} from '../base/modules/business-settings/index.ts'
import {SettingsError} from '../base/modules/business-settings/types.ts'
import type {StorageBindings} from '../platform/storage/context'
import {fullMember} from '../team/access'

// Business links people who have already completed Nook's scoped invitation.
// A roster supplies no channel grant and cannot provision an unrestricted person.
export function nookBusinessTeam(env:StorageBindings):TeamAdapter{
 return {
  async ownerEmail(){return (await env.DB.prepare("SELECT o.email FROM oa_bootstrap b JOIN oa_operators o ON o.id=b.claim_id WHERE b.singleton=1 AND o.status='active' AND o.role='owner'").first<{email:string}>())?.email??null},
  async prepare({members,managed,ownerEmail,roles,guard}){
   const owner=await env.DB.prepare(`SELECT o.id,o.email,o.version FROM oa_bootstrap b JOIN oa_operators o ON o.id=b.claim_id WHERE b.singleton=1 AND o.status='active' AND o.role='owner' AND ${fullMember('o.id')}`).first<{id:string;email:string;version:number}>()
   if(!owner||owner.email!==ownerEmail)throw new SettingsError('owner_required')
   const fence=`(${guard.sql}) AND EXISTS(SELECT 1 FROM oa_operators o WHERE o.id=? AND o.version=? AND o.role='owner' AND o.status='active' AND ${fullMember('o.id')})`
   const args=[...guard.args,owner.id,owner.version]
   const statements=[],rows:ManagedMember[]=[]
   const desired=new Map(members.map(member=>[member.email,member]))
   const previous=new Map(managed.map(row=>[row.email,row]))
   for(const email of new Set([...desired.keys(),...previous.keys()])){
    const member=desired.get(email),prior=previous.get(email)
    const person=prior?.operatorId
     ?await env.DB.prepare('SELECT id,email,role,status,version FROM oa_operators WHERE id=?').bind(prior.operatorId).first<any>()
     :await env.DB.prepare("SELECT o.id,o.email,o.role,o.status,o.version FROM oa_operators o WHERE o.email=? AND EXISTS(SELECT 1 FROM nook_invite_plans p WHERE p.email=o.email AND p.state='accepted' AND p.issuer=?)").bind(email,owner.id).first<any>()
    if(!person||person.id===owner.id||person.role==='owner'||member&&member.id&&prior?.businessId&&member.id!==prior.businessId){rows.push({email,operatorId:prior?.operatorId??null,invite:member?.invite??prior?.invite??0,state:'conflict'});continue}
    if(!member){
     statements.push(env.DB.prepare(`UPDATE oa_operators SET status='inactive' WHERE id=? AND version=? AND role<>'owner' AND ${fence}`).bind(person.id,person.version,...args))
     rows.push({email,operatorId:person.id,invite:prior!.invite,state:'inactive'});continue
    }
    const role=roles[member.role]
    const admitted=await env.DB.prepare(`SELECT 1 FROM nook_access WHERE user=? AND active=1 AND (mode='member' OR ?='member')`).bind(person.id,role).first()
    // Local removal requires Nook's fresh scoped regrant; Business cannot revive it.
    if(person.status!=='active'||!admitted){rows.push({email,operatorId:person.id,invite:member.invite,state:'inactive'});continue}
    statements.push(env.DB.prepare(`UPDATE oa_operators SET role=?,display_name=? WHERE id=? AND version=? AND role<>'owner' AND ${fence}`).bind(role,member.name,person.id,person.version,...args))
    statements.push(env.DB.prepare(`INSERT INTO oa_auth_audit(id,actor_id,action,value,created_at) SELECT ?,?,'business:reconcile',?,? WHERE ${fence}`).bind(crypto.randomUUID(),owner.id,JSON.stringify({operatorId:person.id}),Date.now(),...args))
    rows.push({email,operatorId:person.id,invite:member.invite,state:'active'})
   }
   return {statements,rows,async afterCommit(){}}
  },
 }
}
