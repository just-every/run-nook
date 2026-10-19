import {createOwnerClaimHandler, OwnerClaimError} from '../base/modules/owner-claim/index.mjs'
import {AuthError} from '../base/modules/operator-auth/index.mjs'
import {authBindings, type Bindings} from './operator-auth.server'
import {enableDoorAtFirstClaim} from '../base/modules/import-kit/src/door/authority'
import {doorKey} from '../imports/door-source'

export type OwnerClaimBindings = Bindings & {
 RER_OWNER_CLAIM_ISSUER?: string
 RER_OWNER_CLAIM_INSTALLATION_ID?: string
 RER_OWNER_CLAIM_PUBLIC_KEYS?: string
 RER_IMPORT_DOOR?: string
}

/** Only trusted bindings choose authority. No request can select an issuer or owner. */
export async function ownerClaim(bindings: OwnerClaimBindings, request: Request) {
 const env = authBindings(bindings) as OwnerClaimBindings
 try {
  if(env.SESSION_SECRET===env.SETUP_TOKEN)throw new OwnerClaimError('invalid_configuration',503)
  // Normalized actors are the product identity authority after conversion/restore.
  // A legacy workspace document is no longer an admission source.
  const storage=await env.DB.prepare('SELECT authority FROM nook_storage WHERE id=1').first<{authority:string}>()
  if(storage?.authority!=='normalized')return Response.json({error:'offline_storage_conversion_required'},{status:503,headers:{'Cache-Control':'no-store'}})
  if(!await env.DB.prepare('SELECT singleton FROM oa_bootstrap WHERE singleton=1').first() && await env.DB.prepare('SELECT id FROM nook_actors LIMIT 1').first()) {
   return Response.json({error:'identity_recovery_required'}, {status:409,headers:{'Cache-Control':'no-store'}})
  }
  const response = await createOwnerClaimHandler({
   db:env.DB,
   authConfig:{origin:env.AUTH_ORIGIN,local:env.AUTH_LOCAL==='true',OWNER_EMAIL:env.OWNER_EMAIL,SESSION_SECRET:env.SESSION_SECRET,SETUP_TOKEN:env.SETUP_TOKEN},
   clientIp:request=>env.AUTH_LOCAL==='true'?'local':request.headers.get('CF-Connecting-IP')??'',
   issuer:env.RER_OWNER_CLAIM_ISSUER!,installationId:env.RER_OWNER_CLAIM_INSTALLATION_ID!,
   appOrigin:env.AUTH_ORIGIN,expectedEmail:env.OWNER_EMAIL,
   publicKeys:JSON.parse(env.RER_OWNER_CLAIM_PUBLIC_KEYS??'null'),
  })(request)
  if(env.RER_IMPORT_DOOR==='on'&&response?.ok)await enableDoorAtFirstClaim(env.DB as any,doorKey,{sql:"EXISTS(SELECT 1 FROM oc_owner_claims WHERE singleton=1) AND EXISTS(SELECT 1 FROM oa_operators WHERE lower(email)=lower(?) AND role='owner' AND status='active')",params:[env.OWNER_EMAIL]})
  return response
 } catch(error) {
  const known=error instanceof OwnerClaimError || error instanceof AuthError
  return Response.json({error:known?error.code:'claim_unavailable'},{status:known?error.status:503,headers:{'Cache-Control':'no-store'}})
 }
}
