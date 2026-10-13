import type {Context} from '../../platform/storage/context'
import type {fenceService,Sql} from './portability'
import {authorizeWork} from './authorization'
import {sql,audit} from './statements'
/** A later explicit operator request destroys the alternative's retained copy. */
export async function eraseRetainedBody(c:Context,work:any,f:Awaited<ReturnType<typeof fenceService>>,statements:Sql[]){
 const table=work.kind==='message'?'nook_retained_message_bodies':'nook_retained_import_bodies'
 if(!await c.one(`SELECT id FROM ${table} WHERE id=?`,[work.target]))return false
 statements.push(...await f.row(table,{id:work.target}),sql(`DELETE FROM ${table} WHERE id=?`,work.target),sql('DELETE FROM nook_search WHERE message=?',work.target),sql("INSERT INTO nook_search(nook_search) VALUES('optimize')"),...audit('SELECT ?',[work.conversation]),sql("UPDATE nook_erasure_work SET phase='blobs' WHERE operation=?",work.operation))
 const scope=await authorizeWork(c,work)
 await c.batch(statements.map(s=>c.sql(s.sql,...s.params)),scope.conversation,scope.condition,scope.params)
 return true
}
