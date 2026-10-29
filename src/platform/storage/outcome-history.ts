import {fail} from '../../family/team-chat/domain'
import type {Context} from './context'
import {outcome} from './read'

export async function outcomeVersions(c:Context,id:string,before=0){
 if(!Number.isSafeInteger(before)||before<0)fail(400,'Invalid version cursor')
 const current=await outcome(c,id)
 if(current.erased)return {items:[],cursor:null,hasMore:false}
 // Erasure retains the action but removes its actor, just as in the archive.
 const rows=await c.rows(`SELECT v.version,v.body,v.status,v.deadline,COALESCE((SELECT e.agent_name||' for '||e.sponsor_name FROM nook_agent_activity e WHERE e.resource=v.outcome AND e.version=v.version ORDER BY e.at DESC LIMIT 1),a.name) AS actorName
 FROM (SELECT outcome,version,body,status,deadline,actor FROM nook_outcome_versions
 UNION ALL SELECT outcome,version,body,status,deadline,NULL FROM nook_erased_outcome_actions) v
 LEFT JOIN nook_actor_history a ON a.id=v.actor
 WHERE v.outcome=? AND v.version<? ORDER BY v.version DESC LIMIT 101`,[id,before||current.version+1],current.conversation)
 const items=rows.slice(0,100)
 return {items,cursor:items.at(-1)?.version??null,hasMore:rows.length>100}
}
