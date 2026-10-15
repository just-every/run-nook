import {createAuthHandler,AuthError,devGate,devNotFound} from '../base/modules/operator-auth/index.mjs'
// @ts-ignore Portable Base development outbox.
import {createD1DevelopmentOutbox,createDevelopmentOutboxHandler} from '../base/modules/mail/src/development/index.mjs'
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
// The outbox and the key exchange answer only a local runtime that holds RER_DEV_KEY. A tunnel or
// local proxy makes remote requests look local, so the outbox also needs the key gate's cookie (or
// the rer harness's key header); without either it does not exist.
export async function outboxRoute(bindings:Bindings,request:Request){
 const env=authBindings(bindings);
 if(!developmentMail(env))return devNotFound()
 const gate=devGate({key:env.RER_DEV_KEY,origin:env.AUTH_ORIGIN,local:true})
 if(!gate)return devNotFound()
 if(new URL(request.url).pathname==='/__dev/key')return gate.exchange(request)
 if(!await gate.admits(request))return devNotFound()
 return createDevelopmentOutboxHandler({local:true,outbox:createD1DevelopmentOutbox({db:env.DB}),origin:env.AUTH_ORIGIN})(request)
}
