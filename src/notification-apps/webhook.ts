import {publicAppPath,publicAppRequest} from './public'
import type {StorageBindings} from '../platform/storage/context'
import {authBindings} from '../platform/operator-auth.server'
import {sameHash,sealToken} from '../integrations/secret'
import {appRequest} from './door'
import {formatSlackPayload,UNSUPPORTED_NOTICE} from './slack-format'
import {readText} from './body'
import {WEB_API,webApiRequest} from './web-api'
// Slack-compatible entry: incoming webhooks, where `/hooks/slack/<token>` is one approved app's channel token in URL form, and the
// Web API at `/api/slack/<method>` (web-api.ts). Both post through the same approval, identity, posting fence, rate limit and audit
// as the notification-destination door, and answer in Slack's words.
export const isWebhookRequest=(request:Request)=>{const path=new URL(request.url).pathname;return path.startsWith('/hooks/slack/')||path.startsWith(WEB_API)}
const MAX_BYTES=100*1024
const answer=(code:string,status:number,extra:Record<string,string>={})=>new Response(code,{status,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...extra}})
async function payload(request:Request){
 const type=request.headers.get('content-type')?.split(';')[0].trim().toLowerCase(),text=await readText(request,MAX_BYTES)
 if(text===null)return null
 try{
  const value=type==='application/json'?JSON.parse(text):type==='application/x-www-form-urlencoded'?JSON.parse(new URLSearchParams(text).get('payload')??'null'):null
  return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null
 }catch{return null}
}
export async function webhookRequest(bindings:StorageBindings,request:Request):Promise<Response>{
 const publicPath=publicAppPath(new URL(request.url).pathname);if(publicPath)return publicAppRequest(bindings,request,publicPath)
 if(new URL(request.url).pathname.startsWith(WEB_API))return webApiRequest(bindings,request)
 const env={...bindings,...authBindings(bindings)},token=decodeURIComponent(new URL(request.url).pathname.slice('/hooks/slack/'.length))
 const bearer=/^(nookapp_([0-9a-f-]{36})\.[A-Za-z0-9_-]{43})$/.exec(token)
 if(request.method!=='POST'||!bearer)return answer('no_service',404)
 const app=await bindings.DB.prepare("SELECT app.conversation,secret.hash FROM nook_notification_apps app JOIN nook_notification_secrets secret ON secret.app=app.id WHERE app.id=? AND app.state='active'").bind(bearer[2]).first<{conversation:string;hash:string}>()
 if(!app||!sameHash(await sealToken(bearer[1],env.SESSION_SECRET),app.hash))return answer('no_service',404)
 const body=await payload(request)
 if(!body)return answer('invalid_payload',400)
 const formatted=formatSlackPayload(body),text=formatted.text
 if(!text.trim())return answer('no_text',400)
 const thread=body.thread_ts===undefined?undefined:typeof body.thread_ts==='string'&&body.thread_ts?body.thread_ts:null
 if(thread===null)return answer('invalid_payload',400)
 const forwarded=new Request(new URL(`/api/notification-destinations/${app.conversation}/messages`,request.url),{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+bearer[1],'idempotency-key':crypto.randomUUID()},body:JSON.stringify({body:text+(formatted.unsupported?'\n\n_'+UNSUPPORTED_NOTICE+'_':''),...(thread?{thread}:{})})})
 const response=await appRequest(bindings,forwarded)
 if(!response)return answer('no_service',404)
 if(response.ok)return answer('ok',200)
 if(response.status===429)return answer('rate_limited',429,{'retry-after':response.headers.get('retry-after')??'1'})
 if(response.status===403)return answer('action_prohibited',403)
 if(response.status===404)return answer('no_service',404)
 if(thread&&response.status===400)return answer('channel_not_found',404)
 return answer('invalid_payload',400)
}
