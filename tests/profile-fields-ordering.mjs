import {expect} from '@playwright/test'
// Delay actual public responses, without replacing their bodies. The workspace
// refresh is held so it cannot hide a pre-save read overwriting a successful save.
export async function profileFieldReadOrdering(page){
 const gate=()=>{let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve}}
 const captured=gate(),releaseReads=gate(),releaseWorkspace=gate(),releaseTeam=gate(),deliveries=[]
 let edited=false,creating=false,holding=false
 const fields=url=>url.pathname==='/api/profile/fields',workspace=url=>url.pathname==='/api/workspace'
 const team=url=>url.pathname==='/api/team'
 const teamHandler=async route=>{const response=await route.fetch(),page=await response.json();if(!page.hasMore)await releaseTeam.promise;await route.fulfill({response})}
 const workspaceHandler=async route=>{if(holding)await releaseWorkspace.promise;await route.continue()}
 const fieldsHandler=async route=>{
  const request=route.request(),input=request.method()==='POST'?request.postDataJSON():null
  if(input?.id?.startsWith('region-')){creating=true;releaseTeam.resolve()}
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
 await page.route(team,teamHandler);await page.route(workspace,workspaceHandler);await page.route(fields,fieldsHandler)
 return {
  captured:()=>captured.promise,
  async deliver(){
   const fields=page.getByRole('region',{name:'Profile fields',exact:true})
   await expect(fields).toHaveAttribute('data-save','saved');await expect(fields).toHaveAttribute('aria-busy','false')
   releaseReads.resolve();await Promise.all(deliveries)
   // Let the browser consume the delivered response and commit its render.
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
  },
  async close(){releaseReads.resolve();releaseWorkspace.resolve();releaseTeam.resolve();await page.unroute(team,teamHandler);await page.unroute(fields,fieldsHandler);await page.unroute(workspace,workspaceHandler)},
 }
}

// Retire a private scope through a real step-up refusal while an already
// committed field response is in flight. No response body or product is mocked.
export async function profileFieldScopeOrdering(page,fields,width){
 const gate=()=>{let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve}}
 const committed=gate(),release=gate()
 const path=url=>url.pathname==='/api/profile/fields'
 const handler=async route=>{
  if(route.request().method()!=='POST')return route.continue()
  const response=await route.fetch();committed.resolve();await release.promise;await route.fulfill({response})
 }
 await page.route(path,handler)
 try{
  await fields.getByRole('button',{name:'Edit Sales region '+width,exact:true}).click()
  await fields.getByLabel('Field label',{exact:true}).fill('Regional coverage '+width)
  await fields.getByRole('button',{name:'Save field',exact:true}).click();await committed.promise
  await expect(fields).toHaveAttribute('aria-busy','true');await expect(fields).toHaveAttribute('data-save','saving')
  const invite=page.locator('form.team-invite')
  await invite.getByLabel('Name',{exact:true}).fill('Synthetic owner '+width)
  await invite.getByLabel('Email',{exact:true}).fill('synthetic-nook-field-'+width+'@example.test')
  await invite.getByLabel('Role',{exact:true}).selectOption('owner');await invite.getByRole('checkbox').first().check()
  const refused=page.waitForResponse(response=>new URL(response.url()).pathname==='/auth/invite'&&response.status()===403)
  await invite.getByRole('button',{name:'Send invitation',exact:true}).click();await refused
  await expect(fields.getByRole('status')).toHaveText('Profile fields changed while saving. Waiting for the result.')
  release.resolve()
  await expect(fields).toHaveAttribute('data-save','idle');await expect(fields).toHaveAttribute('aria-busy','false')
  await expect(fields.getByRole('status')).toHaveText('Profile fields changed while saving. The list was reloaded.')
  await expect(fields.getByRole('button',{name:'Edit Regional coverage '+width,exact:true})).toBeVisible()
 }finally{release.resolve();await page.unroute(path,handler)}
}
