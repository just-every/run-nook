// Local cleanup needs no session or push-provider request. Await it before
// leaving /app so an authentication redirect cannot race a worker message.
export async function clearPushNotices(){
 if(typeof navigator==='undefined')return
 await Promise.allSettled([
  (async()=>{if('serviceWorker' in navigator){const reg=await navigator.serviceWorker.getRegistration('/');for(const notice of await reg?.getNotifications()??[])notice.close()}})(),
  (async()=>{await navigator.clearAppBadge?.()})(),
 ])
}
