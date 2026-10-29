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
 override async batch(statements:D1PreparedStatement[],conversation?:string,condition='1',values:any[]=[]){
  const who=this.invocation
  const state=await this.db.prepare('SELECT envelope,local_revision FROM agent_door_state WHERE id=1').first<{envelope:string|null;local_revision:number}>()
  const paired=!!this.env.RER_OWNER_CLAIM_ISSUER
  const policyFence=paired?`s.envelope=? AND json_extract(s.envelope,'$.paused')=0 AND json_extract(s.envelope,'$.document') IS NOT NULL AND json_extract(s.envelope,'$.exp')*1000>CAST(unixepoch('subsec')*1000 AS INTEGER)
   AND NOT EXISTS(SELECT 1 FROM json_each(s.envelope,'$.revoked.agents') WHERE value=?)
   AND NOT EXISTS(SELECT 1 FROM json_each(s.envelope,'$.revoked.consents') WHERE value=?)`:`s.local_document IS NOT NULL AND s.local_revision=?`
  const guard=`EXISTS(SELECT 1 FROM agent_door_state s WHERE s.id=1 AND s.local_paused=0 AND ${policyFence}) AND EXISTS(SELECT 1 FROM agent_door_agents a WHERE a.id=? AND a.sponsor=? AND a.revoked=0)`
  await super.batch(statements,conversation,`(${condition}) AND ${guard}`,[...values,...(paired?[state?.envelope??'',who.agent.id,who.consent??'']:[state?.local_revision??-1]),who.agent.id,who.person.id])
 }
 override attribution(resource:string){
  const who=this.invocation
  return [this.sql(`INSERT INTO nook_agent_activity(operation,agent,agent_name,sponsor,sponsor_name,approvers,resource,version,at)
   SELECT ?,?,?,?,?,?,?,COALESCE((SELECT version FROM nook_notes WHERE id=?),(SELECT version FROM nook_outcomes WHERE id=?),1),?
   ON CONFLICT(operation,resource) DO UPDATE SET version=excluded.version`,who.operationId,who.agent.id,who.agent.name,who.person.id,who.person.name,JSON.stringify(who.approvers),resource,resource,resource,new Date().toISOString())]
 }
}
export async function nativeContext(env:StorageBindings,ctx:ToolContext){
 const operator=await env.DB.prepare('SELECT id,email,display_name AS displayName,role,status,version FROM oa_operators WHERE id=?').bind(ctx.person.id).first<Session['operator']>()
 if(!operator||operator.status!=='active')throw new ToolRefusal('unauthenticated')
 const c=new AgentContext(env,{id:ctx.operationId,operatorId:operator.id,operator} as Session,ctx)
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
