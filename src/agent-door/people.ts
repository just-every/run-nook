import type { PeopleAdapter, Person } from '../base/modules/agent-door/types.ts'
import { operatorAuthPeople } from '../base/modules/agent-door/index.ts'
import { operatorAuth } from '../platform/operator-auth.server'
import type { StorageBindings } from '../platform/storage/context'
import { productAccess } from '../team/access'

export function nookPeople(env:StorageBindings):PeopleAdapter{
 const native=operatorAuthPeople({db:env.DB,session:request=>operatorAuth(env).getSession(request)})
 const admitted=async(person:Person|null)=>person?.active&&await env.DB.prepare(`SELECT 1 FROM oa_operators o WHERE o.id=? AND o.status='active' AND ${productAccess('o.id')}`).bind(person.id).first()?person:null
 // Bootstrap owns the immutable native id. A later local role or address change
 // must not move the Business owner's binding to another native account.
 const owner=()=>env.DB.prepare('SELECT claim_id FROM oa_bootstrap WHERE singleton=1').first<{claim_id:string}>()
 const settings=()=>env.DB.prepare('SELECT owner_id FROM bs_settings WHERE singleton=1 AND stopped=0').first<{owner_id:string|null}>()
 return {
  person:async id=>admitted(await native.person(id)),
  async sponsor(claims){
   const binding=await settings()
   if(binding?.owner_id===claims.sub){const claimed=await owner();return claimed?admitted(await native.person(claimed.claim_id)):null}
   const row=await env.DB.prepare("SELECT operator_id FROM bs_team WHERE business_id=? AND state<>'conflict'").bind(claims.sub).first<{operator_id:string|null}>()
   return row?.operator_id?admitted(await native.person(row.operator_id)):null
  },
  session:async request=>admitted(await native.session(request)),
  async businessMember(person){
   const binding=await settings()
   if(binding?.owner_id&&(await owner())?.claim_id===person.id)return {id:binding.owner_id,role:'owner'}
   const row=await env.DB.prepare("SELECT business_id,business_role FROM bs_team WHERE operator_id=? AND state<>'conflict' AND business_id IS NOT NULL").bind(person.id).first<{business_id:string;business_role:string}>()
   return row?{id:row.business_id,role:row.business_role==='admin'?'editor':null}:null
  },
  businessRole:person=>person.role==='owner'?'owner':person.role==='admin'?'editor':null,
 }
}
