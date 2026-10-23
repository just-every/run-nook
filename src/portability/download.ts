// Drive Nook's owner-only Base export protocol with the browser's current
// session. Read the complete archive before releasing its temporary job.
export async function downloadWorkspace(report:(message:string)=>void){
 const base='/api/portability/exports'
 async function call(path:string,body?:object){
  const response=await fetch(base+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined})
  if(!response.ok){
   // A platform or uncaught Worker error answers an HTML page, not the protocol's JSON.
   const result=await response.json().catch(()=>undefined) as {error?:string}|undefined
   if(!result)throw Error(`The server answered with HTTP ${response.status} instead of an archive step. Please try again in a minute.`)
   throw Error(result.error==='unauthorized'?'Sign in as a workspace owner to download your data.':result.error==='reconcile_pending_object_work_before_export'?'Finish pending uploads, deletions and imports, then try again.':'We couldn’t prepare the archive. Please try again.')}
  return response
 }
 let id:string|undefined
 try{
  id=((await(await call('',{})).json()) as {id:string}).id
  type Status={phase:string;completed:number}
  let status=await(await call('/'+id)).json() as Status
  while(status.phase==='building'){
   report(`Preparing your archive (${status.completed} parts)…`)
   status=await(await call('/'+id+'/advance',{expectedPart:status.completed,maxParts:16})).json() as Status
  }
  if(status.phase!=='complete')throw Error('The archive did not finish. Please try again.')
  const archive=await(await call('/'+id+'/download')).blob()
  const url=URL.createObjectURL(archive),link=document.createElement('a')
  link.href=url;link.download='nook-workspace.rer';link.click()
  // The browser needs time to start reading the object URL.
  setTimeout(()=>URL.revokeObjectURL(url),60_000)
 }finally{
  if(id){const response=await call('/'+id+'/abort',{});await response.body?.cancel()}
 }
}
