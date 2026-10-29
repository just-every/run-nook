import {operatorAuthPeople,type PeopleAdapter,type Person} from '../base/modules/agent-door/index.ts'
import {operatorAuth} from '../platform/operator-auth.server'
import type {StorageBindings} from '../platform/storage/context'

/** Signed Business IDs bind to native IDs, including after a native role edit. */
export function nativePeople(env:StorageBindings):PeopleAdapter{
 const accounts=operatorAuthPeople({db:env.DB,session:request=>operatorAuth(env).getSession(request)})
 async function admitted(person:Person|null){
  if(!person)return null
  const access=await env.DB.prepare('SELECT active FROM nook_access WHERE user=?').bind(person.id).first<{active:number}>()
  return {...person,active:person.active&&access?.active===1}
 }
 const person=async(id:string)=>admitted(await accounts.person(id))
 const settings=()=>env.DB.prepare('SELECT owner_id FROM bs_settings WHERE singleton=1 AND stopped=0').first<{owner_id:string|null}>()
 const setupOwner=()=>env.DB.prepare('SELECT claim_id FROM oa_bootstrap WHERE singleton=1').first<{claim_id:string}>()
 return {
  person,
  async sponsor({sub}){
   const business=await settings()
   if(!business?.owner_id)return null
   if(business.owner_id===sub){
    const owner=await setupOwner()
    return owner?person(owner.claim_id):null
   }
   const binding=await env.DB.prepare("SELECT operator_id FROM bs_team WHERE business_id=? AND state<>'conflict'").bind(sub).first<{operator_id:string|null}>()
   return binding?.operator_id?person(binding.operator_id):null
  },
  async businessMember(native){
   const business=await settings()
   if(!business?.owner_id)return null
   if((await setupOwner())?.claim_id===native.id)return {id:business.owner_id,role:'owner'}
   const binding=await env.DB.prepare("SELECT business_id,business_role FROM bs_team WHERE operator_id=? AND state<>'conflict' AND business_id IS NOT NULL").bind(native.id).first<{business_id:string;business_role:string}>()
   return binding?{id:binding.business_id,role:binding.business_role==='admin'?'editor':null}:null
  },
  session:async request=>admitted(await accounts.session(request)),
 }
}
