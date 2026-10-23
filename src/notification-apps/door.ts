import {auditDatabase} from '../audit/database'
import {authBindings} from '../platform/operator-auth.server'
import type {StorageBindings} from '../platform/storage/context'
import {sameHash,sealToken} from '../integrations/secret'
import {send,edit} from '../platform/storage/messages'
import {AppContext,RateLimit,audit,type Approval} from './context'
import {allowedGrant} from '../team/access'
import {fail,messageBody} from '../family/team-chat/domain'
import {appAuthors,identityValues,clientKey,receipt,acceptedMessage,lookup} from './receipts'
const headers={'cache-control':'no-store','x-content-type-options':'nosniff'}
export const isAppRequest=(request:Request)=>request.headers.get('authorization')?.startsWith('Bearer nookapp_')===true||new URL(request.url).pathname.startsWith('/api/notification-destinations/')
async function input(request:Request){
 if(request.headers.has('origin')&&request.headers.get('origin')!==new URL(request.url).origin)fail(403,'Origin denied')
 if(request.headers.get('content-type')!=='application/json')fail(415,'JSON required')
 const reader=request.body?.getReader(),chunks:Uint8Array[]=[];let size=0
 if(reader)for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>256*1024){await reader.cancel();fail(413,'Body too large')}chunks.push(value)}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
 let value;try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))}catch{fail(400,'Invalid JSON')}
 if(!value||typeof value!=='object'||Array.isArray(value))fail(400,'JSON object required');return value as Record<string,unknown>
}
export async function appRequest(bindings:StorageBindings,request:Request){
 const env={...bindings,...authBindings(bindings),DB:auditDatabase(bindings.DB,null)},url=new URL(request.url),p=url.pathname.split('/').filter(Boolean)
 let app:Approval|null=null
 try{
  const bearer=/^Bearer (nookapp_([0-9a-f-]{36})\.[A-Za-z0-9_-]{43})$/.exec(request.headers.get('authorization')??'')
  if(!bearer)return fail(404,'Destination unavailable')
  const found=await env.DB.prepare('SELECT app.*,secret.hash FROM nook_notification_apps app JOIN nook_notification_secrets secret ON secret.app=app.id WHERE app.id=?').bind(bearer[2]).first() as Approval|null
  if(!found||!sameHash(await sealToken(bearer[1],env.SESSION_SECRET),found.hash))return fail(404,'Destination unavailable')
  app=found
  if(p[1]!=='notification-destinations'||p[2]!==app.conversation||url.search||request.headers.has('signature-agent'))fail(404,'Destination unavailable')
  const c=new AppContext(env,app);await c.check(app.conversation)
  if(p.length===4&&p[3]==='audience'&&request.method==='GET'){
   // Read facts in a single guarded snapshot, including membership/role/email changes.
   const facts=await c.one(`SELECT json_object('privacy',room.kind,'archived',COALESCE(settings.archived,0),'sharing',COALESCE(sharing.state,'local'),'members',json((SELECT json_group_array(json_object('id',person.id,'name',person.name,'verifiedEmail',CASE WHEN EXISTS(SELECT 1 FROM nook_notification_email_facts proof WHERE proof.user=person.id AND proof.email=operator.email) THEN operator.email END,'guest',CASE access.mode WHEN 'guest' THEN 1 WHEN 'member' THEN 0 END,'bot',0)) FROM nook_members member JOIN nook_actors person ON person.id=member.user LEFT JOIN oa_operators operator ON operator.id=person.id LEFT JOIN nook_access access ON access.user=person.id WHERE member.conversation=room.id AND ${allowedGrant('member.user','member.conversation')})),'apps',json((SELECT json_group_array(json_object('id',id,'name',name,'verifiedEmail',NULL,'guest',NULL,'bot',1)) FROM nook_notification_apps WHERE conversation=room.id AND state='active'))) AS facts FROM nook_conversations room LEFT JOIN nook_channel_settings settings ON settings.conversation=room.id LEFT JOIN nook_notification_sharing sharing ON sharing.conversation=room.id WHERE room.id=?`,[app.conversation])
   if(!facts)fail(404,'Destination unavailable');const result=JSON.parse(facts.facts)
   return Response.json({channel:app.conversation,private:result.privacy==='private',archived:!!result.archived,sharing:{state:result.sharing,federationAvailable:false},members:[...result.members,...result.apps].map(m=>({...m,guest:m.guest===null?'unknown':!!m.guest,bot:!!m.bot,emailVerified:m.verifiedEmail?true:'unknown'}))},{headers})
  }
  await c.writable(app.conversation)
  if(p.length===5&&p[3]==='client-keys'&&request.method==='GET'){
   return Response.json(await lookup(c,clientKey(p[4])),{headers})
  }
  if(p.length===4&&p[3]==='messages'&&request.method==='POST'){
   const body=await input(request),key=request.headers.get('idempotency-key')??''
   if(Object.keys(body).some(k=>!['body','thread'].includes(k)))fail(400,'Send a body, optional thread and an Idempotency-Key')
   const intent=clientKey(key),previous=await acceptedMessage(c,intent)
   if(!previous&&(await lookup(c,intent)).state==='tombstone')fail(409,'Message intent was erased')
   const identity=previous?.author??(await c.one<{id:string}>(`${appAuthors} ORDER BY created,id LIMIT 1`,identityValues(app)))!.id
   const writer=new AppContext(env,app,identity);writer.rate=true
   writer.parent=typeof body.thread==='string'?body.thread:null
   const posted=await send(writer,app.conversation,{body:body.body,parent:body.thread,intent})
   // A post receipt stays identical after edits. Ordinary erasure still refuses
   // the removed intent rather than returning or resurrecting erased content.
   return Response.json({id:posted.id,conversation:app.conversation,author:posted.author,authorName:app.name,app:1,body:messageBody(body.body),created:posted.created,version:1,receipt:receipt(posted)},{headers})
  }
  if(p.length===5&&p[3]==='messages'&&['PATCH','DELETE'].includes(request.method)){
   const body=await input(request)
   if(Object.keys(body).some(k=>!['body','version'].includes(k)))fail(400,'Unsupported message field')
   // Resolve inside this channel before calling the ordinary versioned editor.
   const old=await c.one<{author:string;parent:string|null}>(`SELECT author,parent FROM nook_messages WHERE id=? AND conversation=? AND author IN (${appAuthors})`,[p[4],app.conversation,...identityValues(app)])??fail(404,'Destination unavailable')
   const writer=new AppContext(env,app,old.author);writer.source=p[4];writer.parent=old.parent
   return Response.json(await edit(writer,p[4],{...body,delete:request.method==='DELETE'}),{headers})
  }
  fail(404,'Destination unavailable')
 }catch(error){
  const status=error instanceof RateLimit?429:typeof (error as any).status==='number'?(error as any).status:500
  // Only a request that proved an approval records its refusal; an unauthenticated
  // one writes nothing. No request bodies, tokens, hashes or untrusted URLs enter the audit.
  if(app){const writer={sql:(sql:string,...values:any[])=>env.DB.prepare(sql).bind(...values)};await audit(writer,app.id,app.conversation,null,'refuse','failed').run()}
  return Response.json({error:status===404?'Destination unavailable':status===500?'Notification request failed':(error as Error).message},{status,headers:{...headers,...(error instanceof RateLimit?{'retry-after':String(error.seconds)}:{})}})
 }
}
