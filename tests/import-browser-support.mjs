import assert from 'node:assert/strict';
import {expect} from '@playwright/test';
export async function createBrowserPlan(page,{preview=true,omissions='I reviewed and accept these exact omissions'}={}){
 if(preview){await page.getByRole('button',{name:'Preview exact import',exact:true}).click();await expect(page.getByRole('heading',{name:'Review the historical import',exact:true})).toBeVisible()}
 const accept=page.getByRole('checkbox',{name:omissions,exact:true});if(await accept.count())await accept.check();
 const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/operator/import/plan'&&r.request().method()==='POST');
 await page.getByRole('button',{name:'Create dry run',exact:true}).click();const result=await response;
 assert.equal(result.status(),200);const planned=await result.json();assert.ok(planned.fingerprint);assert.ok(planned.planId);
 await expect(page.getByRole('heading',{name:'3. Review the dry run',exact:true})).toBeVisible();return planned;
}
export async function reconcileBrowserJob(page,job){
 const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/operator/import/reconcile'&&r.request().method()==='POST');
 await job.getByRole('button',{name:'Reconcile imported history',exact:true}).click();const result=await response;assert.equal(result.status(),200);const report=await result.json();assert.equal(report.ok,true);await expect(page.getByRole('heading',{name:'Reconciliation',exact:true})).toBeVisible();await page.getByRole('heading',{name:'Reconciliation',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:`evidence/nook-1/reconciliation-${page.viewportSize().width}.png`,fullPage:true,animations:'disabled'});await page.getByRole('button',{name:'Close reconciliation',exact:true}).click();return report;
}
