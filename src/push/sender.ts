import {authorization,encrypt,vapid} from './crypto'
import {endpoint,type Subscription} from './subscription'
import type {ErrorClass} from '../notify/queue'
export type PushResult={ok:true}|{ok:false;cancelled:true}|{ok:false;cancelled?:false;error:ErrorClass;retryable:boolean;expired?:boolean}
// The only injectable edge is the network. A thrown fetch is uncertain; it must
// never retry, since the vendor may have accepted the packet before disconnect.
export async function sendPush(env:any,sub:Subscription,payload:unknown,now:()=>number,network:typeof fetch,authorize:()=>Promise<number|null>):Promise<PushResult>{
 let target:string,body:Uint8Array,auth:string
 try{target=endpoint(sub.endpoint);const keys=await vapid(env);body=await encrypt(sub,JSON.stringify(payload));auth=await authorization(target,'mailto:'+env.OWNER_EMAIL,keys,now())}catch{return {ok:false,error:'not-set-up',retryable:false}}
 // Key retrieval and Web Crypto yield. Check current authority after all packet
 // preparation, immediately before the external request. D1 and fetch cannot be
 // atomic; a revocation after this check cannot retract an accepted packet.
 const sessionExpires=await authorize(),at=now()
 if(sessionExpires===null||sessionExpires<=at||sub.expirationTime!==null&&sub.expirationTime<=at)return {ok:false,cancelled:true}
 try{
  const response=await network(target,{method:'POST',redirect:'manual',signal:AbortSignal.timeout(20_000),headers:{Authorization:auth,'Content-Encoding':'aes128gcm','Content-Type':'application/octet-stream',TTL:'300',Urgency:'normal'},body:body.buffer as ArrayBuffer})
  await response.body?.cancel().catch(()=>{})
  if(response.status>=200&&response.status<300)return {ok:true}
  if([404,410].includes(response.status))return {ok:false,error:'refused',retryable:false,expired:true}
  return {ok:false,error:response.status===429?'rate-limited':'refused',retryable:response.status===429||response.status>=500}
 }catch{return {ok:false,error:'uncertain',retryable:false}}
}
