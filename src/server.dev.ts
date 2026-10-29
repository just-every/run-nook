// Local-only Worker entry. vite.config.ts loads it only for `vite dev`; the deployed main stays
// src/server.ts, and `rer build` refuses any output that contains the dev layer. It adds dev
// sign-in, personas and the dev badge.
import worker from './server'
import {withDevIdentity} from './base/modules/operator-auth/dev/index.mjs'
import {devGate} from './base/modules/operator-auth/index.mjs'
// @ts-ignore Product configuration uses the portable Base JavaScript API.
import {authBindings,authConfig} from './platform/operator-auth-runtime.mjs'
import branding from './branding.json'
import {devPersonas} from './dev/personas'
import {admitPersona,reactivatePersona} from './dev/admit.server'
import type {Bindings} from './platform/repository.server'
import {openSessionRedirect} from './platform/open-session'
export {ChatHub} from './platform/storage/live'

const layered=withDevIdentity<Bindings,typeof worker>(worker,{bindings:authBindings,config:env=>authConfig(env,branding),personas:devPersonas})

export default {
 ...layered,
 async fetch(request,env,execution){
  const url=new URL(request.url),as=url.searchParams.get('as')
  // The dev layer answers /signin itself, with its persona buttons; an open session is sent on before it does.
  const signedIn=await openSessionRedirect(request,env)
  if(signedIn)return signedIn
  const persona=url.pathname==='/auth/dev/enter'&&as&&devPersonas().some(person=>person.as===as)
  // Only a request the key gate admits touches a persona: an export suspends them, and entering as one again reactivates it.
  if(persona&&await keyed(env,request))await reactivatePersona(env.DB,as)
  const response=await layered.fetch(request,env,execution)
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
