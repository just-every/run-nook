import {createPortabilityHandler} from '../base/modules/portability/index.mjs'
// @ts-ignore Nook's offline policy is also consumed by the local CLI.
import {portabilityPolicy,productPolicy} from './portability-policy.mjs'
import {authBindings} from './operator-auth.server'
import {context,type StorageBindings} from './storage/context'
import {Fault} from '../family/team-chat/domain'

/** Hosted export for `rer export --target remote`: Base's reviewed portability
 * door, exports only, for an active owner's current session. Restores stay
 * local (rer import into a fresh checkout), so imports are never authorized. */
export async function portabilityRoute(env:StorageBindings,request:Request){
 const url=new URL(request.url),creating=request.method==='POST'&&url.pathname==='/api/portability/exports'
 let policy
 // Pending uploads, deletes or imports must settle first, as for a local export.
 try{policy=creating?await productPolicy(env.DB):portabilityPolicy}catch(error){const code=(error as {code?:string}).code;if(!code)throw error;return Response.json({error:code},{status:409,headers:{'Cache-Control':'no-store'}})}
 const handler=await createPortabilityHandler({db:env.DB,buckets:{FILES:env.FILES},policy,appOrigin:authBindings(env).AUTH_ORIGIN,authorize:async(req,{operation})=>operation==='export'?owner(env,req):null})
 return (await handler(request))!
}
async function owner(env:StorageBindings,request:Request){
 try{const c=await context(env,request.headers);return c.session.operator.role==='owner'?c.uid:null}catch(error){if(error instanceof Fault&&error.status<500)return null;throw error}
}
