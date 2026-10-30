import {businessSettings} from '../agent-door/business.server'
import {auditDatabase} from '../audit/database'
import {createAuthHandler,AuthError} from '../base/modules/operator-auth/index.mjs'
// @ts-ignore Product configuration uses the portable Base JavaScript API.
import {authBindings,developmentMail,acceptsRequest,createConfiguredAuth} from './operator-auth-runtime.mjs'
import branding from '../branding.json'
import {fontDocumentResponse} from '../base/font-response'
export type Bindings={DB:D1Database;RER_DEMO?:string;RER_BUSINESS_TRUST?:string;RER_OWNER_CLAIM_ISSUER?:string;RER_OWNER_CLAIM_INSTALLATION_ID?:string;RER_OWNER_CLAIM_PUBLIC_KEYS?:string;RER_DEV_ORIGIN?:string;RER_DEV_KEY?:string;RER_DEV_IDENTITY?:string;RER_INSTALLATION_ID?:string;RER_MANAGEMENT_ORIGIN?:string;AUTH_ORIGIN:string;AUTH_LOCAL:string;OWNER_EMAIL:string;SESSION_SECRET:string;SETUP_TOKEN?:string;MAIL_PROVIDER:string;MAIL_FROM:string;MAIL_RELAY_URL?:string;MAIL_API_KEY?:string;SENDGRID_API_KEY?:string;RESEND_API_KEY?:string;CLOUDFLARE_EMAIL_API_TOKEN?:string;CLOUDFLARE_EMAIL_ACCOUNT_ID?:string}
export {authBindings,developmentMail,acceptsRequest}
export function operatorAuth(bindings:Bindings){return createConfiguredAuth(bindings,branding,businessSettings(bindings as any)) as import('../base/modules/operator-auth/index.mjs').OperatorAuth}
export async function authRoute(env:Bindings,request:Request){
 try{
  if(new URL(request.url).pathname==='/auth/bootstrap'){
   // Signed admission is permanent. Refuse legacy bootstrap before its rate-limit writes.
   if(await env.DB.prepare('SELECT singleton FROM oc_owner_claims WHERE singleton=1').first())return Response.json({error:'already_initialized'},{status:409,headers:{'Cache-Control':'no-store'}})
  }
  const session=await operatorAuth(env).getSession(request)
  const audited={...env,DB:auditDatabase(env.DB,session?.operatorId??null)}
  return fontDocumentResponse(await createAuthHandler(operatorAuth(audited))(request))
 }catch(error){return Response.json({error:error instanceof AuthError?error.code:'auth_unavailable'},{status:error instanceof AuthError?error.status:503,headers:{'Cache-Control':'no-store'}})}
}
