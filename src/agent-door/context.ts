import type { ToolContext, ResourceContext } from '../base/modules/agent-door/types.ts'
import type { Operator } from '../base/modules/operator-auth/index.mjs'
import { ToolRefusal } from '../base/modules/agent-door/index.ts'
import { Context, type StorageBindings } from '../platform/storage/context'
import { Fault } from '../family/team-chat/domain'

export async function nativeContext(env:StorageBindings,who:ToolContext|ResourceContext){
 const operator=await env.DB.prepare('SELECT id,email,display_name AS displayName,role,status,version,created_at AS createdAt FROM oa_operators WHERE id=?').bind(who.person.id).first<Operator>()
 if(!operator||operator.status!=='active')throw new ToolRefusal('not_found')
 const state=await env.DB.prepare('SELECT envelope,local_revision FROM agent_door_state WHERE id=1').first<{envelope:string|null;local_revision:number}>()
 const c=new Context(env,{kind:'agent',operator,agentId:who.agent.id,consent:who.consent,scopes:who.scopes,clientId:who.clientId,idempotencyKey:who.idempotencyKey,policy:state?.envelope??null,localRevision:state?.local_revision??0,operationId:who.operationId??crypto.randomUUID(),label:`${who.agent.name} for ${operator.displayName}`,approvers:'approvers' in who?who.approvers:[]})
 await c.check();return c
}
export async function nativeCall<T>(work:()=>Promise<T>):Promise<T>{
 try{return await work()}catch(error){if(error instanceof Fault)throw new ToolRefusal(error.status===404||error.status===403?'not_found':error.status===409?'revision_conflict':'native_refused');throw error}
}
