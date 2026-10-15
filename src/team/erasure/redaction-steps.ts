import {retireD1ImportCustody,reserveReturn,D1RequestLimitError,type D1CustodyRetirement,type D1ImportContext,type D1RelatedErasure,type D1RetirementProgress} from '../../imports/kit'
import {holding} from '../../imports/target-redaction'
import {REQUEST_STATEMENTS} from '../../imports/request-budget'
import {fail} from '../../family/team-chat/domain'
import type {Context} from '../../platform/storage/context'
import {sql} from './statements'
import type {fenceService,Sql} from './portability'
type Scope={conversation?:string;condition:string;params:any[]}
const same=(a:readonly unknown[],b:readonly unknown[])=>JSON.stringify(a)===JSON.stringify(b)
/** Removing a person's Slack ID from other people's imported reactions can be more
 * work than one request may run. Import-kit then commits it in bounded steps (whole
 * imports, or pages of one import that alone is too large); the erasure stays pending
 * between steps and its work row keeps the number of messages that named the person
 * and the kit's continuation (job ids, revisions and match counts, never the ID).
 * The count is written before the first step commits, so a lost continuation or a
 * reset never changes the receipt. Each request takes one step. The person's own
 * rows, the receipt's reaction count and the move to file deletion commit only with
 * the final step. The kit counts only its own statements against D1's 1,000 per
 * request, so it is given Nook's 900-statement request budget: the sign-in, the
 * work row and the saved progress run beside it. */
export async function redactInSteps(c:Context,work:any,scope:Scope,target:{kind:string;id:string},values:string[],related:D1RelatedErasure,statements:Sql[],destination:string,ctx:D1ImportContext,f:Awaited<ReturnType<typeof fenceService>>){
 const state:{messages:number;continuation?:any}|undefined=work.redaction?JSON.parse(work.redaction):undefined,held=holding(related.fields!)
 const named=async():Promise<number>=>(await c.one(`SELECT COUNT(*) AS n FROM nook_import_effect_revisions e WHERE e.destination=? AND (${held.sql})`,[destination,...held.params!])).n
 // Imported messages whose reactions named the person when the erasure began. The
 // receipt reports this count, so it is saved before the first step commits and
 // survives a lost continuation or a reset.
 const current=state?.continuation?state.messages:await named()
 const messages:number=state?.messages??current
 if(!state)await persist(c,work,scope,JSON.stringify({messages}))
 // Each path must match while messages that name the person remain; it may match
 // nothing only when none does.
 const fields=related.fields!.map(field=>({...field,optional:current===0}))
 const receipt=sql("UPDATE nook_erasure_receipts SET counts=json_set(counts,'$.reactions',coalesce(json_extract(counts,'$.reactions'),0)+?) WHERE id=?",messages,work.operation)
 // The next associated actor starts its own count and continuation. Both this
 // reset and the accumulated receipt commit only with this actor's final step.
 const completed=sql('UPDATE nook_erasure_work SET redaction=NULL WHERE operation=?',work.operation)
 let result:D1CustodyRetirement|D1RetirementProgress
 try{result=await retireD1ImportCustody({target,values,related:{...related,fields}},[...statements,receipt,completed],reserveReturn(ctx,1000-REQUEST_STATEMENTS),await f.checkpoint(),{resumable:true,continuation:state?.continuation})}
 catch(error){
  // Imported history changed between steps (an import was undone, say): start again from what is there now.
  if(state?.continuation&&['IMPORT_REDACTION_PATH_UNMATCHED','IMPORT_REDACTION_CONTINUATION_MISMATCH'].includes((error as Error).message)){await persist(c,work,scope,JSON.stringify({messages}));fail(409,'Imported history changed; resume the erasure')}
  // A step too large for one request writes nothing: the erasure stays pending
  // and is retried; it never completes keeping the ID.
  if(error instanceof D1RequestLimitError)fail(503,'Erasure pending: removing this person from imported reactions needs a step larger than one request')
  throw error
 }
 // The kit counts every copy it rewrote per path. Each requested path must be
 // reported, and must have matched when messages named the person.
 for(const field of fields){
  const count=result.fieldMatches.find(item=>same(item.path,field.path))
  if(!count||!Number.isSafeInteger(count.matches)||count.matches<0)throw Error('Reaction redaction did not report its match count')
  if(result.phase==='complete'&&current>0&&count.matches===0)throw Error('Reaction redaction matched nothing')
 }
 if(result.phase==='redacting')await persist(c,work,scope,JSON.stringify({messages,continuation:result.continuation}))
}
async function persist(c:Context,work:any,scope:Scope,redaction:string|null){
 await c.batch([c.sql("UPDATE nook_erasure_work SET redaction=? WHERE operation=? AND phase='data'",redaction,work.operation)],scope.conversation,scope.condition,scope.params)
}
