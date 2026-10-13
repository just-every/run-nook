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
export async function assertAriaControlsTargets(page,state){
 const invalid=await page.evaluate(()=>{
  const ids=new Map()
  for(const element of document.querySelectorAll('[id]'))ids.set(element.id,(ids.get(element.id)??0)+1)
  return [...document.querySelectorAll('[aria-controls]')].flatMap(element=>
   element.getAttribute('aria-controls').split(/\s+/).filter(Boolean).flatMap(target=>{
    const count=ids.get(target)??0
    return count===1?[]:[{element:element.id?`${element.localName}#${element.id}`:element.localName,target,count}]
   })
  )
 })
 assert.deepEqual(invalid,[],`${state}: each aria-controls target resolves to exactly one element`)
}
export async function auditAccessibility(page,destination,state){
 const report=await accessibilityReport(page,destination,state)
 await assertAriaControlsTargets(page,state)
 const violations=report.violations.filter(({impact})=>['serious','critical'].includes(impact))
 console.log(`AXE ${state}: ${violations.length} serious/critical (${report.testEngine.version})`)
 assert.deepEqual(violations,[],`${state}: axe serious/critical violations`)
 return report
}
export async function auditComposerRouting(page,composer,destination,state){
 const toggle=composer.locator('.composer-options summary'),routing=composer.locator('.composer-routing')
 const contained=async(label)=>{
  const geometry=await composer.evaluate(element=>{
   const elements=[element,...element.querySelectorAll('.composer-routing,.composer-routing select,.composer-routing input')]
   return {width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,boxes:elements.map(el=>({element:el.localName,...el.getBoundingClientRect().toJSON()}))}
  })
  assert.ok(geometry.scrollWidth<=geometry.width,`${label}: page fits the viewport horizontally`)
  for(const box of geometry.boxes)assert.ok(box.left>=0&&box.top>=0&&box.right<=geometry.width&&box.bottom<=geometry.height,`${label}: ${box.element} stays inside the viewport ${JSON.stringify(box)}`)
 }
 await expect(routing).toHaveCount(0)
 await contained(`${state}-routing-closed`)
 await auditAccessibility(page,destination,`${state}-routing-closed`)
 await toggle.focus()
 await page.keyboard.press('Enter')
 await expect(routing).toBeVisible()
 await expect(toggle).toHaveAttribute('aria-controls',await routing.getAttribute('id'))
 await contained(`${state}-routing-open`)
 const controls=routing.locator('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]').filter({visible:true})
 const count=await controls.count()
 assert.ok(count>0,`${state}: open routing has reachable controls`)
 await expect(toggle).toBeFocused()
 for(let i=0;i<count;i++){
  await page.keyboard.press('Tab')
  await expect(controls.nth(i)).toBeFocused()
 }
 for(let i=count-2;i>=0;i--){
  await page.keyboard.press('Shift+Tab')
  await expect(controls.nth(i)).toBeFocused()
 }
 await page.keyboard.press('Shift+Tab')
 await expect(toggle).toBeFocused()
 await auditAccessibility(page,destination,`${state}-routing-open`)
 await page.keyboard.press('Enter')
 await expect(routing).toHaveCount(0)
 await contained(`${state}-routing-reclosed`)
 await assertAriaControlsTargets(page,`${state}-routing-reclosed`)
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
