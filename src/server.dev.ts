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
import {admitPersona} from './dev/admit.server'
import type {Bindings} from './platform/repository.server'
export {ChatHub} from './platform/storage/live'

const layered=withDevIdentity<Bindings,typeof worker>(worker,{bindings:authBindings,config:env=>authConfig(env,branding),personas:devPersonas})

export default {
 ...layered,
 async fetch(request,env,execution){
  const url=new URL(request.url),as=url.searchParams.get('as')
  const persona=url.pathname==='/auth/dev/enter'&&as&&devPersonas().some(person=>person.as===as)
  // As with the ordinary bootstrap door, imported actors require explicit
  // offline mapping before the local layer may create any authentication row.
  if(url.pathname==='/auth/dev/enter'&&await keyed(env,request)&&await env.DB.prepare('SELECT 1 WHERE NOT EXISTS(SELECT 1 FROM oa_bootstrap WHERE singleton=1) AND EXISTS(SELECT 1 FROM nook_actors)').first())return Response.json({error:'identity_recovery_required'},{status:409,headers:{'Cache-Control':'no-store'}})
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
