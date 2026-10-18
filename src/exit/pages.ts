import {fail} from '../family/team-chat/domain'
import type {Context} from '../platform/storage/context'
import {datasets,exportRecord} from './catalog'
import {fileBytes,sha256} from './files'
import {jobFence} from './policy'
import {assertJob,report} from './store'
import {FORMAT,FORMAT_VERSION,type ExportCursor,type ExportPage} from './types'

const PAGE_SIZE=20
async function readPage(c:Context,id:string,cursor:ExportCursor,ordinal:number){
 const dataset=datasets[cursor.dataset]
 if(!dataset)fail(409,'Export cursor is complete')
 const rows=await c.rows(`WITH scope AS (SELECT conversation FROM nook_exit_scopes WHERE job=?) SELECT d.* FROM (${dataset.sql}) d WHERE d._key>? AND EXISTS(SELECT 1 FROM nook_exit_jobs ej WHERE ej.id=? AND ej.owner=? AND ${jobFence}) ORDER BY d._key LIMIT ?`,[id,cursor.after,id,c.uid,PAGE_SIZE])
 await assertJob(c,id)
 const page:ExportPage={format:FORMAT,version:FORMAT_VERSION,job:id,ordinal,records:rows.map(row=>exportRecord(dataset,row))}
 return {page,rows,dataset}
}
export async function stepJob(c:Context,id:string){
 const job=await assertJob(c,id)
 if(job.state==='complete')return report(job)
 if(job.state!=='running')fail(409,'Export is cancelled. Resume it to continue.')
 const cursor:ExportCursor=JSON.parse(job.cursor_json),{page,rows,dataset}=await readPage(c,id,cursor,job.pages)
 let files=0,bytes=0,omissions=0
 for(const record of page.records){
  if(record.type==='files'&&record.data.state==='attached'){
   await fileBytes(c,id,record.data.id);files++;bytes+=record.data.size
  }
  if(record.type==='files'&&record.data.state==='deleted')omissions++
  omissions+=(record.data.omissions??[]).length
 }
 const counts=JSON.parse(job.counts_json) as Record<string,number>
 counts[dataset.name]=(counts[dataset.name]??0)+rows.length
 const exhausted=rows.length<PAGE_SIZE
 if(exhausted){
  const expected=await c.one<{n:number}>(`WITH scope AS (SELECT conversation FROM nook_exit_scopes WHERE job=?) SELECT COUNT(*) AS n FROM (${dataset.sql})`,[id])
  if(expected?.n!==counts[dataset.name])fail(409,'Export count mismatch. Start a new export; no complete report was issued.')
 }
 const next:ExportCursor=exhausted?{dataset:cursor.dataset+1,after:''}:{dataset:cursor.dataset,after:rows.at(-1)!._key}
 const body=JSON.stringify(page),digest=await sha256(new TextEncoder().encode(body)),state=next.dataset===datasets.length?'complete':'running'
 await c.batch([
  c.sql('INSERT INTO nook_exit_pages(job,ordinal,cursor_json,sha256,records) VALUES(?,?,?,?,?)',id,job.pages,job.cursor_json,digest,rows.length),
  c.sql('UPDATE nook_exit_jobs SET state=?,cursor_json=?,pages=pages+1,records=records+?,files=files+?,bytes=bytes+?,omissions=omissions+?,counts_json=?,revision=revision+1 WHERE id=?',state,JSON.stringify(next),rows.length,files,bytes,omissions,JSON.stringify(counts),id),
 ],undefined,`EXISTS(SELECT 1 FROM nook_exit_jobs ej WHERE ej.id=? AND ej.owner=? AND ej.state='running' AND ej.revision=? AND ${jobFence})`,[id,c.uid,job.revision])
 return report(await assertJob(c,id))
}
export async function downloadPage(c:Context,id:string,ordinal:number){
 if(!Number.isSafeInteger(ordinal)||ordinal<0)fail(400,'Invalid export page')
 await assertJob(c,id)
 const stored=await c.one<{cursor_json:string;sha256:string}>('SELECT cursor_json,sha256 FROM nook_exit_pages WHERE job=? AND ordinal=?',[id,ordinal])
 if(!stored)fail(404,'Export page is not ready')
 const {page}=await readPage(c,id,JSON.parse(stored!.cursor_json),ordinal),body=JSON.stringify(page)
 if(await sha256(new TextEncoder().encode(body))!==stored!.sha256)fail(409,'Export page changed. Start a new export.')
 await assertJob(c,id)
 return {body,sha256:stored!.sha256}
}
