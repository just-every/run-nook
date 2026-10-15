// Product configuration only; Base owns credentials, roles, sessions and limits.
import {createOperatorAuth,AuthError,isLoopbackHost} from '../base/modules/operator-auth/index.mjs';
import {createMailSender,MailValidationError} from '../base/modules/mail/index.mjs';
import {migrateAccent} from '../brand/accent-colour.mjs';
import {pageThemeHref} from '../brand/page-theme.mjs';
import {createD1DevelopmentOutbox} from '../base/modules/mail/src/development/index.mjs';
export function authBindings(env){return env.AUTH_LOCAL==='true'&&env.RER_DEV_ORIGIN?{...env,AUTH_ORIGIN:env.RER_DEV_ORIGIN}:env}
export function developmentMail(bindings){const env=authBindings(bindings);if(env.RER_DEMO==='1')return false;try{const url=new URL(env.AUTH_ORIGIN);return env.AUTH_LOCAL==='true'&&env.MAIL_PROVIDER==='development'&&url.origin===env.AUTH_ORIGIN&&isLoopbackHost(url.hostname)&&['http:','https:'].includes(url.protocol)}catch{return false}}
export function acceptsRequest(bindings,request){
 const env=authBindings(bindings);
 try{
  const configured=new URL(env.AUTH_ORIGIN),url=new URL(request.url),host=request.headers.get('host');
  if(configured.origin!==env.AUTH_ORIGIN||url.origin!==configured.origin||(host&&host.toLowerCase()!==url.host.toLowerCase()))return false;
  return env.AUTH_LOCAL==='true'?isLoopbackHost(url.hostname)&&['http:','https:'].includes(url.protocol):url.protocol==='https:'&&!isLoopbackHost(url.hostname);
 }catch{return false}
}
// Sign-in mail and C14 notification mail share this one configured sender.
export function mailSender(env){
 if(typeof env.MAIL_FROM!=='string'||!env.MAIL_FROM.trim())throw new AuthError('mail_configuration_required',503);
 if(env.RER_DEMO==='1')return {async send(){return {provider:'development',status:'accepted',providerMessageId:null}}};
 if(env.AUTH_LOCAL==='true'){
  if(!developmentMail(env))throw new AuthError('invalid_configuration',503);
  return createMailSender({provider:'development',mode:'development'},{outbox:createD1DevelopmentOutbox({db:env.DB})});
 }
 const credentials={sendgrid:'SENDGRID_API_KEY',resend:'RESEND_API_KEY',cloudflare:'CLOUDFLARE_EMAIL_API_TOKEN'};
 const key=credentials[env.MAIL_PROVIDER];
 if(!key||!env[key]||(env.MAIL_PROVIDER==='cloudflare'&&!env.CLOUDFLARE_EMAIL_ACCOUNT_ID))throw new AuthError('mail_configuration_required',503);
 try{return createMailSender({provider:env.MAIL_PROVIDER,mode:'production',apiKey:env[key],...(env.MAIL_PROVIDER==='cloudflare'?{accountId:env.CLOUDFLARE_EMAIL_ACCOUNT_ID}:{})})}
 catch(error){if(error instanceof MailValidationError)throw new AuthError('invalid_mail_configuration',503);throw error}
}
export function authConfig(bindings,branding){
 const env=authBindings(bindings),local=env.AUTH_LOCAL==='true';
 return {origin:env.AUTH_ORIGIN,local,OWNER_EMAIL:env.OWNER_EMAIL,SESSION_SECRET:env.SESSION_SECRET,SETUP_TOKEN:env.SETUP_TOKEN,MAIL_FROM:env.MAIL_FROM,branding:{productName:branding.name,accentColor:migrateAccent(branding.primaryColor),signInPath:'/signin',theme:pageThemeHref},...(local?{ipLimit:1000,emailLimit:100}:{})};
}
export function createConfiguredAuth(bindings,branding){
 const env=authBindings(bindings),local=env.AUTH_LOCAL==='true';
 let valid=false;try{valid=acceptsRequest(env,new Request(env.AUTH_ORIGIN))}catch{}
 if(!valid)throw new AuthError('invalid_configuration',503);
 return createOperatorAuth({db:env.DB,config:authConfig(bindings,branding),mailSender:mailSender(env),
  // Cloudflare overwrites this header at the deployed Worker boundary. Never
  // trust Forwarded/X-Forwarded-For or use the local shared bucket in production.
  clientIp:request=>local?'local':request.headers.get('CF-Connecting-IP')??''});
}
