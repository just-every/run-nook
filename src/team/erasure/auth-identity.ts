import type {Context} from '../../platform/storage/context'
import {fenceService,type Sql} from './portability'
import {sql,fencedRows} from './statements'

/** Compose before deleting sessions and owner grants, while their ownership is available. */
export async function authIdentity(c:Context,f:Awaited<ReturnType<typeof fenceService>>,target:string){
 const result:Sql[]=[],sessions='session_id IN (SELECT id FROM oa_sessions WHERE operator_id=?)'
 for(const table of ['oa_provider_sessions','oa_provider_session_pins']){
  result.push(...await fencedRows(c,f,table,['session_id'],sessions,[target]),sql(`DELETE FROM ${table} WHERE ${sessions}`,target))
 }
 // Attribution and grant subjects are independent: another actor's audit can
 // refer to this person's grant. Keep policy facts, action and time unchanged.
 const subject="value=? OR (action='owner:signin-link' AND (actor_id=? OR value IN (SELECT id FROM oa_owner_signins WHERE operator_id=?)))"
 const affected=`actor_id=? OR ${subject}`
 if(await c.one(`SELECT 1 FROM oa_auth_audit WHERE ${affected} LIMIT 1`,[target,target,target,target])){
  result.push(...await f.checkpoint(),sql(`UPDATE oa_auth_audit SET
   actor_id=CASE WHEN actor_id=? THEN lower(hex(randomblob(16))) ELSE actor_id END,
   value=CASE WHEN ${subject} THEN lower(hex(randomblob(16))) ELSE value END
   WHERE ${affected}`,target,target,target,target,target,target,target,target))
 }
 return result
}
