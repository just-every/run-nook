import {memberMessageBodies,priorDeletionScope} from './policy'
import type {Context} from '../../platform/storage/context'
import {authorize,authorizeWork} from './authorization'
import {retained} from './graph'
export async function preview(c:Context,kind:string,target:string){
 const prior=await c.one('SELECT w.*,r.counts FROM nook_erasure_work w JOIN nook_erasure_receipts r ON r.id=w.operation WHERE w.kind=? AND w.target=?',[kind,target]);if(prior){await authorizeWork(c,prior);return {kind,counts:JSON.parse(prior.counts),retained,memberMessageBodies:prior.member_bodies,priorDeletionScope:kind==='member'?priorDeletionScope:undefined}}
 const scope=await authorize(c,kind,target),bodyPolicy=kind==='member'?memberMessageBodies:'erase',cleanupScope=kind==='member'?priorDeletionScope:undefined
 if(kind==='imported-author'){const counts=await c.one("SELECT (SELECT count(*) FROM nook_import_records WHERE job=? AND source_actor=?) AS messages,(SELECT count(*) FROM nook_import_files f JOIN nook_import_records r ON r.id=f.message WHERE r.job=? AND r.source_actor=?) AS files,0 AS outcomes",[scope.row.job,scope.row.source_id,scope.row.job,scope.row.source_id]);return {kind,counts,retained,memberMessageBodies:bodyPolicy,priorDeletionScope:cleanupScope}}
 if(kind==='member'){const counts=await c.one(`SELECT
 (SELECT count(*) FROM nook_messages WHERE author=?)+(SELECT count(*) FROM nook_import_records r JOIN nook_import_actors a ON a.job=r.job AND a.source_id=r.source_actor WHERE a.association=?) AS messages,
 (SELECT count(*) FROM nook_attachments f WHERE (f.author=? AND NOT EXISTS(SELECT 1 FROM nook_import_files b WHERE b.attachment=f.id)) OR EXISTS(SELECT 1 FROM nook_import_files b JOIN nook_import_records r ON r.id=b.message JOIN nook_import_actors a ON a.job=r.job AND a.source_id=r.source_actor WHERE b.attachment=f.id AND a.association=?)) AS files,
 (SELECT count(*) FROM nook_outcomes WHERE author=?) AS outcomes`,[target,target,target,target,target]);return {kind,counts,retained,memberMessageBodies:bodyPolicy,priorDeletionScope:cleanupScope}}
 if(kind==='imported-message'){const counts=await c.one('SELECT 1 AS messages,(SELECT count(*) FROM nook_attachments WHERE message=?) AS files,0 AS outcomes',[target]);return {kind,counts,retained,memberMessageBodies:bodyPolicy,priorDeletionScope:cleanupScope}}
 const counts=await c.one(`SELECT
 (SELECT count(*) FROM nook_message_history WHERE ${kind==='member'?'author':'id'}=?) AS messages,
 (SELECT count(*) FROM nook_attachments WHERE ${kind==='member'?'author':kind==='message'?'message':'id'}=?) AS files,
 (SELECT count(*) FROM nook_outcomes WHERE author=? AND ?='member') AS outcomes`,[target,target,target,kind])
 return {kind,counts,retained,memberMessageBodies:bodyPolicy,priorDeletionScope:cleanupScope}
}
