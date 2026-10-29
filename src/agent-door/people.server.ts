import {operatorAuthPeople, type PeopleAdapter, type Person} from '../base/modules/agent-door/index.ts'
import {operatorAuth} from '../platform/operator-auth.server'
import type {StorageBindings} from '../platform/storage/context'

/** Business IDs select native accounts. Product admission is an additional gate. */
export function nativePeople(env: StorageBindings): PeopleAdapter {
 const accounts=operatorAuthPeople({db:env.DB,session:request=>operatorAuth(env).getSession(request)})
 async function admitted(person:Person|null){
  if(!person)return null
  const access=await env.DB.prepare('SELECT active FROM nook_access WHERE user=?').bind(person.id).first<{active:number}>()
  return {...person,active:person.active&&access?.active===1}
 }
 return {
  person:async id=>admitted(await accounts.person(id)),
  sponsor:async claims=>admitted(await accounts.sponsor(claims)),
  session:async request=>admitted(await accounts.session(request)),
  businessMember:person=>accounts.businessMember!(person),
 }
}
