import type {Context} from '../../platform/storage/context'
import {fenceService,type Sql} from './portability'
import {sql,fencedRows} from './statements'
/** Other authors keep their work and state, but no assignee/action-to-person map. */
export async function detachAssignee(c:Context,f:Awaited<ReturnType<typeof fenceService>>,target:string){
 const statements:Sql[]=[...await fencedRows(c,f,'nook_outcome_versions',['outcome','version'],'actor=?',[target])]
 statements.push(sql('INSERT INTO nook_erased_assignees SELECT id FROM nook_outcomes WHERE assignee=?',target),sql('UPDATE nook_outcomes SET assignee=NULL WHERE assignee=?',target),sql('INSERT INTO nook_erased_outcome_actions SELECT outcome,version,body,status,deadline FROM nook_outcome_versions WHERE actor=?',target),sql('DELETE FROM nook_outcome_versions WHERE actor=?',target))
 return statements
}
