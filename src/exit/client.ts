import {FORMAT,FORMAT_VERSION,type ExportBundle,type ExportPage,type ExportReport} from './types'
import {jsonDocument,jsonLines,offlineHtml} from './format'

export class ExportError extends Error{constructor(readonly status:number,message:string){super(message)}}

export async function exportRequest<T>(path='',input?:unknown,signal?:AbortSignal):Promise<T>{
 const response=await fetch('/api/readable-exports'+path,{method:input===undefined?'GET':'POST',headers:input===undefined?undefined:{'Content-Type':'application/json'},body:input===undefined?undefined:JSON.stringify(input),cache:'no-store',signal})
 if(!response.ok){const error=await response.json() as {error?:string};throw new ExportError(response.status,error.error??'Export request failed')}
 return response.json() as Promise<T>
}
const digest=async(bytes:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as Uint8Array<ArrayBuffer>))).map(b=>b.toString(16).padStart(2,'0')).join('')
function base64(bytes:Uint8Array){let text='';for(let i=0;i<bytes.length;i+=32768)text+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(text)}
async function download(path:string,signal?:AbortSignal){
 const response=await fetch('/api/readable-exports'+path,{cache:'no-store',signal})
 if(!response.ok){const error=await response.json() as {error?:string};throw new ExportError(response.status,error.error??'Export download failed')}
 return response
}
export async function assembleExport(id:string,progress:(message:string)=>void,signal?:AbortSignal):Promise<ExportBundle>{
 const report=await exportRequest<ExportReport>('/'+id,undefined,signal)
 if(!report.complete)throw Error('Prepare every export page before downloading')
 const bundle:ExportBundle={format:FORMAT,version:FORMAT_VERSION,report,records:[],files:[]},pageIndex:{ordinal:number;sha256:string;records:number}[]=[]
 let after=-1
 for(;;){
  const page=await exportRequest<{items:typeof pageIndex;hasMore:boolean;cursor:number|null}>(`/${id}/index?after=${after}`,undefined,signal)
  pageIndex.push(...page.items)
  if(!page.hasMore)break
  if(page.cursor===null||page.cursor<=after)throw Error('Export page index did not advance')
  after=page.cursor
 }
 if(pageIndex.length!==report.pages)throw Error('Export page index is incomplete')
 for(const [ordinal,entry] of pageIndex.entries()){
  if(entry.ordinal!==ordinal)throw Error('Export page index has a gap')
  progress(`Reading page ${ordinal+1} of ${report.pages}`)
  const response=await download(`/${id}/pages/${ordinal}`,signal),body=await response.text()
  if(await digest(new TextEncoder().encode(body))!==entry.sha256)throw Error('Export page checksum did not match')
  const page=JSON.parse(body) as ExportPage
  if(page.format!==FORMAT||page.version!==FORMAT_VERSION||page.job!==id||page.ordinal!==ordinal||page.records.length!==entry.records)throw Error('Export page identity did not match')
  bundle.records.push(...page.records)
 }
 const files=bundle.records.filter(record=>record.type==='files'&&record.data.state==='attached')
 for(const [position,{data:file}] of files.entries()){
  progress(`Reading file ${position+1} of ${files.length}: ${file.name}`)
  const response=await download(`/${id}/files/${encodeURIComponent(file.id)}`,signal),bytes=new Uint8Array(await response.arrayBuffer())
  if(bytes.length!==file.size||await digest(bytes)!==file.sha256)throw Error('Export file checksum did not match: '+file.name)
  bundle.files.push({id:file.id,sha256:file.sha256,size:file.size,base64:base64(bytes)})
 }
 if(bundle.records.length!==report.records||bundle.files.length!==report.files||bundle.files.reduce((n,file)=>n+file.size,0)!==report.bytes)throw Error('Export completeness counts did not match')
 const final=await exportRequest<ExportReport>('/'+id,undefined,signal)
 if(!final.complete||final.pages!==report.pages)throw Error('Export no longer complete')
 bundle.report={...final,pageIndex}
 return bundle
}
export function saveExport(bundle:ExportBundle,format:'json'|'jsonl'|'html'){
 const body=format==='json'?jsonDocument(bundle):format==='jsonl'?jsonLines(bundle):offlineHtml(bundle)
 const mime=format==='html'?'text/html':format==='json'?'application/json':'application/x-ndjson'
 const url=URL.createObjectURL(new Blob([body],{type:mime+';charset=utf-8'})),link=document.createElement('a')
 link.href=url;link.download=`nook-readable-${bundle.report.id}.${format}`;document.body.appendChild(link);link.click();link.remove()
 setTimeout(()=>URL.revokeObjectURL(url),1000)
}
