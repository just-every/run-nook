import {retireDoorIdentity} from './door-custody'
import {eraseScheduleFiles} from '../../scheduled/erasure'
import {inheritPriorBlobs} from './prior-blobs'
import {memberMessageBodies,priorDeletionScope} from './policy'
import {eraseRetainedBody} from './retained-bodies'
import {importedStep} from './imported'
import {fail} from '../../family/team-chat/domain'
import type {Context} from '../../platform/storage/context'
import {authorize,authorizeWork} from './authorization'
import {confirmation,retained} from './graph'
import {preview} from './plan'
import {fenceService} from './portability'
import {sql,messages,files,outcomes} from './statements'
import {identity} from './identity'
import {drainBlobs} from './blobs'
export {preview}
export async function pending(c:Context){await c.check();const rows=await c.rows('SELECT * FROM nook_erasure_work LIMIT 100'),result=[];for(const work of rows){try{await authorizeWork(c,work);result.push(await receipt(c,work.operation))}catch(error){if((error as any).status!==403)throw error}}return result}
export async function receipt(c:Context,id:string){await c.check();const row=await c.one('SELECT * FROM nook_erasure_receipts WHERE id=?',[id]);if(!row)fail(404,'Erasure receipt unavailable');const work=await c.one('SELECT * FROM nook_erasure_work WHERE operation=?',[id]);if(work)await authorizeWork(c,work);return {id:row.id,kind:row.kind,state:row.state,counts:JSON.parse(row.counts),memberMessageBodies:row.member_bodies,priorDeletionScope:row.kind==='member'?priorDeletionScope:undefined,retained,seconds:((row.completed??Date.now())-row.created)/1000}}
export async function erase(c:Context,kind:string,target:string,input:any,author=false){
 if(input.confirmation!==confirmation)fail(400,'Type ERASE to confirm')
 const prior=await c.one('SELECT * FROM nook_erasure_work WHERE kind=? AND target=?',[kind,target]);if(prior){await authorizeWork(c,prior);return receipt(c,prior.operation)}
 const scope=await authorize(c,kind,target,author)
 if(input.version!==undefined&&input.version!==scope.row.version)fail(409,'Message changed; reload')
 const id=crypto.randomUUID(),counts=['member','imported-author','imported-message'].includes(kind)?(await preview(c,kind,target)).counts:{messages:kind==='message'?1:0,files:(await c.one(`SELECT count(*) AS n FROM nook_attachments WHERE ${kind==='message'?'message':'id'}=?`,[target])).n,outcomes:0}
 await c.batch([c.sql("INSERT INTO nook_erasure_receipts(id,kind,state,counts,created,completed,member_bodies) VALUES(?,?,'pending',?,?,NULL,?)",id,kind,JSON.stringify(counts),Date.now(),kind==='member'?memberMessageBodies:'erase'),c.sql("INSERT INTO nook_erasure_work(operation,target,kind,author,target_role,conversation,own,requested_by,requested_session,requested_version,member_bodies,authority_class) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",id,target,kind,scope.row.author??c.uid,scope.row.role??null,scope.conversation??null,author||kind==='attachment'?1:0,c.uid,c.session.id,c.session.operator.version,kind==='member'?memberMessageBodies:'erase',author||kind==='attachment'?'author':kind==='member'?'member-manager':kind==='imported-author'?'import-owner':'channel-operator'),...(kind==='member'?[c.sql("UPDATE oa_operators SET status='inactive' WHERE id=?",target)]:[])],scope.conversation,scope.condition,scope.params)
 return advance(c,id)
}
export async function advance(c:Context,id:string,quiet=false){
 const work=await c.one('SELECT * FROM nook_erasure_work WHERE operation=?',[id]);if(work){
  const scope=await authorizeWork(c,work);if(!quiet)await c.batch([c.sql('UPDATE nook_erasure_work SET requested_by=?,requested_session=?,requested_version=? WHERE operation=?',c.uid,c.session.id,c.session.operator.version,id)],scope.conversation,scope.condition,scope.params);if(work.phase==='data'){const f=await fenceService(c);let statements=await f.invalidate();if(work.kind==='member')statements.push(inheritPriorBlobs(id,work.target))
  if(['message','imported-message'].includes(work.kind)&&await eraseRetainedBody(c,work,f,statements)){await drainBlobs(c.env,id);if(!quiet)await c.hint();return receipt(c,id)}
  if(work.kind==='imported-message'){if(!await importedStep(c,work,f))throw Error('Imported message changed');await drainBlobs(c.env,id);if(!quiet)await c.hint();return receipt(c,id)}
  if(work.kind==='imported-author'){if(await importedStep(c,work,f)){await drainBlobs(c.env,id);if(!quiet)await c.hint();return receipt(c,id)}statements.push(sql("UPDATE nook_erasure_work SET phase='blobs' WHERE operation=?",id))}
  else if(work.kind==='member'){
   const rows=await c.rows('SELECT id FROM nook_messages WHERE author=? LIMIT 30',[work.target]);
   if(rows.length)statements.push(...await messages(c,f,id,rows.map(r=>r.id),work.member_bodies==='retain'))
   else{
    const attachments=await c.rows('SELECT id FROM nook_attachments WHERE author=? AND NOT EXISTS(SELECT 1 FROM nook_import_files WHERE attachment=nook_attachments.id) LIMIT 30',[work.target]);
    if(attachments.length)statements.push(...await files(c,f,id,'id IN (SELECT value FROM json_each(?))',[JSON.stringify(attachments.map(r=>r.id))]))
    else if(await importedStep(c,work,f)){await drainBlobs(c.env,id);if(!quiet)await c.hint();return receipt(c,id)}
    else if(await c.one('SELECT 1 FROM nook_outcomes WHERE author=? LIMIT 1',[work.target]))statements.push(...await outcomes(c,f,work.target))
    else{const scheduled=await eraseScheduleFiles(c,f,id,'schedule.user=?',[work.target]);if(scheduled.count)statements.push(...scheduled.statements);else{await retireDoorIdentity(c,work,f);statements.push(...await identity(c,f,work.target),sql("UPDATE nook_erasure_work SET phase='blobs' WHERE operation=?",id))}}
   }
  }else{
   if(work.kind==='attachment')statements.push(...(await eraseScheduleFiles(c,f,id,'file.attachment=?',[work.target])).statements)
   statements.push(...(work.kind==='message'?await messages(c,f,id,[work.target]):await files(c,f,id,'id=?',[work.target])),sql("UPDATE nook_erasure_work SET phase='blobs' WHERE operation=?",id))
  }
  await c.batch(statements.map(s=>c.sql(s.sql,...s.params)),scope.conversation,scope.condition,scope.params)
 }}
 await drainBlobs(c.env,id);if(!quiet)await c.hint();return receipt(c,id)
}
