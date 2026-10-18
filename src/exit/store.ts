import {fail} from '../family/team-chat/domain'
import type {Context} from '../platform/storage/context'
import {custody,jobFence,omissions,permittedScope,scopeFence,revisionFence} from './policy'
import {currentOwner,exportPolicy} from './authority'
import {publishedScope} from './policy'
import {FORMAT,FORMAT_VERSION,type ExportJob,type ExportReport} from './types'

export async function ownJob(c:Context,id:string):Promise<ExportJob>{
 const row=await c.one<ExportJob>('SELECT * FROM nook_exit_jobs WHERE id=? AND owner=?',[id,c.uid])
 if(!row)fail(404,'Export unavailable')
 return row!
}
export async function assertJob(c:Context,id:string):Promise<ExportJob>{
 const job=await ownJob(c,id)
 const guard=await c.one<{access:number;fresh:number}>(`SELECT (${scopeFence}) AS access,(${revisionFence}) AS fresh FROM nook_exit_jobs ej WHERE ej.id=? AND ej.owner=?`,[id,c.uid])
 if(!guard?.access)fail(403,'Export scope is no longer available to you')
 if(!guard?.fresh)fail(409,'Export source changed. Start a new export so every page uses the same source revision.')
 return job
}
export async function createJob(c:Context,input:Record<string,any>){
 const scope=input.scope
 if(!['permitted','conversation','workspace'].includes(scope))fail(400,'Choose permitted conversations, one conversation or an authorized workspace export')
 const workspace=scope==='workspace',policy=workspace?await exportPolicy(c):null
 if(workspace&&(!policy!.canManage||!policy!.enabled))fail(403,'Workspace export requires a current owner and the explicitly enabled workspace export policy')
 if(scope==='conversation'&&(typeof input.conversationId!=='string'||!input.conversationId||input.conversationId.length>256))fail(400,'Choose a conversation')
 if(scope!=='conversation'&&input.conversationId!==undefined)fail(400,'A conversation ID requires conversation scope')
 if(input.custodyAccepted!==true)fail(400,'Acknowledge custody of the downloaded export')
 if(Object.keys(input).some(k=>!['scope','conversationId','custodyAccepted'].includes(k)))fail(400,'Unknown export option')
 const id=crypto.randomUUID(),created=new Date().toISOString(),conversation=scope==='conversation'?input.conversationId:undefined
 if(conversation)await c.check(conversation)
 await c.batch([
  c.sql(`INSERT INTO nook_exit_jobs(id,owner,scope,created,state,identity_revision,cursor_json,workspace_policy_version) SELECT ?,?,?,?,'running',revision,?,? FROM nook_exit_clock WHERE id=1`,id,c.uid,workspace?'permitted':scope,created,JSON.stringify({dataset:0,after:''}),policy?.version??null),
  workspace?c.sql(`INSERT INTO nook_exit_scopes(job,conversation,source_revision) SELECT ?,c.id,COALESCE(ec.revision,0) FROM nook_conversations c LEFT JOIN nook_exit_changes ec ON ec.conversation=c.id WHERE ${publishedScope('c.id')}`,id):c.sql(`INSERT INTO nook_exit_scopes(job,conversation,source_revision) SELECT ?,m.conversation,COALESCE(ec.revision,0) FROM nook_members m LEFT JOIN nook_exit_changes ec ON ec.conversation=m.conversation WHERE m.user=? AND ${permittedScope('m.conversation','m.user')}${conversation?' AND m.conversation=?':''}`,id,c.uid,...(conversation?[conversation]:[])),
 ],conversation,workspace?`${currentOwner('?')} AND EXISTS(SELECT 1 FROM nook_exit_policy WHERE id=1 AND enabled=1 AND version=?)`:conversation?`EXISTS(SELECT 1 FROM nook_members m WHERE m.conversation=? AND m.user=? AND ${permittedScope('m.conversation','m.user')})`:'1',workspace?[c.uid,policy!.version]:conversation?[conversation,c.uid]:[])
 return report(await assertJob(c,id))
}
export function report(job:ExportJob):ExportReport {
 return {format:FORMAT,version:FORMAT_VERSION,id:job.id,scope:job.workspace_policy_version!=null?'workspace':job.scope,created:job.created,state:job.state,
  ...(job.workspace_policy_version!=null?{workspacePolicyVersion:job.workspace_policy_version}:{}),pages:job.pages,records:job.records,files:job.files,bytes:job.bytes,sourceOmissions:job.omissions,
  counts:JSON.parse(job.counts_json),complete:job.state==='complete',omissions,custody}
}
export async function jobReport(c:Context,id:string){return report(await assertJob(c,id))}
export async function listJobs(c:Context,after=''){
 if(after.length>512)fail(400,'Invalid export cursor')
 // Enumeration has no conversation names or payload. Revoked/stale jobs remain
 // visible as unavailable so the member can understand and discard their work.
 const rows=await c.rows<ExportJob & {available:number;fresh:number}>(`SELECT ej.*,(${scopeFence}) AS available,(${revisionFence}) AS fresh FROM nook_exit_jobs ej WHERE ej.owner=? AND (?='' OR (ej.created||ej.id)<?) ORDER BY ej.created DESC,ej.id DESC LIMIT 21`,[c.uid,after,after])
 const items=rows.slice(0,20).map(job=>({...report(job),state:!job.available?'unavailable' as const:!job.fresh?'invalidated' as const:job.state,complete:!!job.available&&!!job.fresh&&job.state==='complete'}))
 return {items,hasMore:rows.length>20,cursor:rows.length>20?rows[19].created+rows[19].id:null}
}
export async function setJobState(c:Context,id:string,action:'cancel'|'resume'){
 const job=action==='cancel'?await ownJob(c,id):await assertJob(c,id)
 if(job.state==='complete')return report(await assertJob(c,id))
 // Cancellation wins against a concurrently finishing bounded step. Its update
 // is not tied to the revision loaded before that step committed. An already
 // completed job stays complete; a later stale step fails its running/CAS guard.
 await c.batch([c.sql("UPDATE nook_exit_jobs SET state=?,revision=revision+1 WHERE id=? AND owner=? AND state<>'complete'",action==='cancel'?'cancelled':'running',id,c.uid)],undefined,
  `EXISTS(SELECT 1 FROM nook_exit_jobs ej WHERE ej.id=? AND ej.owner=?${action==='resume'?' AND ej.revision=? AND '+jobFence:''})`,[id,c.uid,...(action==='resume'?[job.revision]:[])])
 return report(await ownJob(c,id))
}
export async function pageIndex(c:Context,id:string,after=-1){
 if(!Number.isSafeInteger(after)||after< -1)fail(400,'Invalid page index cursor')
 await assertJob(c,id)
 const rows=await c.rows(`SELECT p.ordinal,p.sha256,p.records FROM nook_exit_pages p JOIN nook_exit_jobs ej ON ej.id=p.job WHERE p.job=? AND ej.owner=? AND p.ordinal>? AND ${jobFence} ORDER BY p.ordinal LIMIT 101`,[id,c.uid,after])
 await assertJob(c,id)
 return {items:rows.slice(0,100),hasMore:rows.length>100,cursor:rows.length>100?rows[99].ordinal:null}
}
