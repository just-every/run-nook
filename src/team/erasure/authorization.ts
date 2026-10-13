import {operatorChannelMessageErasure,protectEveryOwnerFromErasure} from './policy'
import {fail,text} from '../../family/team-chat/domain'
import {fullMember} from '../access'
import type {Context} from '../../platform/storage/context'
export const manager=`EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND status='active' AND role IN ('owner','admin')) AND ${fullMember('?')}`
const importAccess=`NOT EXISTS(SELECT 1 FROM nook_import_records r WHERE r.job||':'||r.source_actor=? AND NOT EXISTS(SELECT 1 FROM nook_members m JOIN nook_conversations v ON v.id=m.conversation WHERE m.conversation=r.conversation AND m.user=? AND v.kind<>'dm'))`
export async function authorize(c:Context,kind:string,target:string,author=false){
 await c.check();target=text(target,128)
 if(kind==='imported-author'){
  if(!await c.one(`SELECT 1 WHERE ${manager} AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner')`,[c.uid,c.uid,c.uid]))fail(403,'Only an owner can erase imported authors')
  const row=await c.one("SELECT a.*,j.owner FROM nook_import_actors a JOIN nook_imports j ON j.id=a.job WHERE a.job||':'||a.source_id=?",[target])??await c.one("SELECT r.domain_job AS job,json_extract(a.value,'$.sourceId') AS source_id,json_extract(a.value,'$.association') AS association,'{}' AS source_record,r.owner FROM nook_import_reviews r,json_each(r.summary_json,'$.actors') a WHERE r.domain_job||':'||json_extract(a.value,'$.sourceId')=? AND r.owner=? AND r.state='reviewed' AND NOT EXISTS(SELECT 1 FROM ik_jobs k WHERE k.operation_key=r.id AND k.principal_id=r.owner)",[target,c.uid]);if(!row)fail(404,'Imported author unavailable')
  if(!await c.one(`SELECT 1 WHERE ${importAccess}`,[target,c.uid]))fail(403,'Imported channel access denied')
  return {row:{...row,author:row.owner},conversation:undefined,condition:`${manager} AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner') AND ${importAccess}`,params:[c.uid,c.uid,c.uid,target,c.uid]}
 }
 if(kind==='member'){
  if(!await c.one(`SELECT 1 WHERE ${manager}`,[c.uid,c.uid]))fail(403,'Only owners and admins can erase eligible teammates')
  const row=await c.one('SELECT * FROM oa_operators WHERE id=?',[target]);if(!row)fail(404,'Teammate unavailable')
  if(protectEveryOwnerFromErasure&&row.role==='owner')fail(403,'Transfer or demote this owner before erasure')
  if(target===c.uid)fail(403,'You cannot erase yourself')
  if(c.session.operator.role!=='owner'&&row.role!=='member')fail(403,'Only an owner can erase privileged teammates')
  if(row.role==='owner'&&row.status==='active'&&(await c.one("SELECT count(*) AS n FROM oa_operators WHERE role='owner' AND status='active'")).n<=1)fail(403,'The last active owner cannot be erased')
  return {row,conversation:undefined,condition:`${manager} AND ?<>? AND EXISTS(SELECT 1 FROM oa_operators t JOIN oa_operators a ON a.id=? WHERE t.id=? AND (${protectEveryOwnerFromErasure?"t.role<>'owner'":'1'}) AND (a.role='owner' OR t.role='member') AND (t.role<>'owner' OR t.status<>'active' OR (SELECT count(*) FROM oa_operators WHERE role='owner' AND status='active')>1))`,params:[c.uid,c.uid,target,c.uid,c.uid,target]}
 }
 if(!['message','imported-message','attachment'].includes(kind))fail(400,'Invalid erasure kind')
 if(!author&&kind!=='attachment'&&!operatorChannelMessageErasure)fail(403,'Use author deletion')
 const table=kind==='message'?'nook_message_history':kind==='imported-message'?'nook_import_history':'nook_attachments',row=await c.one(kind==='imported-message'?`SELECT x.*,j.owner AS author,v.kind AS conversationKind FROM nook_import_history x JOIN nook_imports j ON j.id=x.job JOIN nook_conversations v ON v.id=x.conversation WHERE x.id=?`:`SELECT x.*,v.kind AS conversationKind FROM ${table} x JOIN nook_conversations v ON v.id=x.conversation WHERE x.id=?`,[target]);if(!row||row.erased&&!row.retained_body)fail(404,'Content unavailable')
 await c.check(row.conversation)
 if(kind==='attachment'||author){if(row.erased||row.author!==c.uid)fail(403,'Only the author may delete this content')}
 else if(row.conversationKind==='dm'||!await c.one(`SELECT 1 WHERE ${manager}`,[c.uid,c.uid]))fail(403,'Operators may erase messages only in accessible channels')
 return {row,conversation:row.conversation,condition:`EXISTS(SELECT 1 FROM ${table} WHERE id=?${kind==='imported-message'?'':' AND author=?'}${kind==='message'?' AND version=?':''})${author||kind==='attachment'?' AND ?=?':` AND ${manager} AND EXISTS(SELECT 1 FROM nook_conversations WHERE id=? AND kind<>'dm')`}`,params:[target,...(kind==='imported-message'?[]:[row.author]),...(kind==='message'?[row.version]:[]),...(author||kind==='attachment'?[row.author,c.uid]:[c.uid,c.uid,row.conversation])]}
}

export async function authorizeWork(c:Context,work:any){
 await c.check(work.conversation??undefined)
 const expected=work.own?'author':work.kind==='member'?'member-manager':work.kind==='imported-author'?'import-owner':'channel-operator'
 if(work.authority_class!==expected)fail(403,'Recorded erasure authority unavailable')
 if(work.kind==='member'&&protectEveryOwnerFromErasure&&(await c.one('SELECT role FROM oa_operators WHERE id=?',[work.target]))?.role==='owner')fail(403,'Transfer or demote this owner before resuming erasure')
 if(work.kind==='imported-author'){const condition=`${manager} AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner') AND ${importAccess}`,params=[c.uid,c.uid,c.uid,work.target,c.uid];if(!await c.one(`SELECT 1 WHERE ${condition}`,params))fail(403,'Current owner and channel access are required to resume imported-author erasure');return {conversation:undefined,condition,params}}
 const ownerGuard=work.kind==='member'&&protectEveryOwnerFromErasure?" AND NOT EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner')":''
 const condition=(work.own?`?=?`:`${manager}${work.kind==='member'?" AND EXISTS(SELECT 1 FROM oa_operators a WHERE a.id=? AND (a.role='owner' OR ?='member' AND NOT EXISTS(SELECT 1 FROM oa_operators t WHERE t.id=? AND t.role<>'member')))":" AND EXISTS(SELECT 1 FROM nook_conversations WHERE id=? AND kind<>'dm')"}`)+ownerGuard
 const params=work.own?[work.author,c.uid]:[c.uid,c.uid,...(work.kind==='member'?[c.uid,work.target_role,work.target]:[work.conversation]),...(ownerGuard?[work.target]:[])]
 if(!await c.one(`SELECT 1 WHERE ${condition}`,params))fail(403,'Current authority cannot resume this erasure')
 return {conversation:work.conversation??undefined,condition,params}
}
