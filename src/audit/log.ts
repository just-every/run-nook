import type {Context} from '../platform/storage/context'
import {fail} from '../family/team-chat/domain'
import {fullMember} from '../team/access'
// NOOK-051 read model: rows the doors append to nook_audit since migration 0071,
// plus the body-free history every earlier door already kept in its own tables.
// Nothing here copies a message body, email address, token value or other secret.
const ms=(value:string)=>`CAST(unixepoch(${value},'subsec')*1000 AS INTEGER)`
const scopeKind=(conversation:string)=>`(SELECT CASE kind WHEN 'dm' THEN 'dm' WHEN 'private' THEN 'private' ELSE 'channel' END FROM nook_conversations WHERE id=${conversation})`
const now=`CAST(unixepoch('subsec')*1000 AS INTEGER)`
const latest=(column:string)=>`(SELECT s.${column} FROM nook_audit s WHERE s.settles=a.id ORDER BY s.at DESC,s.id DESC LIMIT 1)`
const unrecorded=(id:string)=>`NOT EXISTS(SELECT 1 FROM nook_audit x WHERE x.id=${id})`
// Every arm yields: id, at, actor, service, kind, scope_kind, scope, version, reason, outcome, subject, detail.
const arms=[
 `SELECT a.id AS id,a.at AS at,a.actor AS actor,a.service AS service,a.kind AS kind,a.scope_kind AS scope_kind,a.scope AS scope,a.version AS version,COALESCE(${latest('reason')},a.reason) AS reason,CASE WHEN a.kind LIKE 'erasure.%' THEN COALESCE((SELECT CASE r.state WHEN 'complete' THEN 'confirmed' ELSE 'uncertain' END FROM nook_erasure_receipts r WHERE r.id=a.id),a.outcome) ELSE COALESCE(${latest('outcome')},a.outcome) END AS outcome,a.subject AS subject,a.detail AS detail FROM nook_audit a WHERE a.settles IS NULL`,
 // History recorded before migration 0071 carries forward from its own tables.
 `SELECT r.id,r.created,NULL,'erasure','erasure.'||r.kind,'workspace',NULL,NULL,'erasure recorded before the audit log',CASE r.state WHEN 'complete' THEN 'confirmed' ELSE 'uncertain' END,NULL,r.counts FROM nook_erasure_receipts r WHERE ${unrecorded('r.id')}`,
 `SELECT j.id,${ms('j.created')},j.owner,NULL,'export.readable',CASE WHEN j.workspace_policy_version IS NULL THEN 'person' ELSE 'workspace' END,CASE WHEN j.workspace_policy_version IS NULL THEN j.owner END,j.workspace_policy_version,CASE j.state WHEN 'complete' THEN 'every page assembled' WHEN 'cancelled' THEN 'cancelled before completion' ELSE 'started; completion not confirmed' END,CASE j.state WHEN 'complete' THEN 'confirmed' WHEN 'cancelled' THEN 'failed' ELSE 'uncertain' END,NULL,json_object('scope',CASE WHEN j.workspace_policy_version IS NULL THEN j.scope ELSE 'workspace' END) FROM nook_exit_jobs j WHERE ${unrecorded('j.id')}`,
 `SELECT p.id,p.prepared_at,p.issuer,NULL,'invitation.prepare','workspace',NULL,p.generation,CASE p.state WHEN 'cancelled' THEN 'prepared, later cancelled' WHEN 'accepted' THEN 'prepared, later accepted' ELSE 'prepared' END,'confirmed',NULL,json_object('role',p.role,'mode',p.mode,'channels',json_array_length(p.scopes)) FROM nook_invite_plans p WHERE ${unrecorded('p.id')}`,
 `SELECT m.id,${ms('m.created')},m.author,NULL,'message.override',${scopeKind('m.conversation')},m.conversation,NULL,'posted with the labelled admin override','confirmed',NULL,json_object('reply',m.parent IS NOT NULL) FROM nook_messages m WHERE m.payload LIKE '%adminOverride%' AND json_valid(m.payload) AND json_extract(m.payload,'$.adminOverride')=1 AND ${unrecorded('m.id')}`,
 `SELECT 'channel:'||a.id,${ms('a.created')},a.actor,CASE WHEN a.action='vacate' THEN 'channel management' END,CASE WHEN p.action IS NULL THEN 'channel.'||a.action ELSE 'posting.change' END,${scopeKind('a.conversation')},a.conversation,a.version,CASE WHEN p.action IS NULL THEN a.action ELSE 'posting '||p.level||', replies '||p.replies END,'confirmed',a.subject,CASE WHEN p.action IS NULL THEN '{}' ELSE json_object('level',p.level,'replies',p.replies,'people',p.people) END FROM nook_channel_actions a LEFT JOIN nook_posting_changes p ON p.action=a.id`,
 `SELECT 'defaults:'||d.id,${ms('d.created')},d.actor,NULL,'policy.default-channels',${scopeKind('d.conversation')},d.conversation,d.version,CASE WHEN d.enabled=0 THEN 'removed from default channels' WHEN d.mandatory=1 THEN 'mandatory default channel' ELSE 'default channel' END,'confirmed',NULL,json_object('enabled',d.enabled,'mandatory',d.mandatory) FROM nook_default_actions d`,
 `SELECT 'broadcast:'||b.id,${ms('b.created')},b.actor,NULL,'policy.broadcast',CASE WHEN b.scope='' THEN 'workspace' ELSE ${scopeKind('b.scope')} END,NULLIF(b.scope,''),b.version,'channel-wide mentions: '||b.level,'confirmed',NULL,json_object('level',b.level,'people',b.people) FROM nook_broadcast_actions b`,
 `SELECT 'export-policy:'||e.id,${ms('e.created')},e.actor,NULL,'policy.export','workspace',NULL,e.version,CASE WHEN e.enabled=1 THEN 'workspace export enabled' ELSE 'workspace export disabled' END,'confirmed',NULL,json_object('enabled',e.enabled,'recipients',e.recipients) FROM nook_exit_policy_actions e`,
 `SELECT 'profile-fields:'||f.id,f.created,f.actor,NULL,'policy.profile-fields','workspace',NULL,NULL,'profile fields changed','confirmed',NULL,json_object('fields',f.fields) FROM nook_profile_field_actions f`,
 `SELECT 'token:'||i.id,i.at,i.actor,CASE WHEN i.action IN ('post','replay','refuse') THEN 'integration token' END,'token.'||i.action,CASE WHEN i.conversation IS NULL THEN 'workspace' ELSE COALESCE(${scopeKind('i.conversation')},'channel') END,i.conversation,NULL,CASE WHEN i.code IS NULL THEN i.action ELSE i.code END,CASE WHEN i.action='refuse' THEN 'failed' ELSE 'confirmed' END,NULL,json_object('token',i.name) FROM nook_integration_audit i`,
 `SELECT 'import:'||j.id,${ms('j.created')},j.owner,NULL,'import.history','workspace',NULL,NULL,CASE j.state WHEN 'complete' THEN 'history published' ELSE 'staging; not published' END,CASE j.state WHEN 'complete' THEN 'confirmed' ELSE 'uncertain' END,NULL,'{}' FROM nook_imports j`,
 `SELECT 'conversion:'||g.id,${ms('g.created')},g.actor,NULL,'channel.convert',${scopeKind('g.destination')},g.destination,NULL,'group conversation converted to a private channel','confirmed',NULL,json_object('from','a direct conversation') FROM nook_group_conversions g`,
 `SELECT 'membership:'||m.seq,${ms('m.at')},NULL,'membership record','membership.'||m.action,k.kind,m.conversation,NULL,CASE m.action WHEN 'join' THEN 'joined' ELSE 'left or removed' END,'confirmed',m.user,'{}' FROM nook_exit_membership m JOIN nook_conversations k ON k.id=m.conversation AND k.kind<>'dm' WHERE m.action<>'baseline'`,
 // Base's sign-in records are read in place and never edited here.
 `SELECT 'session-start:'||s.id,s.created_at,s.operator_id,NULL,'session.start','person',s.operator_id,s.operator_version,'signed in','confirmed',s.operator_id,json_object('method',s.kind) FROM oa_sessions s`,
 `SELECT 'session-end:'||s.id,s.revoked_at,NULL,'sign-in','session.end','person',s.operator_id,s.operator_version,'signed out or session revoked','confirmed',s.operator_id,json_object('method',s.kind) FROM oa_sessions s WHERE s.revoked_at IS NOT NULL`,
 `SELECT 'invitation-link:'||t.id,t.created_at,t.issuer_id,NULL,'invitation.send','person',t.operator_id,t.operator_version,CASE WHEN t.consumed_at IS NOT NULL THEN 'accepted' WHEN t.revoked_at IS NOT NULL THEN 'revoked' WHEN t.expires_at<=${now} THEN 'expired unused' ELSE 'awaiting acceptance' END,CASE WHEN t.consumed_at IS NOT NULL THEN 'confirmed' WHEN t.revoked_at IS NOT NULL OR t.expires_at<=${now} THEN 'failed' ELSE 'uncertain' END,t.operator_id,'{}' FROM oa_tokens t WHERE t.kind='invite'`,
 `SELECT 'sign-in-policy:'||a.id,a.created_at,a.actor_id,NULL,'policy.sign-in','workspace',NULL,NULL,a.action,'confirmed',NULL,'{}' FROM oa_auth_audit a`,
]
// D1 limits compound SELECTs, so each arm is its own statement in one read batch.
const projection=(arm:string)=>`WITH e(id,at,actor,service,kind,scope_kind,scope,version,reason,outcome,subject,detail) AS (${arm}) SELECT e.*,act.name AS actorName,COALESCE(sub.name,sop.display_name) AS subjectName,k.name AS conversationName,COALESCE(per.name,pop.display_name) AS personName,EXISTS(SELECT 1 FROM nook_members vm WHERE vm.conversation=e.scope AND vm.user=?) AS viewerMember FROM e LEFT JOIN nook_actors act ON act.id=e.actor LEFT JOIN nook_actors sub ON sub.id=e.subject LEFT JOIN nook_conversations k ON k.id=e.scope AND e.scope_kind IN ('channel','private','dm') LEFT JOIN nook_actors per ON per.id=e.scope AND e.scope_kind='person' LEFT JOIN oa_operators sop ON sop.id=e.subject LEFT JOIN oa_operators pop ON pop.id=e.scope AND e.scope_kind='person'`
export const outcomes=['confirmed','failed','uncertain'] as const
// Owners and admins with full workspace access read the log (the owner alone when
// there is no admin). Members, guests and erased people never do.
const auditor=`EXISTS(SELECT 1 FROM oa_operators o WHERE o.id=? AND o.status='active' AND o.role IN ('owner','admin') AND ${fullMember('o.id')})`
async function requireAuditor(c:Context){
 if(!['owner','admin'].includes(c.session.operator.role))fail(403,'Only owners and admins read the audit log')
 await c.batch([],undefined,auditor,[c.uid])
}
export type AuditFilters={actor?:string;kind?:string;scope?:string;outcome?:string;from?:number;to?:number}
export function auditFilters(params:URLSearchParams):AuditFilters{
 const text=(name:string)=>{const value=params.get(name)?.trim();if(value&&value.length>128)fail(400,'Filter too long');return value||undefined}
 const time=(name:string)=>{const value=params.get(name);if(!value)return undefined;const at=/^\d+$/.test(value)?Number(value):Date.parse(value);if(!Number.isSafeInteger(at))fail(400,'Choose a valid time');return at}
 const filters={actor:text('actor'),kind:text('kind'),scope:text('scope'),outcome:text('outcome'),from:time('from'),to:time('to')}
 if(filters.outcome&&!outcomes.includes(filters.outcome as typeof outcomes[number]))fail(400,'Outcome is confirmed, failed or uncertain')
 return filters
}
type Row={id:string;at:number;actor:string|null;service:string|null;kind:string;scope_kind:string;scope:string|null;version:number|null;reason:string;outcome:string;subject:string|null;detail:string;actorName:string|null;subjectName:string|null;conversationName:string|null;personName:string|null;viewerMember:number}
export type AuditEntry={id:string;at:number;actor:string|null;actorName:string;kind:string;scopeKind:string;scope:string|null;scopeLabel:string;version:number|null;reason:string;outcome:string;subject:string|null;subjectName:string|null;detail:Record<string,unknown>}
function where(filters:AuditFilters,before?:{at:number;id:string}){
 const clauses:string[]=[],values:unknown[]=[]
 if(filters.actor){clauses.push('e.actor=?');values.push(filters.actor)}
 if(filters.kind){clauses.push("(e.kind=? OR e.kind LIKE ?||'.%')");values.push(filters.kind,filters.kind)}
 if(filters.scope){clauses.push('e.scope=?');values.push(filters.scope)}
 if(filters.outcome){clauses.push('e.outcome=?');values.push(filters.outcome)}
 if(filters.from!==undefined){clauses.push('e.at>=?');values.push(filters.from)}
 if(filters.to!==undefined){clauses.push('e.at<?');values.push(filters.to)}
 if(before){clauses.push('(e.at<? OR e.at=? AND e.id<?)');values.push(before.at,before.at,before.id)}
 return {sql:clauses.length?' WHERE '+clauses.join(' AND '):'',values}
}
// A person scope or subject is cleared only by erasure.
// A direct conversation is only ever "a direct conversation"; a private channel is
// named only to a viewer who belongs to it. Ids of either are withheld likewise.
function present(row:Row):AuditEntry{
 const hidden=row.scope_kind==='dm'||row.scope_kind==='private'&&!row.viewerMember
 const scopeLabel=row.scope_kind==='workspace'?'Workspace':row.scope_kind==='person'?(row.personName??'An erased person'):row.scope_kind==='dm'?'a direct conversation':hidden?'a private channel':row.conversationName?'#'+row.conversationName:'a removed conversation'
 // Every door records an actor or a service, so a row with neither lost its actor to erasure.
 const actorName=row.actorName??(row.actor||!row.service?'An erased person':row.service)
 return {id:row.id,at:row.at,actor:row.actorName?row.actor:null,actorName,kind:row.kind,scopeKind:row.scope_kind,scope:hidden?null:row.scope,scopeLabel,version:row.version,reason:row.reason,outcome:row.outcome,subject:row.subjectName?row.subject:null,subjectName:row.subjectName??(row.subject?'An erased person':null),detail:JSON.parse(row.detail||'{}')}
}
async function page(c:Context,filters:AuditFilters,limit:number,before?:{at:number;id:string}){
 const w=where(filters,before)
 const results=await c.db.batch<Row>(arms.map(arm=>c.sql(`${projection(arm)}${w.sql} ORDER BY e.at DESC,e.id DESC LIMIT ?`,c.uid,...w.values,limit)))
 return results.flatMap(r=>r.results).sort((a,b)=>b.at-a.at||(a.id<b.id?1:a.id>b.id?-1:0)).slice(0,limit).map(present)
}
const cursor=(value:string|null)=>{if(!value)return undefined;const at=Number(value.slice(0,value.indexOf(':'))),id=value.slice(value.indexOf(':')+1);if(!Number.isSafeInteger(at)||!id||id.length>256)fail(400,'Invalid audit cursor');return {at,id}}
export async function listAudit(c:Context,params:URLSearchParams){
 await requireAuditor(c)
 const items=await page(c,auditFilters(params),101,cursor(params.get('before')))
 const more=items.length>100,last=items[99]
 return {items:items.slice(0,100),cursor:more?`${last.at}:${last.id}`:null}
}
const columns=['time','actor','service','action','scope','version','reason','outcome','subject','detail'] as const
const csvCell=(value:unknown)=>{const text=value===null||value===undefined?'':String(value);return /[",\n\r]/.test(text)||/^[=+\-@\t]/.test(text)?`"${(/^[=+\-@\t]/.test(text)?"'":'')+text.replaceAll('"','""')}"`:text}
export const auditExportLimit=50000
export async function exportAudit(c:Context,params:URLSearchParams){
 await requireAuditor(c)
 const format=params.get('format')??'csv'
 if(!['csv','json'].includes(format))fail(400,'Export format is csv or json')
 const filters=auditFilters(params),items:AuditEntry[]=[]
 for(let before:{at:number;id:string}|undefined;;){
  const next=await page(c,filters,1000,before);items.push(...next)
  if(items.length>auditExportLimit)fail(413,'More than 50,000 entries match; narrow the time range')
  if(next.length<1000)break
  before={at:next.at(-1)!.at,id:next.at(-1)!.id}
 }
 const name=`nook-audit-${new Date().toISOString().slice(0,10)}.${format}`,headers={'Content-Disposition':`attachment; filename="${name}"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}
 if(format==='json')return new Response(JSON.stringify({format:'nook-audit',version:1,filters,entries:items},null,1),{headers:{...headers,'Content-Type':'application/json; charset=utf-8'}})
 const lines=[columns.join(','),...items.map(e=>[new Date(e.at).toISOString(),e.actorName,e.actor?'':e.actorName,e.kind,e.scopeLabel,e.version,e.reason,e.outcome,e.subjectName,JSON.stringify(e.detail)].map(csvCell).join(','))]
 return new Response(lines.join('\r\n')+'\r\n',{headers:{...headers,'Content-Type':'text/csv; charset=utf-8'}})
}
export async function auditRoute(c:Context,request:Request):Promise<Response|null>{
 const url=new URL(request.url)
 if(url.pathname!=='/api/audit'&&url.pathname!=='/api/audit/export')return null
 if(request.method!=='GET')fail(405,'The audit log is read-only')
 if(url.pathname==='/api/audit/export')return exportAudit(c,url.searchParams)
 return Response.json(await listAudit(c,url.searchParams),{headers:{'Cache-Control':'no-store'}})
}
