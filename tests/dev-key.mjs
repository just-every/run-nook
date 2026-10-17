// Local identity is key-gated. Synthetic browser contexts carry the test key.
export const devKey='nook-test-dev-key-0123456789abcdefghijklmnopqrstuvwxyz'
export const keyHeaders={'x-rer-dev-key':devKey}
const withKey=options=>({...options,...(process.env.NOOK_BROWSER_BLOCK_SERVICE_WORKERS==='1'?{serviceWorkers:'block'}:{}),extraHTTPHeaders:{...options?.extraHTTPHeaders,...keyHeaders}})
export function keyed(chromium){
 return {launch:async options=>{
  // Full Chromium exercises the app's service-worker badging APIs; headless
  // shell advertises those APIs but crashes when the worker clears a badge.
  const browser=await chromium.launch({channel:'chromium',...options,args:['--use-mock-keychain','--password-store=basic',...(options?.args??[])]}),newContext=browser.newContext.bind(browser),newPage=browser.newPage.bind(browser)
  browser.newContext=settings=>newContext(withKey(settings));browser.newPage=settings=>newPage(withKey(settings))
  return browser
 }}
}
