// The local outbox answers only a request that holds the checkout's dev key (Base's key gate). Test
// runtimes are started with this key as RER_DEV_KEY; harness fetches send it in the rer header and
// browsers carry it on every request of every context.
export const devKey='nook-test-dev-key-0123456789abcdefghijklmnopqrstuvwxyz'
export const keyHeaders={'x-rer-dev-key':devKey}
const withKey=options=>({...options,extraHTTPHeaders:{...options?.extraHTTPHeaders,...keyHeaders}})
export function keyed(chromium){
 return {launch:async options=>{
  // Full Chromium exercises the app's service-worker badging APIs; headless
  // shell advertises those APIs but crashes when the worker clears a badge.
  const browser=await chromium.launch({channel:'chromium',...options}),newContext=browser.newContext.bind(browser),newPage=browser.newPage.bind(browser)
  browser.newContext=settings=>newContext(withKey(settings));browser.newPage=settings=>newPage(withKey(settings))
  return browser
 }}
}
