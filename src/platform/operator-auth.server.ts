import {createAuthHandler,AuthError} from '../base/modules/operator-auth/index.mjs'
// @ts-ignore Product configuration uses the portable Base JavaScript API.
import {authBindings,developmentMail,acceptsRequest,createConfiguredAuth} from './operator-auth-runtime.mjs'
import branding from '../branding.json'
import {fontDocumentResponse} from '../base/font-response'
export type Bindings={DB:D1Database;RER_DEMO?:string;RER_DEV_ORIGIN?:string;RER_DEV_KEY?:string;RER_DEV_IDENTITY?:string;RER_INSTALLATION_ID?:string;RER_MANAGEMENT_ORIGIN?:string;AUTH_ORIGIN:string;AUTH_LOCAL:string;OWNER_EMAIL:string;SESSION_SECRET:string;SETUP_TOKEN?:string;MAIL_PROVIDER:string;MAIL_FROM:string;MAIL_RELAY_URL?:string;MAIL_API_KEY?:string;SENDGRID_API_KEY?:string;RESEND_API_KEY?:string;CLOUDFLARE_EMAIL_API_TOKEN?:string;CLOUDFLARE_EMAIL_ACCOUNT_ID?:string}
export {authBindings,developmentMail,acceptsRequest}
export function operatorAuth(bindings:Bindings){return createConfiguredAuth(bindings,branding) as import('../base/modules/operator-auth/index.mjs').OperatorAuth}
export async function authRoute(env:Bindings,request:Request){
 try{
  if(new URL(request.url).pathname==='/auth/bootstrap'){
   // Signed admission is permanent. Refuse legacy bootstrap before its rate-limit writes.
   if(await env.DB.prepare('SELECT singleton FROM oc_owner_claims WHERE singleton=1').first())return Response.json({error:'already_initialized'},{status:409,headers:{'Cache-Control':'no-store'}})
  }
  return fontDocumentResponse(await createAuthHandler(operatorAuth(env))(request))
 }catch(error){return Response.json({error:error instanceof AuthError?error.code:'auth_unavailable'},{status:error instanceof AuthError?error.status:503,headers:{'Cache-Control':'no-store'}})}
}
