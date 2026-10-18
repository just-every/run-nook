import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

// Exercise the shipped worker through its event boundary. The host supplies
// browser APIs; encrypted vendor delivery has its separate real Chrome proof.
test('service worker keeps every push visible and opens its conversation on activation',async()=>{
 const handlers=new Map(),shown=[],calls=[];
 const origin='https://nook.example.test',target=origin+'/app?conversation=launch&focus=message';
 let windows=[],releaseDisplay;
 const self={location:{origin},navigator:{},addEventListener:(name,fn)=>handlers.set(name,fn),registration:{
  showNotification:async(title,options)=>{shown.push({title,...options});if(releaseDisplay)await releaseDisplay.promise},
 },clients:{
  matchAll:async options=>{assert.equal(options.type,'window');assert.equal(options.includeUncontrolled,true);return windows},
  openWindow:async url=>{calls.push(['open',url])},
 }};
 runInNewContext(await readFile(new URL('../public/sw.js',import.meta.url),'utf8'),{self,URL});
 const dispatch=(name,fields)=>{
  const promises=[];handlers.get(name)({...fields,waitUntil:promise=>promises.push(promise)});
  assert.equal(promises.length,1,'the event registers its lifetime before returning');
  return Promise.all(promises);
 };
 const payloads=[
  ...['mention','direct-message','thread-follow','urgent-request','badge-clear','unknown'].map(type=>({type,url:target,body:type,tag:'conversation',badge:0})),
  null,[],true,42,'text',undefined,
 ];
 for(const value of payloads){
  const before=shown.length;
  await dispatch('push',{data:value===undefined?undefined:{json:()=>value}});
  assert.equal(shown.length,before+1,'every payload displays exactly once');
  const notice=shown.at(-1);assert.ok(notice.body);assert.equal(notice.renotify,true,'a conversation replacement alerts again');
  assert.equal(notice.data.url,value?.url??origin+'/app');
 }
 await dispatch('push',{data:{json:()=>{throw new SyntaxError('invalid payload')}}});
 assert.ok(shown.at(-1).body,'invalid JSON still shows an alert');
 let release;releaseDisplay={promise:new Promise(resolve=>{release=resolve})};
 let finished=false;const pending=dispatch('push',{data:{json:()=>({url:target})}}).then(()=>{finished=true});
 await Promise.resolve();assert.equal(finished,false,'waitUntil includes notification display');release();await pending;releaseDisplay=null;

 const client=(id,url,navigable=true)=>({url,focus:async()=>{calls.push(['focus',id]);return {navigate:async destination=>{calls.push(['navigate',id,destination]);return navigable?{url:destination}:null}}}});
 const click=async url=>{let closed=false;await dispatch('notificationclick',{notification:{data:{url},close:()=>{closed=true}}});assert.equal(closed,true);return calls.splice(0)};
 windows=[client('other',origin+'/app?conversation=other'),client('launch',origin+'/app?conversation=launch')];
 assert.deepEqual(await click(target),[['focus','launch'],['navigate','launch',target]]);
 windows=[client('other',origin+'/app?conversation=other')];
 assert.deepEqual(await click(target),[['focus','other'],['navigate','other',target]]);
 windows=[];assert.deepEqual(await click(target),[['open',target]]);
 windows=[client('gone',origin+'/app',false)];
 assert.deepEqual(await click(target),[['focus','gone'],['navigate','gone',target],['open',target]]);
 windows=[client('external','https://elsewhere.example.test/app')];
 for(const unsafe of ['https://elsewhere.example.test/app','/signin','javascript:alert(1)'])assert.deepEqual(await click(unsafe),[['open',origin+'/app']]);
});

// NOOK-072: action uses the ordinary session-bound follow door, including a
// recipient check so a notice left by another account cannot change its state.
test('notification unfollow checks the recipient and reports a refused action',async()=>{
 const handlers=new Map(),shown=[],requests=[];let current='ana',refused=false
 const self={location:{origin:'https://nook.example.test'},navigator:{},addEventListener:(name,fn)=>handlers.set(name,fn),registration:{showNotification:async(title,data)=>shown.push({title,...data})},clients:{matchAll:async()=>[],openWindow:async()=>{}}}
 const fetch=async(path,options)=>{requests.push({path,options});return path==='/api/me'?{ok:true,json:async()=>({id:current})}:{ok:!refused}}
 runInNewContext(await readFile(new URL('../public/sw.js',import.meta.url),'utf8'),{self,URL,fetch})
 const click=async()=>{let pending;handlers.get('notificationclick')({action:'unfollow',notification:{data:{url:'/app?view=threads',user:'ana',thread:'root-thread'},close(){}},waitUntil:p=>{pending=p}});await pending}
 await click();assert.equal(requests.at(-1).path,'/api/messages/root-thread/follow');assert.deepEqual(JSON.parse(requests.at(-1).options.body),{follow:false});assert.equal(requests.at(-1).options.credentials,'same-origin');assert.equal(shown.length,0)
 current='sam';requests.length=0;await click();assert.deepEqual(requests.map(r=>r.path),['/api/me']);assert.equal(shown.at(-1).title,'Thread not unfollowed')
 current='ana';refused=true;await click();assert.equal(shown.at(-1).title,'Thread not unfollowed')
})
