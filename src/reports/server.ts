import {fail} from '../family/team-chat/domain'
import type {Context} from '../platform/storage/context'
import {fullMember} from '../team/access'
import {channelManager} from '../team/channel-policy'
import {permittedScope,publishedScope} from '../exit/policy'

const admin=(user:string)=>`EXISTS(SELECT 1 FROM oa_operators o WHERE o.id=${user} AND o.status='active' AND o.role IN ('owner','admin') AND ${fullMember('o.id')})`
const leader=(user:string)=>`EXISTS(SELECT 1 FROM oa_operators leader_operator WHERE leader_operator.id=${user} AND (${admin('leader_operator.id')} OR EXISTS(SELECT 1 FROM nook_conversations managed WHERE ${channelManager('managed.id')}=leader_operator.id)))`
const small=(value:number)=>value>0&&value<5?'fewer than 5':value
const csv=(value:unknown)=>'"'+String(value??'').replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"'
async function requireAdmin(c:Context){if(!await c.one(`SELECT 1 WHERE ${admin('?')}`,[c.uid]))fail(403,'Only owners and admins can read administration reports')}
function range(params:URLSearchParams){
 if([...params.keys()].some(key=>!['from','until','format','snapshot'].includes(key)))fail(400,'Unknown report filter')
 const until=params.get('until')??new Date().toISOString(),from=params.get('from')??new Date(Date.now()-30*86400000).toISOString()
 if(!Number.isFinite(Date.parse(from))||!Number.isFinite(Date.parse(until))||Date.parse(from)>Date.parse(until))fail(400,'Choose a valid report range')
 return {from:new Date(from).toISOString(),until:new Date(until).toISOString()}
}
// Only this aggregate may describe conversations the viewer cannot read. The
// threshold covers conversations, not outcomes, files or active days. Below it
// even zeroes and freshness timestamps are withheld to avoid subtraction leaks.
async function privateSummary(c:Context,filters:{from:string;until:string}){
 try{const [row]=await c.rows(`WITH hidden AS (
  SELECT pc.id FROM nook_conversations pc WHERE pc.kind<>'channel'
  AND ${publishedScope('pc.id')} AND NOT (${permittedScope('pc.id','?')})
 ), outcomes AS (
  SELECT o.kind,o.status FROM nook_outcome_history o LEFT JOIN nook_message_history m ON m.id=o.source
  WHERE o.erased=0 AND o.conversation IN (SELECT id FROM hidden)
  AND (m.created IS NULL OR m.created>=? AND m.created<=?)
 ) SELECT (SELECT count(*) FROM hidden) AS conversations,
 (SELECT count(*) FROM outcomes WHERE kind='commitment' AND status='accepted') AS accepted,
 (SELECT count(*) FROM outcomes WHERE kind='decision' AND status='recorded') AS decisions
 WHERE ${fullMember('?')} AND ${leader('?')}`,[c.uid,filters.from,filters.until,c.uid,c.uid])
 if(!row)return null
 return row.conversations<5?{suppressed:true,notice:'fewer than 5 private conversations'}:{suppressed:false,notice:'Anonymous private conversations',conversations:row.conversations,accepted:row.accepted,decisions:row.decisions}
 }catch{await c.check();return {suppressed:true,notice:'Private totals unavailable: storage-read-error'}}
}
export async function administration(c:Context,params:URLSearchParams){
 await requireAdmin(c)
 const filters=range(params),profile=await c.one('SELECT zone FROM nook_profiles WHERE user=?',[c.uid]),zone=profile?.zone??'UTC',computed=new Date().toISOString()
 const sections:any[]=[]
 const section=async(name:string,denominator:string,missing:string[],read:()=>Promise<{rows:any[];newest:string|number|null}>)=>{
  try{const data=await read();sections.push({name,denominator,computed,newest:data.newest,missing,state:missing.length?'incomplete':'complete',rows:data.rows})}
  catch{await requireAdmin(c);sections.push({name,denominator,computed,newest:null,missing:['storage-read-error'],state:'incomplete',rows:[]})}
 }
 // Each section reads through Context's public snapshot helper. Its current
 // administrative predicate is part of every query, not a cached role check.
 const rows=(sql:string,values:any[]=[])=>c.rows(`SELECT * FROM (${sql}) WHERE ${admin('?')}`,[...values,c.uid])
 await section('Membership','All active workspace accounts',['Account creation timestamps are not recorded; inventory is current, not historical.'],async()=>({newest:null,rows:(await rows("SELECT a.mode AS label,count(*) AS value FROM nook_access a JOIN oa_operators o ON o.id=a.user WHERE a.active=1 AND o.status='active' GROUP BY a.mode")).map(r=>({...r,value:small(r.value)}))}))
 await section('Approved apps','All current approval and token rows',[],async()=>({newest:null,rows:(await rows("SELECT 'Integration tokens' AS label,count(*) AS value FROM nook_integration_tokens WHERE state='active' UNION ALL SELECT 'Notification apps',count(*) FROM nook_notification_apps WHERE state='active'")).map(r=>({...r,value:small(r.value)}))}))
 await section('Channels','Currently readable conversations; unreadable private scopes appear only in the anonymous summary',['Original channel creation times are not recorded; new-channel growth is unavailable.'],async()=>({newest:null,rows:await rows(`SELECT CASE WHEN c.kind='channel' THEN 'Readable public channels' ELSE 'Readable private conversations' END AS label,count(*) AS value,sum(COALESCE(s.archived,0)) AS archived FROM nook_conversations c LEFT JOIN nook_channel_settings s ON s.conversation=c.id WHERE ${permittedScope('c.id','?')} GROUP BY c.kind='channel'`,[c.uid])}))
 await section('Activity','Native messages in currently readable conversations in the selected range; active conversation count per day',['Imported message volume is not included.'],async()=>{
  const source=await rows(`SELECT conversation,substr(created,1,16)||':00Z' AS minute,max(created) AS newest,count(*) AS value FROM nook_message_history WHERE deleted=0 AND created>=? AND created<=? AND ${permittedScope('nook_message_history.conversation','?')} GROUP BY conversation,substr(created,1,16)`,[filters.from,filters.until,c.uid]),days=new Map<string,{messages:number;conversations:Set<string>}>()
  for(const r of source){const day=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(r.minute));const bucket=days.get(day)??{messages:0,conversations:new Set<string>()};bucket.messages+=r.value;bucket.conversations.add(r.conversation);days.set(day,bucket)}
  const scopes=await rows(`SELECT count(DISTINCT conversation) AS n FROM nook_message_history WHERE deleted=0 AND created>=? AND created<=? AND ${permittedScope('nook_message_history.conversation','?')}`,[filters.from,filters.until,c.uid])
  return {newest:source.map(r=>r.newest).sort().at(-1)??null,rows:[{label:'Active conversations',value:small(scopes[0].n)},...[...days].map(([label,value])=>({label,value:value.conversations.size<5?'fewer than 5 conversations':value.messages,active:small(value.conversations.size)}))]}
 })
 await section('Stored files','Currently readable non-deleted attachment metadata; bytes declared by staged/attached files',[],async()=>{const [r]=await rows(`SELECT count(*) AS files,COALESCE(sum(size),0) AS bytes,max(created) AS newest FROM nook_attachments WHERE state IN ('staged','attached') AND ${permittedScope('nook_attachments.conversation','?')}`,[c.uid]);return {newest:r.newest,rows:[{label:'Files',value:small(r.files)},{label:'Stored bytes',value:r.bytes}]}})
 await section('Notification delivery','Retained email/push queue and routing records for currently readable conversations in range',['Queue retention limits historical coverage; provider acceptance does not prove device display.'],async()=>{
  const data=await rows(`WITH records AS (SELECT id,conversation,channel,state,error,held_at,released_at,created,updated FROM nook_notify_queue UNION ALL SELECT id,conversation,'push',state,error,held_at,released_at,created,updated FROM nook_push_delivery_records r WHERE NOT EXISTS(SELECT 1 FROM nook_notify_queue q WHERE q.id=r.id)) SELECT channel,CASE WHEN state IN ('sent','folded') THEN 'delivered to provider' WHEN held_at IS NOT NULL AND released_at IS NULL AND state IN ('pending','sending','retrying') THEN 'held' WHEN state='cancelled' THEN 'suppressed or cancelled' WHEN state IN ('failed','retrying') THEN 'failed or retrying' ELSE 'pending' END AS class,count(*) AS value,max(updated) AS newest FROM records WHERE created>=? AND created<=? AND ${permittedScope('records.conversation','?')} GROUP BY channel,class`,[Date.parse(filters.from),Date.parse(filters.until),c.uid])
  return {newest:data.map(r=>r.newest).sort((a,b)=>a-b).at(-1)??null,rows:data.map(r=>({label:r.channel+' · '+r.class,value:small(r.value)}))}
 })
 await section('Connector health','Import jobs owned by this viewer in the selected range',['Import jobs describe local import progress, not connector synchronization.'],async()=>{const data=await rows('SELECT state AS label,count(*) AS value,max(created) AS newest FROM nook_imports WHERE created>=? AND created<=? AND owner=? GROUP BY state',[filters.from,filters.until,c.uid]);return {newest:data.map(r=>r.newest).sort().at(-1)??null,rows:data.map(r=>({label:r.label,value:small(r.value)}))}})
 await section('Registered devices','Current registered push devices',['Client health beyond registered devices: NOOK-021 is not built.'],async()=>({newest:null,rows:(await rows("SELECT 'Registered push devices' AS label,count(*) AS value FROM nook_push_devices")).map(r=>({...r,value:small(r.value)}))}))
 for(const [name,clause] of [['Retention jobs','NOOK-038'],['Failed workflows','NOOK-026'],['Connector synchronization','NOOK-025/027']])sections.push({name,denominator:'not available',computed,newest:null,rows:[],state:'unavailable',missing:[`not available: ${clause} is not built`]})
 await requireAdmin(c)
 return {kind:'administration',filters,zone,zoneSource:profile?'viewer profile':'installation default (UTC)',computed,sections,privateSummary:await privateSummary(c,filters)}
}
export async function commitments(c:Context,params:URLSearchParams){
 const filters=range(params),profile=await c.one('SELECT zone FROM nook_profiles WHERE user=?',[c.uid]),zone=profile?.zone??'UTC'
 const eligible=await c.one(`SELECT 1 WHERE ${fullMember('?')} AND ${leader('?')}`,[c.uid,c.uid])
 const rows=eligible?await c.rows(`SELECT o.id,o.conversation,c.name AS channel,o.kind,o.body AS label,o.status,o.deadline,o.source,m.created FROM nook_outcome_history o JOIN nook_conversations c ON c.id=o.conversation LEFT JOIN nook_message_history m ON m.id=o.source WHERE o.erased=0 AND (o.kind='commitment' AND o.status='accepted' OR o.kind='decision' AND o.status='recorded') AND ${permittedScope('o.conversation','?')} AND ${fullMember('?')} AND ${leader('?')} AND (m.created IS NULL OR m.created>=? AND m.created<=?) ORDER BY o.id`,[c.uid,c.uid,c.uid,filters.from,filters.until]):[]
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
 const hidden=eligible?await privateSummary(c,filters):null
 const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([rows,hidden]))))
 const snapshot=Array.from(digest,byte=>byte.toString(16).padStart(2,'0')).join('')
 return {snapshot,privateSummary:hidden,kind:'commitments',filters,zone,computed:new Date().toISOString(),reason:eligible?null:'Only full-member channel managers, owners and admins have a commitments report.',missing:['Blocked commitments have no recorded state.','Decisions have no separate resolution state; recorded decisions are listed.','Outcomes without a dated source are included and marked undated.'],denominator:rows.length,accepted:rows.filter(r=>r.kind==='commitment').length,overdue:rows.filter(r=>r.kind==='commitment'&&r.deadline&&r.deadline<today).length,rows:rows.map(r=>({...r,overdue:r.kind==='commitment'&&!!r.deadline&&r.deadline<today,href:'/app?conversation='+encodeURIComponent(r.conversation)+'&focus='+encodeURIComponent(r.source??'')}))}
}
export async function reportsRoute(c:Context,request:Request):Promise<Response|null>{
 const url=new URL(request.url),kind=url.pathname==='/api/reports/administration'?'administration':url.pathname==='/api/reports/commitments'?'commitments':null
 if(!kind)return null
 if(request.method!=='GET')fail(405,'Reports are read-only')
 const format=url.searchParams.get('format')??'json';if(!['json','csv'].includes(format))fail(400,'Choose JSON or CSV')
 if(format==='csv'&&kind!=='commitments')fail(400,'CSV is available for the commitments rows')
 const report=kind==='administration'?await administration(c,url.searchParams):await commitments(c,url.searchParams)
 const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}
 if(format==='json')return Response.json(report,{headers})
 const data=report as Awaited<ReturnType<typeof commitments>>
 if(url.searchParams.get('snapshot')!==data.snapshot)fail(409,'Report rows changed. Refresh the report before exporting.')
 const text=[['Range from',data.filters.from],['Range until',data.filters.until],['Time zone',data.zone],['Filters','accepted commitments; recorded decisions; current readable conversations'],...(data.privateSummary?[['Private conversations',data.privateSummary.notice],...('conversations'in data.privateSummary?[['Anonymous conversations',data.privateSummary.conversations],['Anonymous accepted commitments',data.privateSummary.accepted],['Anonymous recorded decisions',data.privateSummary.decisions]]:[])]:[]),['id','channel','kind','label','status','deadline','source','href'],...data.rows.map(r=>[r.id,r.channel,r.kind,r.label,r.status,r.deadline,r.source,r.href])].map(row=>row.map(csv).join(',')).join('\r\n')+'\r\n'
 await c.batch([c.sql("INSERT INTO nook_audit VALUES(?,?, 'reports',?,'report.export','workspace',1,'Commitments CSV','confirmed',?)",crypto.randomUUID(),c.uid,Date.now(),data.rows.length)],undefined,`${fullMember('?')} AND ${leader('?')} AND NOT EXISTS(SELECT 1 FROM json_each(?) item WHERE NOT (${permittedScope("json_extract(item.value,'$.conversation')",'?')}))`,[c.uid,c.uid,JSON.stringify(data.rows),c.uid])
 return new Response(text,{headers:{...headers,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="nook-commitments.csv"'}})
}
