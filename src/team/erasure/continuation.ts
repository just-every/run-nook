import {Context,type StorageBindings} from '../../platform/storage/context'
import {advance} from './service'
/** An accepted operation continues only while its initiating session and role
 * remain current. Another eligible operator can explicitly resume it. Each
 * operation takes at most one step per pass, so a reaction redaction spread over
 * steps runs one bounded step per invocation; a step too large for one request
 * leaves its erasure pending. */
export async function continueErasures(env:StorageBindings){
 const visited:string[]=[]
 for(let n=0;n<8;n++){
  const row=await env.DB.prepare(`SELECT w.operation,s.id,s.operator_id AS operatorId,s.created_at AS createdAt,s.expires_at AS expiresAt,s.kind,o.email,o.display_name AS displayName,o.role,o.status,o.version,o.created_at AS operatorCreatedAt FROM nook_erasure_work w JOIN oa_sessions s ON s.id=w.requested_session AND s.operator_id=w.requested_by AND s.operator_version=w.requested_version JOIN oa_operators o ON o.id=s.operator_id AND o.version=s.operator_version WHERE w.phase='data' AND w.operation NOT IN (SELECT value FROM json_each(?)) AND o.status='active' AND s.revoked_at IS NULL AND s.expires_at>? LIMIT 1`).bind(JSON.stringify(visited),Date.now()).first<any>()
  if(!row)return
  const {operation,email,displayName,role,status,version,operatorCreatedAt,...session}=row
  visited.push(operation)
  try{await advance(new Context(env,{...session,operator:{id:session.operatorId,email,displayName,role,status,version,createdAt:operatorCreatedAt}}),operation,true)}catch(error){if(![401,403,409,503].includes((error as any).status))throw error}
 }
}
