// Delay actual public responses, without replacing their bodies. The workspace
// refresh is held so it cannot hide a pre-save read overwriting a successful save.
export async function profileFieldReadOrdering(page){
 const gate=()=>{let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve}}
 const captured=gate(),releaseReads=gate(),releaseWorkspace=gate(),deliveries=[]
 let edited=false,creating=false,holding=false
 const fields=url=>url.pathname==='/api/profile/fields',workspace=url=>url.pathname==='/api/workspace'
 const workspaceHandler=async route=>{if(holding)await releaseWorkspace.promise;await route.continue()}
 const fieldsHandler=async route=>{
  const request=route.request(),input=request.method()==='POST'?request.postDataJSON():null
  if(input?.id?.startsWith('region-'))creating=true
  const obsolete=request.method()==='GET'&&edited&&!creating
  if(obsolete)holding=true
  const response=await route.fetch()
  if(input?.id==='phone')edited=true
  if(obsolete){
   const delivered=gate();deliveries.push(delivered.promise);captured.resolve()
   await releaseReads.promise
   try{await route.fulfill({response})}finally{delivered.resolve()}
  }else await route.fulfill({response})
 }
 await page.route(workspace,workspaceHandler);await page.route(fields,fieldsHandler)
 return {
  captured:()=>captured.promise,
  async deliver(){
   releaseReads.resolve();await Promise.all(deliveries)
   // Let the browser consume the delivered response and commit its render.
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
  },
  async close(){releaseReads.resolve();releaseWorkspace.resolve();await page.unroute(fields,fieldsHandler);await page.unroute(workspace,workspaceHandler)},
 }
}
