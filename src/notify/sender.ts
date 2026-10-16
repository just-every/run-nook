// @ts-ignore Product configuration uses the portable Base JavaScript API.
import {mailSender,authBindings,developmentMail} from '../platform/operator-auth-runtime.mjs'
// @ts-ignore Portable Base mail module.
import {MailValidationError} from '../base/modules/mail/index.mjs'
import type {ErrorClass} from './queue'
export type Mail={deliveryId:string;to:string;subject:string;text:string}
export type SendResult={ok:true}|{ok:false;error:ErrorClass;retryable:boolean}
export type Send=(mail:Mail)=>Promise<SendResult>
/** Where notification mail goes: silent development suppression, a configured provider, or nowhere. */
export function sendingSetup(env:any):'suppressed'|'provider'|'not-set-up'{try{mailSender(env);return env.RER_DEMO==='1'?'provider':developmentMail(env)?'suppressed':'provider'}catch{return 'not-set-up'}}
// Accepted by the provider is not proof
// of inbox receipt. A definite refusal or an unconfirmed send is not retried:
// retrying an uncertain send could deliver it twice.
export function mailSend(env:any):Send{
 return async mail=>{
  let sender;try{sender=mailSender(env)}catch{return {ok:false,error:'not-set-up',retryable:true}}
  try{
   const result=await sender.send({deliveryId:mail.deliveryId,from:authBindings(env).MAIL_FROM,to:[mail.to],subject:mail.subject,text:mail.text})
   if(result.status==='accepted'||result.status==='development')return {ok:true}
   if(result.status==='rate_limited')return {ok:false,error:'rate-limited',retryable:true}
   return result.status==='uncertain'?{ok:false,error:'uncertain',retryable:false}:{ok:false,error:'refused',retryable:false}
  // A malformed message is refused for good.
  }catch(error){return {ok:false,error:'refused',retryable:!(error instanceof MailValidationError)}}
 }
}
