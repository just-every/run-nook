import assert from 'node:assert/strict'

export const hostileMessage='Browser multisession evidence <img data-nook-injected src="data:," onerror="globalThis.__nookMessageExecuted=true"><script data-nook-injected>globalThis.__nookMessageExecuted=true</script><span data-nook-injected>untrusted & literal</span>'

export async function assertSafeMessage(page){
 const body=page.locator('#primary .message-body').filter({hasText:hostileMessage})
 await body.waitFor()
 assert.equal(await body.textContent(),hostileMessage,'the submitted markup renders as exact literal message text')
 assert.equal(await body.locator('script,img,iframe,object,embed,svg,math,style,link,form,input,button,textarea,select').count(),0,'literal message markup creates no active content')
 assert.deepEqual(await body.evaluate(element=>Array.from(element.querySelectorAll('*')).flatMap(node=>Array.from(node.attributes).filter(attribute=>/^on/i.test(attribute.name)||['src','srcset','srcdoc'].includes(attribute.name)).map(attribute=>attribute.name))),[],'message markup creates no handlers or resource fetches')
 assert.equal(await page.locator('[data-nook-injected]').count(),0,'hostile markup creates no DOM anywhere')
 assert.equal(await page.evaluate(()=>Object.hasOwn(globalThis,'__nookMessageExecuted')),false,'message script and event handlers never execute')
}
