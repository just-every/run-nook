import assert from 'node:assert/strict'
import {expect} from '@playwright/test'
// Observe the actual network refresh and committed DOM, without replacing an API.
export async function retainedRefresh(page,{path,target,mutate}){
 await expect(page.locator('.nook-app')).toHaveAttribute('data-live-connected','true')
 const host=page.locator('.page-content').last(),summary=host.locator('details.search-advanced>summary').first()
 if(!await summary.evaluate(e=>e.parentElement.open))await summary.click()
 const before=await target.elementHandle()
 await host.evaluate(e=>{
  e.scrollTop=Math.min(160,e.scrollHeight-e.clientHeight)
  window.__refreshProbe={host:e,top:e.scrollTop,loading:[],removed:false}
  window.__refreshObserver=new MutationObserver(records=>{
   const p=window.__refreshProbe
   if(!p.host.isConnected)p.removed=true
   for(const record of records)for(const node of record.addedNodes){const text=node.textContent??'';if(/^(Searching…|Loading files…)$/.test(text.trim()))p.loading.push(text)}
  });window.__refreshObserver.observe(e,{childList:true,subtree:true,characterData:true})
 })
 const refreshed=page.waitForResponse(r=>new URL(r.url()).pathname===path&&r.request().method()==='GET')
 await mutate();await refreshed
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
 assert.equal(await before.evaluate(e=>e.isConnected),true,'the original result row remains mounted')
 assert.equal(await summary.evaluate(e=>e.parentElement.open),true,'filters stay open')
 const result=await page.evaluate(()=>{window.__refreshObserver.disconnect();const p=window.__refreshProbe;return {removed:p.removed,loading:p.loading,before:p.top,after:p.host.scrollTop}})
 assert.equal(result.removed,false);assert.deepEqual(result.loading,[]);assert.equal(result.after,result.before,'refresh holds the list scroll position')
 await before.dispose()
}
