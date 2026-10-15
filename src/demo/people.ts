import {operatorAuth,authBindings} from '../platform/operator-auth.server'
import type {Bindings} from '../platform/repository.server'
import {context} from '../platform/storage/context'
import {prepareInvitation} from '../team/invitations.server'
// @ts-ignore Base's outbox reader is JavaScript.
import {createD1DevelopmentOutbox} from '../base/modules/mail/src/development/index.mjs'

/** Real auth and invitation APIs, using only mail captured inside this demo. */
export function demoPeople(input:Bindings){
 const env=authBindings(input),auth=operatorAuth(env)
 const request=(headers?:Headers)=>new Request(env.AUTH_ORIGIN+'/auth/confirm',{
  method:'POST',headers:{host:new URL(env.AUTH_ORIGIN).host,origin:env.AUTH_ORIGIN,'CF-Connecting-IP':'127.0.0.1',...(headers?Object.fromEntries(headers):{})},
 })
 async function enter(email:string){
  const outbox=createD1DevelopmentOutbox({db:env.DB})
  const row=(await outbox.list()).find((row:any)=>row.message.to.includes(email))
  const link=row?.message.text?.match(/https?:\/\/\S+\/auth\/confirm\?token=\S+/)?.[0]
  if(!link)throw Error('Demo sign-in mail was not captured')
  const complete=await auth.confirmLink(request(),{token:new URL(link).searchParams.get('token')!})
  if(!complete.cookie)throw Error('Demo sign-in did not issue a session')
  return new Headers({host:new URL(env.AUTH_ORIGIN).host,cookie:complete.cookie.split(';')[0]})
 }
 return {
  request,
  async owner(email:string){await auth.requestMagicLink(request(),{email});return enter(email)},
  async member(owner:Headers,email:string,displayName:string,scopes:string[]){
   const people=await auth.listOperators(request(owner)),existing=people.find(p=>p.email===email)
   if(existing?.status==='active')await auth.requestMagicLink(request(),{email})
   else{
    await prepareInvitation(await context(env,owner),{email,role:'member',mode:'member',scopes})
    await auth.invite(request(owner),{email,displayName,role:'member'})
   }
   return enter(email)
  },
  async leave(headers:Headers){await auth.signOut(request(headers))},
 }
}
