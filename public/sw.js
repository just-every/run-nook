/* Nook's worker never caches requests, responses, private pages or attachments. */
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
const safeURL=value=>{try{const url=new URL(value,self.location.origin);if(url.origin===self.location.origin&&url.pathname==='/app')return url.href}catch{}return self.location.origin+'/app'};
const badge=async count=>{if(Number.isSafeInteger(count)&&count>=0){try{if(count&&self.navigator.setAppBadge)await self.navigator.setAppBadge(count);else if(!count&&self.navigator.clearAppBadge)await self.navigator.clearAppBadge()}catch{}}};
self.addEventListener('push',event=>event.waitUntil((async()=>{
 let value={};try{value=event.data?.json()??{}}catch{}
 // Every accepted push displays an alert. Never implement silent badge clears:
 // WebKit revokes a subscription when a push does not show a notification.
 const data={url:safeURL(value.url),user:typeof value.user==='string'?value.user:'',ids:Array.isArray(value.ids)?value.ids.filter(id=>typeof id==='string').slice(0,100):[]};
 await self.registration.showNotification('Nook',{body:typeof value.body==='string'?value.body.slice(0,500):'Open Nook to view new activity.',icon:'/icons/nook-192.png',badge:'/icons/nook-192.png',tag:typeof value.tag==='string'?value.tag:'nook',data});
 await badge(value.badge);
})()));
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil((async()=>{
 const url=safeURL(event.notification.data?.url),windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
 const existing=windows.find(client=>new URL(client.url).origin===self.location.origin&&new URL(client.url).pathname==='/app');
 // Navigating uses the ordinary authenticated /app loader and current ACL.
 if(existing){await existing.navigate(url);await existing.focus()}else await self.clients.openWindow(url);
})())});
self.addEventListener('message',event=>event.waitUntil((async()=>{
 const source=event.source;if(!source?.id)return;const client=await self.clients.get(source.id);if(!client)return;
 const url=new URL(client.url);if(url.origin!==self.location.origin||url.pathname!=='/app')return;
 const value=event.data;if(value?.type!=='nook-sync'||typeof value.user!=='string'||!Array.isArray(value.active))return;
 const active=new Set(value.active);for(const notice of await self.registration.getNotifications())if(notice.data?.user!==value.user||!notice.data?.ids?.some(id=>active.has(id)))notice.close();
 await badge(value.badge);
})()));
self.addEventListener('pushsubscriptionchange',event=>event.waitUntil((async()=>{
 // Reconciliation needs the current signed-in session. Do not persist a token in
 // the service worker; a foreground launch renews a vanished subscription.
 for(const client of await self.clients.matchAll({type:'window'}))client.postMessage({type:'nook-resubscribe'});
})()));
