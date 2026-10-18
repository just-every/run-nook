/* Nook's worker never caches requests, responses, private pages or attachments. */
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
const safeURL=value=>{try{const url=new URL(value,self.location.origin);if(url.origin===self.location.origin&&url.pathname==='/app')return url.href}catch{}return self.location.origin+'/app'};
const badge=async count=>{if(Number.isSafeInteger(count)&&count>=0){try{if(count&&self.navigator.setAppBadge)await self.navigator.setAppBadge(count);else if(!count&&self.navigator.clearAppBadge)await self.navigator.clearAppBadge()}catch{}}};
self.addEventListener('push',event=>{
 // Register the lifetime promise synchronously, including empty, malformed and
 // non-object payloads. No payload kind is allowed to become a silent push.
 event.waitUntil((async()=>{
 let value;try{value=event.data?.json()}catch{}
 if(!value||typeof value!=='object'||Array.isArray(value))value={};
 // Every accepted push displays an alert. Never implement silent badge clears:
 // WebKit revokes a subscription when a push does not show a notification.
 const thread=typeof value.thread==='string'&&/^[a-zA-Z0-9-]{1,160}$/.test(value.thread)?value.thread:null;
 const data={thread,url:safeURL(value.url),user:typeof value.user==='string'?value.user:'',ids:Array.isArray(value.ids)?value.ids.filter(id=>typeof id==='string').slice(0,100):[]};
 await self.registration.showNotification('Nook',{body:typeof value.body==='string'?value.body.slice(0,500):'Open Nook to view new activity.',icon:'/icons/nook-192.png',badge:'/icons/nook-192.png',tag:typeof value.tag==='string'&&value.tag?value.tag:'nook',renotify:true,actions:[{action:thread?'unfollow':'threads',title:thread?'Unfollow thread':'Manage threads'}],data});
 await badge(value.badge);
})())});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil((async()=>{
 // A freshly loaded app may not yet be controlled by this worker. Reuse it as
 // well, preferring the conversation already open over another Nook window.
 let url=safeURL(event.notification.data?.url);
 if(event.action==='unfollow'&&event.notification.data?.thread){try{
  const who=await fetch('/api/me',{credentials:'same-origin',cache:'no-store'});if(!who.ok||(await who.json()).id!==event.notification.data.user)throw Error('Sign in as the notification recipient to unfollow');
  const response=await fetch('/api/messages/'+encodeURIComponent(event.notification.data.thread)+'/follow',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({follow:false})});if(!response.ok)throw Error('Thread unavailable or sign-in expired');return;
 }catch{await self.registration.showNotification('Thread not unfollowed',{body:'Open Nook to sign in and check your current thread access.',data:{url},tag:'nook-unfollow-failed'});}}
 if(event.action==='threads')url=self.location.origin+'/app?view=threads';
 const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
 const apps=windows.filter(client=>new URL(client.url).origin===self.location.origin&&new URL(client.url).pathname==='/app');
 const conversation=new URL(url).searchParams.get('conversation');
 const existing=apps.find(client=>new URL(client.url).searchParams.get('conversation')===conversation)??apps[0];
 // Restore foreground while the clicked client is still live. Navigation can
 // replace its WindowClient; never focus the pre-navigation object afterward.
 // The ordinary authenticated /app loader still enforces current ACL.
 if(existing){const focused=await existing.focus();if(await focused.navigate(url))return}
 await self.clients.openWindow(url);
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
