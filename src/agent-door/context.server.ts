import {ToolRefusal,type ToolContext} from '../base/modules/agent-door/index.ts'
import {Context,type StorageBindings} from '../platform/storage/context'
import type {Session} from '../base/modules/operator-auth/index.mjs'
import {productAccess} from '../team/access'
import {Fault} from '../family/team-chat/domain'

/** A native service principal, like IntegrationContext, never a browser session. */
class AgentContext extends Context {
 constructor(env:StorageBindings,session:Session,readonly invocation:ToolContext){super(env,session)}
 override get credentials(){return [this.uid,this.session.operator.version]}
 override get fence(){return `EXISTS(SELECT 1 FROM oa_operators o WHERE o.id=? AND o.version=? AND o.status='active' AND ${productAccess('o.id')})`}
 override attribution(resource:string){
  const who=this.invocation
  return [this.sql(`INSERT INTO nook_agent_activity(operation,agent,agent_name,sponsor,sponsor_name,approvers,resource,version,at)
   SELECT ?,?,?,?,?,?,?,COALESCE((SELECT version FROM nook_notes WHERE id=?),1),?
   ON CONFLICT(operation,resource) DO UPDATE SET version=excluded.version`,who.operationId,who.agent.id,who.agent.name,who.person.id,who.person.name,JSON.stringify(who.approvers),resource,resource,new Date().toISOString())]
 }
 resource=''
}
export async function nativeContext(env:StorageBindings,ctx:ToolContext,resource=''){
 const operator=await env.DB.prepare('SELECT id,email,display_name AS displayName,role,status,version FROM oa_operators WHERE id=?').bind(ctx.person.id).first<Session['operator']>()
 if(!operator||operator.status!=='active')throw new ToolRefusal('unauthenticated')
 const c=new AgentContext(env,{id:ctx.operationId,operatorId:operator.id,operator} as Session,ctx)
 c.resource=resource
 await c.check()
 return c
}
export async function nativeCall<T>(run:()=>Promise<T>):Promise<T>{
 try{return await run()}catch(error){if(error instanceof Fault)throw new ToolRefusal(error.status===401?'unauthenticated':error.status===403?'native_forbidden':error.status===404?'resource_unavailable':error.status===409?'revision_conflict':'invalid_arguments');throw error}
}
/** This first declared subset handles internal work. External audiences need the
 * provider/queued-consent lifecycle before their write tools can be exposed. */
export async function internalConversation(c:Context,id:string){
 const record=await c.one('SELECT id,name,kind,seq,version FROM nook_conversations WHERE id=?',[id],id)
 if(!record)throw new ToolRefusal('resource_unavailable')
 const external=await c.one("SELECT 1 FROM nook_members m JOIN nook_access a ON a.user=m.user WHERE m.conversation=? AND a.mode='guest' AND a.active=1 LIMIT 1",[id],id)
 if(external)throw new ToolRefusal('external_audience_not_supported')
 return record
}
