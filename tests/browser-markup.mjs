import assert from 'node:assert/strict'

export const hostileMessage='Browser multisession evidence <img data-nook-injected src="data:," onerror="globalThis.__nookMessageExecuted=true"><script data-nook-injected>globalThis.__nookMessageExecuted=true</script><span data-nook-injected>untrusted & literal</span>'

export async function assertPlainMessage(page){
 const body=page.locator('#primary .message-body').filter({hasText:hostileMessage})
 await body.waitFor()
 assert.equal(await body.textContent(),hostileMessage,'the submitted markup renders as exact literal message text')
 assert.equal(await body.locator('*').count(),0,'message text creates no descendant elements')
 assert.equal(await page.locator('[data-nook-injected]').count(),0,'hostile markup creates no DOM anywhere')
 assert.equal(await page.evaluate(()=>Object.hasOwn(globalThis,'__nookMessageExecuted')),false,'message script and event handlers never execute')
}
