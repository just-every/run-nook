import type {Context} from '../platform/storage/context'
import {fail} from '../family/team-chat/domain'
import {createJob,jobReport,listJobs,pageIndex,setJobState} from './store'
import {downloadPage,stepJob} from './pages'
import {exportPolicy,updateExportPolicy} from './authority'
import {fileBytes} from './files'

/** Mount inside the ordinary authenticated API boundary, after JSON parsing.
 * Uses that boundary's existing current Context and Origin checks. */
export async function readableExportRoute(c:Context,request:Request,input:Record<string,any>={}):Promise<Response|null>{
 const url=new URL(request.url),parts=url.pathname.split('/').filter(Boolean)
 if(parts[0]!=='api'||parts[1]!=='readable-exports')return null
 await c.check()
 if(request.method!=='GET'&&request.headers.get('origin')&&request.headers.get('origin')!==url.origin)fail(403,'Origin denied')
 const id=parts[2],action=parts[3],method=request.method
 let value:any
 if(parts.length===3&&id==='policy'&&method==='GET')value=await exportPolicy(c)
 else if(parts.length===3&&id==='policy'&&method==='POST')value=await updateExportPolicy(c,input)
 else if(parts.length===2&&method==='GET')value=await listJobs(c,url.searchParams.get('after')??'')
 else if(parts.length===2&&method==='POST')value=await createJob(c,input)
 else if(parts.length===3&&method==='GET')value=await jobReport(c,id)
 else if(parts.length===4&&method==='POST'&&action==='step')value=await stepJob(c,id)
 else if(parts.length===4&&method==='POST'&&(action==='cancel'||action==='resume'))value=await setJobState(c,id,action)
 else if(parts.length===4&&method==='GET'&&action==='index')value=await pageIndex(c,id,Number(url.searchParams.get('after')??-1))
 else if(parts.length===5&&method==='GET'&&action==='pages'){
  const page=await downloadPage(c,id,Number(parts[4]))
  return new Response(page.body,{headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Content-SHA256':page.sha256}})
 }else if(parts.length===5&&method==='GET'&&action==='files'){
  const file=await fileBytes(c,id,parts[4])
  return new Response(file.bytes as Uint8Array<ArrayBuffer>,{headers:{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(file.metadata.name)}`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Content-SHA256':file.metadata.sha256}})
 }else fail(404,'Export route unavailable')
 return Response.json(value,{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})
}
