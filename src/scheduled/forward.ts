import {Context,authority,type StorageBindings} from '../platform/storage/context'
import type {Session} from '../base/modules/operator-auth/index.mjs'
import {previewForward} from '../forwards/plan'
import {sendForward} from '../forwards/server'
import {fail} from '../family/team-chat/domain'

export type ForwardDefinition={source:string;mode:string;note:string;destinations:{conversation:string;thread:string|null}[];confirmation:string;proofs:string[];session:string|null}
export async function prepareForward(c:Context,input:Record<string,any>):Promise<ForwardDefinition>{
 const v=await previewForward(c,input)
 if(v.mode==='show'&&input.confirmation!==v.confirmation)fail(409,'Review the current disclosure preview before scheduling')
 const proofs=[]
 for(const destination of v.destinations)proofs.push((await previewForward(c,{source:v.original.id,mode:v.mode,note:v.note,destinations:[destination]})).confirmation)
 return {source:v.original.id,mode:v.mode,note:v.note,destinations:v.destinations,confirmation:v.confirmation,proofs,session:c.session.id}
}
export function publicForward(f:ForwardDefinition){const {session,proofs,...visible}=f;return visible}

type Schedule={id:string;user:string;local_at:string;zone:string;next_due:number;version:number;operator_version:number;access_generation:number}
// This is the exact approving session's authority tuple, not a service identity.
// Context checks the original live oa_sessions row, expiry and account version
// on every read and in the final transaction. Archives remove this session ID.
export async function deliverForward(env:StorageBindings,s:Schedule,f:ForwardDefinition,now:number){
 const c=new Context(env,{id:f.session??'',operatorId:s.user,operator:{version:s.operator_version}} as Session)
 const fence="EXISTS(SELECT 1 FROM nook_schedules s JOIN nook_access a ON a.user=s.user WHERE s.id=? AND s.version=? AND s.state='active' AND s.next_due=? AND a.generation=?)",values=[s.id,s.version,s.next_due,s.access_generation]
 const finish=(ids:string[],reason:string|null)=>[
  c.sql('INSERT INTO nook_schedule_occurrences VALUES(?,?,?,?,?,?,?,?,?)',s.id,s.local_at,s.version,s.next_due,s.zone,ids[0]??null,ids.length?'sent':'failed',reason,now),
  c.sql("UPDATE nook_schedules SET state=?,reason=?,updated=? WHERE id=?",ids.length?'complete':'failed',reason,now,s.id),
 ]
 const refused:string[]=[],destinations=[]
 try{await c.check()}catch{refused.push('Your approving session expired, was revoked, or your account changed. Review and save a new time.')}
 if(!refused.length)for(const [index,destination] of f.destinations.entries()){
  try{const current=await previewForward(c,{...publicForward(f),destinations:[destination]});if(current.confirmation!==f.proofs[index])fail(409,'Source, audience or forwarding policy changed; review disclosure again');destinations.push(destination)}catch(error){refused.push(destination.conversation+': '+((error as any).status?(error as Error).message:'Forwarding is unavailable'))}
 }
 const reason=refused.length?refused.join('; ').slice(0,500):null
 if(destinations.length){
  try{
   const input={...publicForward(f),destinations,intent:'scheduled:'+s.id+':'+s.version+':'+s.local_at}
   const current=await previewForward(c,input)
   await sendForward(c,{...input,confirmation:current.confirmation},{condition:fence,values,statements:ids=>finish(ids,reason)})
   return
  }catch(error){
   // A lost successful response already advanced this same schedule atomically.
   if(!await env.DB.prepare('SELECT 1 WHERE '+fence).bind(...values).first())return
   refused.push((error as any).status?(error as Error).message:'Scheduled forwarding was not confirmed; review before rescheduling')
  }
 }
 const key=crypto.randomUUID()
 await env.DB.batch([c.sql(`INSERT INTO nook_guard VALUES(?,CASE WHEN ${authority} AND ${fence} THEN 1 ELSE 0 END)`,key,...values),...finish([],refused.join('; ').slice(0,500)||'Forwarding unavailable'),c.sql('DELETE FROM nook_guard WHERE id=?',key)]).catch(error=>{if(!/constraint/i.test(String(error)))throw error})
}
