import type {StorageBindings} from '../platform/storage/context'
import {authBindings} from '../platform/operator-auth.server'
import {auditDatabase} from '../audit/database'
import {send} from '../platform/storage/messages'
import {fail} from '../family/team-chat/domain'
import {sameHash} from '../integrations/secret'
import {readText} from './body'
import {RateLimit,type Approval} from './context'
import {EventContext,InteractiveContext} from './installed-context'
import {appAuthors,identityValues} from './receipts'
import {requestKey,signature,unsealSigning} from './signing'

export const publicAppPath=(path:string)=>/^\/hooks\/slack\/([0-9a-f-]{36})\/(events|interactivity)$/.exec(path)
const answer=(body:Record<string,unknown>,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}})
function object(value:unknown):Record<string,any>{if(!value||typeof value!=='object'||Array.isArray(value))fail(400,'Invalid payload');return value as Record<string,any>}
export async function publicAppRequest(bindings:StorageBindings,request:Request,match:RegExpExecArray):Promise<Response>{
 try{
  if(request.method!=='POST'||new URL(request.url).search)fail(404,'Installation unavailable')
  const env:StorageBindings={...bindings,...authBindings(bindings),DB:auditDatabase(bindings.DB,null)}
  const app=await env.DB.prepare("SELECT app.*,secret.hash,cap.signing,cap.act_as_installer FROM nook_notification_apps app JOIN nook_notification_secrets secret ON secret.app=app.id JOIN nook_notification_capabilities cap ON cap.app=app.id WHERE app.id=? AND app.state='active' AND cap.signing IS NOT NULL").bind(match[1]).first<Approval&{signing:string;act_as_installer:number}>()??fail(404,'Installation unavailable')
  const timestamp=request.headers.get('x-slack-request-timestamp')??'',supplied=request.headers.get('x-slack-signature')??''
  if(!/^\d{1,12}$/.test(timestamp)||Math.abs(Date.now()/1000-Number(timestamp))>300||!/^v0=[0-9a-f]{64}$/.test(supplied))fail(401,'Invalid signature')
  const raw=await readText(request,100*1024)??fail(413,'Payload too large')
  let secret:string;try{secret=await unsealSigning(app.signing,env.SESSION_SECRET)}catch{fail(401,'Invalid signature')}
  if(!sameHash(await signature(secret!,timestamp,raw),supplied))fail(401,'Invalid signature')
  const type=request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()
  let body:Record<string,any>;try{body=object(JSON.parse(type==='application/json'?raw:type==='application/x-www-form-urlencoded'?new URLSearchParams(raw).get('payload')??'null':'null'))}catch{fail(400,'Invalid payload')}
  const keys=['request:'+await requestKey(timestamp+':'+supplied)]
  let channel:string='',text:string='',parent:string|undefined=undefined
  if(match[2]==='events'){
   if(body!.type!=='event_callback'||typeof body!.event_id!=='string'||!body!.event_id||body!.event_id.length>200)fail(400,'Unsupported event')
   const event=object(body!.event)
   if(!['message','app_mention'].includes(event.type)||event.subtype!==undefined)fail(400,'Unsupported event')
   channel=event.channel;text=event.text;parent=event.thread_ts
   keys.push('event:'+await requestKey(body!.event_id))
  }else{
   if(!app.act_as_installer)fail(403,'Interactivity was not approved')
   channel=object(body!.channel).id
   if(body!.type==='block_actions'){
    if(!Array.isArray(body!.actions)||body!.actions.length!==1)fail(400,'Choose one action')
    const action=object(body!.actions[0]);if(action.action_id!=='post_message')fail(400,'Unsupported action');text=action.value
   }else if(['shortcut','message_action'].includes(body!.type)&&body!.callback_id==='post_message')text=body!.text
   else fail(400,'Unsupported action')
  }
  if(channel!==app.conversation)fail(404,'Channel unavailable')
  if(typeof text!=='string'||typeof parent!=='string'&&parent!==undefined)fail(400,'Invalid message')
  for(const key of keys)if(await env.DB.prepare('SELECT 1 FROM nook_notification_requests WHERE app=? AND key=?').bind(app.id,key).first())fail(409,'Request already received')
  const receipts=keys.map(key=>env.DB.prepare('INSERT INTO nook_notification_requests VALUES(?,?)').bind(app.id,key))
  let writer:EventContext|InteractiveContext
  if(match[2]==='events'){
   const identity=await env.DB.prepare(`${appAuthors} ORDER BY created,id LIMIT 1`).bind(...identityValues(app)).first<{id:string}>()
   writer=new EventContext(env,app,identity!.id,receipts);writer.rate=true;writer.parent=parent??null
  }else writer=new InteractiveContext(env,app,receipts)
  const message=await send(writer,channel,{body:text,parent,intent:'public-app:'+crypto.randomUUID()})
  return answer({ok:true,message:{id:message.id,author:message.author,body:message.body}})
 }catch(error){
  const status=error instanceof RateLimit?429:typeof(error as {status?:unknown}).status==='number'?(error as {status:number}).status:500
  // No body, signature, secret or arbitrary callback URL enters logs or audit.
  const response=answer({ok:false,error:status===500?'Public request failed':(error as Error).message},status)
  if(error instanceof RateLimit)response.headers.set('retry-after',String(error.seconds))
  return response
 }
}
