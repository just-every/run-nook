// Local-only Worker entry. vite.config.ts loads it only for `vite dev`; the deployed main stays
// src/server.ts, and `rer build` refuses any output that contains the dev layer. It adds dev
// sign-in, personas and the dev badge.
import worker from './server'
import {withDevIdentity} from './base/modules/operator-auth/dev/index.mjs'
import {devGate} from './base/modules/operator-auth/index.mjs'
// @ts-ignore Product configuration uses the portable Base JavaScript API.
import {authBindings,authConfig,createConfiguredAuth} from './platform/operator-auth-runtime.mjs'
// @ts-ignore Local-only invitation guidance uses the portable Base preview API.
import {invitationKeyNotice} from './dev/invitation-confirmation.mjs'
import {fontDocumentResponse} from './base/font-response'
import branding from './branding.json'
import {devPersonas} from './dev/personas'
import {admitPersona,reactivatePersona} from './dev/admit.server'
import type {Bindings} from './platform/repository.server'
export {ChatHub} from './platform/storage/live'

const layered=withDevIdentity<Bindings,typeof worker>(worker,{bindings:authBindings,config:env=>authConfig(env,branding),personas:devPersonas})

export default {
 ...layered,
 async fetch(request,env,execution){
  const url=new URL(request.url),as=url.searchParams.get('as')
  const persona=url.pathname==='/auth/dev/enter'&&as&&devPersonas().some(person=>person.as===as)
  // Only a request the key gate admits touches a persona: an export suspends them, and entering as one again reactivates it.
  if(persona&&await keyed(env,request))await reactivatePersona(env.DB,as)
  const response=await layered.fetch(request,env,execution)
  if(response.status===400&&url.pathname==='/auth/confirm'&&['GET','HEAD'].includes(request.method)){
   const notice=await invitationKeyNotice(request,authBindings(env),createConfiguredAuth(env,branding))
   if(notice)return (await fontDocumentResponse(notice))!
  }
  // The persona's operator exists once the layer has answered; admit it to the product before the redirect lands.
  if(persona&&response.status===303)await admitPersona(env.DB,as)
  return response
 },
} satisfies typeof worker

async function keyed(env:Bindings,request:Request){
 const bindings=authBindings(env)
 const gate=devGate({key:bindings.RER_DEV_KEY,origin:bindings.AUTH_ORIGIN,local:bindings.AUTH_LOCAL==='true'})
 return env.RER_DEV_IDENTITY!=='off'&&Boolean(gate&&await gate.admits(request))
}
