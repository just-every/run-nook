import type {StorageBindings} from '../platform/storage/context'
import {authBindings} from '../platform/operator-auth.server'
import {auditDatabase} from '../audit/database'
import {sameHash,sealToken} from '../integrations/secret'
import branding from '../branding.json'
import {appRequest} from './door'
import {AppContext,type Approval} from './context'
import {appAuthors,identityValues} from './receipts'
import {formatSlackPayload,UNSUPPORTED_NOTICE} from './slack-format'
import {readText} from './body'
// Slack's Web API at `/api/slack/<method>` for an approved app's channel token sent as `Authorization: Bearer`. Posts, edits and
// deletes are forwarded to the notification-destination door exactly as the webhook forwards its posts, so the approval, app
// identity, posting fence, rate limit and audit are the door's. Answers use Slack's envelope and error names.
export const WEB_API='/api/slack/'
const reads=new Set(['auth.test','chat.getPermalink']),methods=new Set([...reads,'chat.postMessage','chat.update','chat.delete'])
const MAX_BYTES=1024*1024
class Refusal extends Error{constructor(readonly error:string,readonly retry?:string){super(error)}}
function no(error:string,retry?:string):never{throw new Refusal(error,retry)}
const reply=(body:Record<string,unknown>,status=200,extra:Record<string,string>={})=>Response.json(body,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff',...extra}})
// SDKs send form fields (objects as JSON strings) or a JSON object; a GET carries its arguments in the query.
async function args(request:Request,url:URL):Promise<Record<string,unknown>>{
 const query=Object.fromEntries(url.searchParams)
 if(request.method==='GET')return query
 const type=request.headers.get('content-type')?.split(';')[0].trim().toLowerCase(),text=await readText(request,MAX_BYTES)??no('invalid_arguments')
 if(!text.trim())return query
 if(type==='application/x-www-form-urlencoded')return {...query,...Object.fromEntries(new URLSearchParams(text))}
 let value:unknown=null;try{if(type==='application/json')value=JSON.parse(text)}catch{}
 return value&&typeof value==='object'&&!Array.isArray(value)?{...query,...value as Record<string,unknown>}:no('invalid_arguments')
}
function list(value:unknown):unknown[]{
 if(value===undefined||value===null||value==='')return []
 if(Array.isArray(value))return value
 try{const parsed=JSON.parse(String(value));if(Array.isArray(parsed))return parsed}catch{}
 return no('invalid_arguments')
}
// The webhook's Slack formatting; an unsupported block or field keeps its text, shows the notice and is reported as a warning.
function content(a:Record<string,unknown>){
 if(a.text!==undefined&&a.text!==null&&typeof a.text!=='string')no('invalid_arguments')
 const formatted=formatSlackPayload({text:a.text??'',blocks:list(a.blocks),attachments:list(a.attachments)})
 if(!formatted.text.trim())no('no_text')
 return {body:formatted.text+(formatted.unsupported?'\n\n_'+UNSUPPORTED_NOTICE+'_':''),meta:formatted.unsupported?{response_metadata:{warnings:['unsupported_formatting']}}:{}}
}
const message=(m:{id:string;author:string;body:string;parent?:string|null},thread=m.parent)=>({type:'message',subtype:'bot_message',text:m.body,ts:m.id,user:m.author,bot_id:m.author,...(thread?{thread_ts:thread}:{})})
const forward=async(bindings:StorageBindings,request:Request,app:Approval,token:string,method:string,path:string,body:Record<string,unknown>)=>(await appRequest(bindings,new Request(new URL(`/api/notification-destinations/${app.conversation}/messages${path}`,request.url),{method,headers:{'content-type':'application/json',authorization:'Bearer '+token,...(method==='POST'?{'idempotency-key':crypto.randomUUID()}:{})},body:JSON.stringify(body)})))??no('channel_not_found')
// The door's refusals in Slack's words. A 409 is a destination that cannot take this write now (archived, shared or changed).
async function refused(response:Response,method:string,thread=false):Promise<never>{
 if(response.status===429)no('ratelimited',response.headers.get('retry-after')??'1')
 const error=((await response.json().catch(()=>null)) as {error?:unknown}|null)?.error
 if(error==='message_too_long'||response.status===413)no('msg_too_long')
 if(response.status===403)no('restricted_action')
 if(response.status===404||thread&&response.status===400)no('channel_not_found')
 if(response.status===409)no(method==='chat.update'?'cant_update_message':method==='chat.delete'?'cant_delete_message':'restricted_action')
 return no(response.status>=500?'internal_error':'invalid_arguments')
}
export async function webApiRequest(bindings:StorageBindings,request:Request):Promise<Response>{
 const url=new URL(request.url),method=url.pathname.slice(WEB_API.length)
 // Every other method, including the rest the clause lists, answers before any token or body is read and writes nothing.
 if(!methods.has(method))return reply({ok:false,error:'unknown_method'})
 try{
  if(request.method!=='POST'&&!(request.method==='GET'&&reads.has(method)))no('invalid_arguments')
  const bearer=/^Bearer (nookapp_([0-9a-f-]{36})\.[A-Za-z0-9_-]{43})$/.exec(request.headers.get('authorization')??no('not_authed'))??no('invalid_auth')
  const env={...bindings,...authBindings(bindings),DB:auditDatabase(bindings.DB,null)}
  const app=await bindings.DB.prepare("SELECT app.*,secret.hash FROM nook_notification_apps app JOIN nook_notification_secrets secret ON secret.app=app.id WHERE app.id=? AND app.state='active'").bind(bearer[2]).first<Approval>()
  if(!app||!sameHash(await sealToken(bearer[1],env.SESSION_SECRET),app.hash))no('invalid_auth')
  const a=await args(request,url)
  if(method==='auth.test'){
   // The app identity is the approved name/channel pair's first approval, as the door posts it; no person's data.
   const identity=(await bindings.DB.prepare(`${appAuthors} ORDER BY created,id LIMIT 1`).bind(...identityValues(app)).first<{id:string}>())!.id
   return reply({ok:true,url:url.origin+'/',team:branding.name,team_id:url.host,user:app.name,user_id:identity,bot_id:identity})
  }
  // Any conversation outside the token's grant reads as missing, never revealing whether it exists.
  if(a.channel!==app.conversation)no('channel_not_found')
  if(method==='chat.postMessage'){
   const {body,meta}=content(a),thread=a.thread_ts===undefined||a.thread_ts===''?undefined:typeof a.thread_ts==='string'?a.thread_ts:no('invalid_arguments')
   const response=await forward(bindings,request,app,bearer[1],'POST','',{body,...(thread?{thread}:{})})
   if(!response.ok)return await refused(response,method,!!thread)
   const posted=await response.json() as {id:string;author:string;body:string}
   return reply({ok:true,channel:app.conversation,ts:posted.id,message:message(posted,thread),...meta})
  }
  const ts=method==='chat.getPermalink'?a.message_ts:a.ts
  if(typeof ts!=='string'||!ts)no('invalid_arguments')
  const found=await new AppContext(env,app).one<{parent:string|null;deleted:number;version:number;own:number}>(`SELECT parent,deleted,version,author IN (${appAuthors}) AS own FROM nook_messages WHERE id=? AND conversation=?`,[...identityValues(app),ts,app.conversation],app.conversation)
  if(!found||found.deleted)no('message_not_found')
  if(method==='chat.getPermalink'){
   // A link into Nook: it opens the message only for someone who is a member of the channel when they follow it.
   const link=new URL('/app',url.origin);link.searchParams.set('conversation',app.conversation);if(found.parent)link.searchParams.set('thread',found.parent);link.searchParams.set('focus',ts)
   return reply({ok:true,channel:app.conversation,permalink:link.href})
  }
  // Only this app identity's own messages change, through the door's versioned edit and delete.
  if(!found.own)no(method==='chat.update'?'cant_update_message':'cant_delete_message')
  if(method==='chat.delete'){
   const response=await forward(bindings,request,app,bearer[1],'DELETE','/'+encodeURIComponent(ts),{version:found.version})
   if(!response.ok)return await refused(response,method)
   return reply({ok:true,channel:app.conversation,ts})
  }
  const {body,meta}=content(a),response=await forward(bindings,request,app,bearer[1],'PATCH','/'+encodeURIComponent(ts),{body,version:found.version})
  if(!response.ok)return await refused(response,method)
  const edited=await response.json() as {id:string;author:string;body:string;parent:string|null}
  return reply({ok:true,channel:app.conversation,ts,text:edited.body,message:message(edited),...meta})
 }catch(error){
  if(error instanceof Refusal)return reply({ok:false,error:error.error},error.retry?429:200,error.retry?{'retry-after':error.retry}:{})
  // A guarded read refused after the token check: the approval or its channel stopped being available.
  if((error as {status?:unknown}).status===404)return reply({ok:false,error:'channel_not_found'})
  console.error(error)
  return reply({ok:false,error:'internal_error'})
 }
}
