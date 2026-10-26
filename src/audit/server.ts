import type {Context} from '../platform/storage/context'
import {authority} from '../platform/storage/context'
import {fail} from '../family/team-chat/domain'
const manager=`EXISTS(SELECT 1 FROM oa_operators o JOIN nook_access access ON access.user=o.id WHERE o.id=? AND o.status='active' AND o.role IN ('owner','admin') AND access.active=1 AND access.mode='member')`
const projection=`SELECT l.id,l.actor,COALESCE(a.name,CASE WHEN l.actor IS NULL THEN 'System' ELSE 'Former member' END) AS actorName,l.service,l.at,l.kind,CASE WHEN c.kind='dm' THEN 'a direct conversation' WHEN c.id IS NOT NULL THEN c.name WHEN l.scope='workspace' THEN 'workspace' ELSE 'Unavailable scope' END AS scope,l.version,l.reason,l.outcome,l.count FROM nook_audit_log l LEFT JOIN nook_actors a ON a.id=l.actor LEFT JOIN nook_conversations c ON c.id=l.scope`
const allowed=['actor','kind','scope','outcome','from','until','cursor','format']
function filters(params:URLSearchParams){
 if([...params.keys()].some(key=>!allowed.includes(key)))fail(400,'Unknown audit filter')
 const terms:string[]=[],values:any[]=[]
 for(const key of ['actor','kind','scope','outcome']){
  const value=params.get(key);if(!value)continue
  if(value.length>256)fail(400,'Audit filter is too long')
  if(key==='outcome'&&!['confirmed','failed','uncertain'].includes(value))fail(400,'Choose an audit outcome')
  if(key==='actor'){terms.push(value==='anonymous'?'l.actor IS NULL':'(l.actor=? OR a.name=?)');if(value!=='anonymous')values.push(value,value)}
  else if(key==='scope'){terms.push("(l.scope=? OR (CASE WHEN c.kind='dm' THEN 'a direct conversation' ELSE c.name END)=?)");values.push(value,value)}
  else {terms.push('l.'+key+'=?');values.push(value)}
 }
 for(const key of ['from','until']){const value=params.get(key);if(!value)continue;const at=Date.parse(value);if(!Number.isFinite(at))fail(400,'Choose a valid audit time');terms.push('l.at'+(key==='from'?'>=':'<=')+'?');values.push(at)}
 const cursor=params.get('cursor');if(cursor){let point;try{point=JSON.parse(cursor)}catch{fail(400,'Invalid audit cursor')};if(!Array.isArray(point)||point.length!==2||!Number.isSafeInteger(point[0])||typeof point[1]!=='string'||point[1].length>512)fail(400,'Invalid audit cursor');terms.push('(l.at<? OR (l.at=? AND l.id<?))');values.push(point[0],point[0],point[1])}
 return {where:terms.length?terms.join(' AND '):'1',values}
}
async function page(c:Context,params:URLSearchParams){
 const {where,values}=filters(params),guard=`${authority} AND ${c.fence} AND ${manager}`,credentials=[...c.credentials,c.uid]
 const [rows,access]=await c.db.batch([
  c.sql(`${projection} WHERE ${where} AND ${guard} ORDER BY l.at DESC,l.id DESC LIMIT 101`,...values,...credentials),
  c.sql(`SELECT 1 WHERE ${guard}`,...credentials),
 ])
 if(!access.results.length){await c.check();fail(403,'Only owners and admins can read the audit log')}
 const items=rows.results.slice(0,100),last=items.at(-1) as any
 return {items,cursor:rows.results.length>100?JSON.stringify([last.at,last.id]):null}
}
export async function auditRoute(c:Context,request:Request):Promise<Response|null>{
 const url=new URL(request.url);if(url.pathname!=='/api/team/audit')return null
 if(request.method!=='GET')fail(405,'Audit history is read-only')
 const format=url.searchParams.get('format')??'page'
 if(!['page','json','csv'].includes(format))fail(400,'Choose JSON or CSV')
 const first=await page(c,url.searchParams),headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}
 if(format==='page')return Response.json(first,{headers})
 const encoder=new TextEncoder(),fields=['id','actor','actorName','service','at','kind','scope','version','reason','outcome','count']
 // Formula-looking labels remain literal when opened in spreadsheet software.
 const csv=(value:any)=>'"'+String(value??'').replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"'
 let current=first,started=false,wrote=false
 const stream=new ReadableStream<Uint8Array>({async pull(controller){try{
  if(!started){started=true;controller.enqueue(encoder.encode(format==='json'?'{"format":"nook-admin-audit","version":1,"items":[':fields.join(',')+'\r\n'));return}
  const output=current.items.map((row:any)=>format==='json'?JSON.stringify(row):fields.map(key=>csv(row[key])).join(',')).join(format==='json'?',':'\r\n')
  if(output){controller.enqueue(encoder.encode((format==='json'&&wrote?',':'')+output+(format==='csv'?'\r\n':'')));wrote=true}
  if(current.cursor){const next=new URLSearchParams(url.searchParams);next.set('cursor',current.cursor);current=await page(c,next)}
  else {if(format==='json')controller.enqueue(encoder.encode(']}'));controller.close()}
 }catch(error){controller.error(error)}}})
 return new Response(stream,{headers:{...headers,'Content-Type':format==='json'?'application/json; charset=utf-8':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="nook-audit.${format}"`}})
}
