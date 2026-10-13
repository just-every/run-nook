import assert from 'node:assert/strict'
import {readFile,mkdir,writeFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {resolve} from 'node:path'
import {expect} from '@playwright/test'
const require=createRequire(import.meta.url)
export const axeSource=await readFile(require.resolve('axe-core/axe.min.js'),'utf8')
// Keep the complete report, including minor findings, so failures remain reviewable.
export async function accessibilityReport(page,destination,state){
 await mkdir(destination,{recursive:true})
 await page.addScriptTag({content:axeSource})
 const report=await page.evaluate(async()=>{
  const {testEngine,testEnvironment,violations,incomplete,passes}=await axe.run(document)
  return {testEngine,testEnvironment,violations,incomplete,passes:passes.map(({id})=>id)}
 })
 await writeFile(resolve(destination,`${state}-axe.json`),JSON.stringify(report,null,2)+'\n')
 await page.screenshot({path:resolve(destination,`${state}.png`),fullPage:true})
 return report
}
export async function auditAccessibility(page,destination,state){
 const report=await accessibilityReport(page,destination,state)
 const violations=report.violations.filter(({impact})=>['serious','critical'].includes(impact))
 console.log(`AXE ${state}: ${violations.length} serious/critical (${report.testEngine.version})`)
 assert.deepEqual(violations,[],`${state}: axe serious/critical violations`)
 return report
}
export async function auditComposerRouting(page,composer,destination,state){
 const toggle=composer.locator('.composer-options summary'),routing=composer.locator('.composer-routing')
 await expect(routing).toHaveCount(0)
 await auditAccessibility(page,destination,`${state}-routing-closed`)
 await toggle.click()
 await expect(routing).toBeVisible()
 await expect(toggle).toHaveAttribute('aria-controls',await routing.getAttribute('id'))
 await auditAccessibility(page,destination,`${state}-routing-open`)
 await toggle.click()
 await expect(routing).toHaveCount(0)
}
export async function assertDialogTabContainment(page,dialog){
 // Use the live enabled controls, including details summaries; exercise both
 // wrap boundaries with real keyboard events instead of dispatching keydown.
 const controls=dialog.locator('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],summary,[tabindex="0"]').filter({visible:true})
 const count=await controls.count()
 assert.ok(count>1,'dialog has multiple reachable controls')
 await controls.first().focus()
 await page.keyboard.press('Shift+Tab')
 await expect(controls.last()).toBeFocused()
 await page.keyboard.press('Tab')
 await expect(controls.first()).toBeFocused()
 for(const key of ['Tab','Shift+Tab']){
  for(let i=0;i<count;i++){
   await page.keyboard.press(key)
   assert.equal(await dialog.evaluate(el=>el.contains(document.activeElement)),true,`${key} stays in the dialog`)
  }
 }
}
