import {fail} from '../family/team-chat/domain'
import {b64,unb64,utf8} from './crypto'
export type Subscription={endpoint:string;keys:{p256dh:string;auth:string};expirationTime:number|null}
export function endpoint(value:unknown):string{
 if(typeof value!=='string'||value.length>2048)fail(400,'Invalid push endpoint')
 let u:URL;try{u=new URL(value as string)}catch{return fail(400,'Invalid push endpoint')}
 const vendors=['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com']
 if(u.protocol!=='https:'||u.port||u.username||u.password||u.hash||!vendors.includes(u.hostname)||u.pathname==='/')fail(400,'Unsupported push endpoint')
 return u.href
}
export async function subscription(input:any):Promise<Subscription>{
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['endpoint','keys','expirationTime'].includes(k)))fail(400,'Invalid subscription')
 const url=endpoint(input.endpoint),keys=input.keys
 if(!keys||typeof keys!=='object'||Object.keys(keys).sort().join(',')!=='auth,p256dh')fail(400,'Invalid subscription keys')
 try{if(typeof keys.p256dh!=='string'||keys.p256dh.length!==87||typeof keys.auth!=='string'||keys.auth.length!==22)throw Error();const pub=unb64(keys.p256dh),auth=unb64(keys.auth);if(pub.length!==65||pub[0]!==4||auth.length!==16)throw Error();await crypto.subtle.importKey('raw',pub,{name:'ECDH',namedCurve:'P-256'},false,[])}catch{fail(400,'Invalid subscription keys')}
 if(input.expirationTime!=null&&(!Number.isSafeInteger(input.expirationTime)||input.expirationTime<=Date.now()))fail(400,'Subscription expired')
 return {endpoint:url,keys:{p256dh:keys.p256dh,auth:keys.auth},expirationTime:input.expirationTime??null}
}
export const endpointHash=async(value:string)=>b64(await crypto.subtle.digest('SHA-256',utf8(value)))
