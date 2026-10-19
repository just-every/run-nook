import {Context,type StorageBindings} from '../platform/storage/context'
import {authBindings} from '../platform/operator-auth.server'
import {productAccess} from '../team/access'
import {send} from '../platform/storage/messages'
import type {Session} from '../base/modules/operator-auth/index.mjs'
import {parseToken,sameHash,sealToken} from './secret'
type Token={id:string;family:string;name:string;creator:string;hash:string;state:'active'|'rotated'|'revoked'}
// NOOK-079: a token acts with its creating owner's current authority, fenced by the
// token row in the same SQL snapshot as every read and write it makes.
const tokenFence=`EXISTS(SELECT 1 FROM nook_integration_tokens t JOIN oa_operators o ON o.id=t.creator WHERE t.id=? AND t.creator=? AND o.version=? AND t.state='active' AND o.status='active' AND o.role='owner' AND ${productAccess('o.id')})`
class IntegrationContext extends Context{
 constructor(env:StorageBindings,readonly token:Token,version:number){super(env,{id:token.id,operatorId:token.creator,operator:{version}} as unknown as Session)}
 override get fence(){return tokenFence}
 // The post and its audit row commit in one batch, or neither does.
 override writeBatch(statements:D1PreparedStatement[],conversation:string,condition='1',values:any[]=[]){
  return super.writeBatch([...statements,this.sql("INSERT INTO nook_integration_audit SELECT ?,?,?,?,?,'post',?,?,m.id,NULL,NULL FROM nook_messages m WHERE m.conversation=? AND m.author=? AND m.intent=?",crypto.randomUUID(),this.token.family,this.token.id,this.token.name,Date.now(),this.uid,conversation,conversation,this.uid,this.intent)],conversation,condition,values)
 }
 intent=''
}
const refusal=(status:number,code:string,error:string)=>Response.json({error,code},{status,headers:{'cache-control':'no-store'}})
const refused={
 invalid:()=>refusal(401,'integration_token_invalid','This integration token is not valid'),
 rotated:()=>refusal(401,'integration_token_rotated','This integration token was rotated; use its replacement'),
 revoked:()=>refusal(401,'integration_token_revoked','This integration token was revoked'),
 agent:()=>refusal(403,'agent_refused','Integration tokens are not for agents'),
 route:()=>refusal(403,'integration_token_route','Integration tokens only post messages'),
 conversation:()=>refusal(403,'integration_token_conversation','This token is not bound to that conversation'),
 key:()=>refusal(400,'idempotency_key_required','Send an Idempotency-Key header of 1 to 64 letters, digits or ._:-'),
 fields:()=>refusal(400,'integration_token_fields','Integration posts carry only a message body'),
}
export const integrationPost=(method:string,url:URL)=>method==='POST'&&/^\/api\/conversations\/[^/]+\/messages$/.test(url.pathname)&&!url.search
export const hasIntegrationToken=(request:Request)=>Boolean(parseToken(request.headers.get('authorization')))
// Returns null when the request carries no integration token; session routes handle it.
export async function integrationRequest(env:StorageBindings,request:Request,input:Record<string,unknown>):Promise<Response|null>{
 const bearer=parseToken(request.headers.get('authorization'))
 if(!bearer)return null
 const auth={...env,...authBindings(env)},db=env.DB
 const token=await db.prepare('SELECT id,family,name,creator,hash,state FROM nook_integration_tokens WHERE id=?').bind(bearer.id).first<Token>()
 if(!token)return refused.invalid()
 const url=new URL(request.url),parts=url.pathname.split('/').filter(Boolean),conversation=parts[2]??null
 const record=(code:string)=>db.prepare("INSERT INTO nook_integration_audit VALUES(?,?,?,?,?,'refuse',NULL,?,NULL,?,?)").bind(crypto.randomUUID(),token.family,token.id,token.name,Date.now(),parts[1]==='conversations'&&conversation?conversation:null,code,`${request.method} ${url.pathname}`).run()
 if(!sameHash(await sealToken(bearer.token,auth.SESSION_SECRET),token.hash)){await record('integration_token_invalid');return refused.invalid()}
 if(token.state!=='active'){await record('integration_token_'+token.state);return refused[token.state]()}
 // Agents act through their own accountable grants (NOOK-054), never an integration token.
 if(request.headers.has('signature-agent')){await record('agent_refused');return refused.agent()}
 if(!integrationPost(request.method,url)){await record('integration_token_route');return refused.route()}
 if(!await db.prepare('SELECT 1 FROM nook_integration_bindings WHERE family=? AND conversation=?').bind(token.family,conversation).first()){await record('integration_token_conversation');return refused.conversation()}
 const key=request.headers.get('idempotency-key')??''
 if(!/^[A-Za-z0-9._:-]{1,64}$/.test(key)){await record('idempotency_key_required');return refused.key()}
 if(Object.keys(input).some(field=>field!=='body')){await record('integration_token_fields');return refused.fields()}
 const owner=await db.prepare('SELECT version FROM oa_operators WHERE id=?').bind(token.creator).first<{version:number}>()
 const c=new IntegrationContext(auth,token,owner?.version??-1)
 // Same key, same family: the same message, across rotations, never a duplicate.
 c.intent=`integration:${token.family}:${key}`
 const before=await db.prepare('SELECT id FROM nook_messages WHERE conversation=? AND author=? AND intent=?').bind(conversation,token.creator,c.intent).first<{id:string}>()
 let message:Awaited<ReturnType<typeof send>>
 try{message=await send(c,conversation!,{body:input.body,intent:c.intent})}
 catch(error){await record('post_refused');throw error}
 if(before)await db.prepare("INSERT INTO nook_integration_audit VALUES(?,?,?,?,?,'replay',?,?,?,NULL,NULL)").bind(crypto.randomUUID(),token.family,token.id,token.name,Date.now(),token.creator,conversation,message.id).run()
 return Response.json(message,{headers:{'cache-control':'no-store',...(before?{'idempotent-replayed':'true'}:{})}})
}
