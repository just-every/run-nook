import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {signIn} from './auth-support.mjs';

// The browser permission prompt and native Notification constructor are the
// browser edge: headless Chromium always reports notifications as denied, so the
// edge starts at "default" and grants when the page asks, as a person clicking
// Allow would. The receipt never claims an observed native OS toast.
export async function runTeamNotifications({browser,origin,ownerCookie,destination}){
 await mkdir(destination,{recursive:true});
 const checks=[],failures=[];
 for(const width of [1440,390]){
  const check={width,status:'running',permission:null,nativeConstructorCalls:0,titleCounts:{},checks:[],resourcesClosed:false};
  let context,failure;
  try{
   context=await browser.newContext({viewport:{width,height:900},permissions:['notifications']});
   const stamp=crypto.randomUUID().slice(0,8),email=`notify-${stamp}@example.test`;
   async function owner(path,body){const response=await fetch(origin+path,{method:body?'POST':'GET',headers:{Origin:origin,cookie:ownerCookie,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});assert.ok(response.ok,path+' accepted');return response.json()}
   const channel=await owner('/api/conversations',{name:'Notify '+stamp,kind:'channel'});
   const directory=await owner('/api/team'),author=directory.find(person=>person.id===channel.owner);
   assert.ok(author,'the message author is present in the authorized team directory');
   await owner('/api/team/invitations',{email,role:'member',mode:'member',scopes:[channel.id]});
   await owner('/auth/invite',{email,displayName:'Notification recipient',role:'member'});
   const receiver=await signIn(origin,email,{requestLink:false}),[name,...value]=receiver.cookie.split('=');
   await context.addCookies([{name,value:value.join('='),url:origin}]);
   const privateConversation=await owner('/api/conversations',{name:'Private review '+stamp,kind:'private',participants:[receiver.user.id]});
   await context.addInitScript(()=>{const Native=window.Notification;let permission='default';window.__nookNotificationCalls=[];window.Notification=class extends Native{static get permission(){return permission}static async requestPermission(){permission='granted';return permission}constructor(title,options){super(title,options);window.__nookNotificationCalls.push({title,body:options?.body,tag:options?.tag})}}});
   const page=await context.newPage(),away=await context.newPage();
   async function recordTitleCount(stage){
    const response=await context.request.get(origin+'/api/attention');
    assert.ok(response.ok(),'receiver attention projection is authorized');
    const attention=await response.json(),expected=attention.items.length;
    await page.waitForFunction(count=>Number(document.title.match(/^\((\d+)\)/)?.[1]??0)===count,expected);
    assert.equal(Number((await page.title()).match(/^\((\d+)\)/)?.[1]??0),expected,'tab title matches receiver active attention');
    check.titleCounts[stage]=expected;
    return expected;
   }
   await page.goto(origin+'/app?view=you');
   await page.getByRole('button',{name:'Enable browser notifications',exact:true}).click();
   await page.getByRole('button',{name:'Turn notifications off',exact:true}).waitFor();
   assert.equal(await page.evaluate(()=>Notification.permission),'granted');
   check.permission='granted';check.checks.push('explicit opt-in requests and receives browser permission');
   await page.waitForFunction(()=>document.querySelector('[data-live-connected="true"]'));
   // Headless pages keep reporting visible and focused after another tab comes
   // forward, so the left tab's hidden, unfocused state is set at that edge.
   const leave=async()=>{await away.bringToFront();await page.evaluate(()=>{document.hasFocus=()=>false;Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'hidden'});document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('blur'))})};
   await away.goto(origin+'/');await leave();

   const messageBodies=[`Explicit mention body ${stamp}`,`Routine message body ${stamp}`,`Quiet mention body ${stamp}`,`Urgent message body ${stamp}`];
   const privateAuthorContent=`Private urgent context ${stamp}`;
   const send=(body,extra={})=>owner(`/api/conversations/${privateConversation.id}/messages`,{body,intent:crypto.randomUUID(),...extra});
   await send(messageBodies[0],{mentions:[receiver.user.id]});
   await page.waitForFunction(()=>window.__nookNotificationCalls.length>=1);
   assert.equal(await page.evaluate(()=>window.__nookNotificationCalls.length),1);
   assert.equal(await recordTitleCount('afterMention'),1,'the first mention is the sole active attention item');
   check.checks.push('one new mention produces one constructor call and title count one');
   await send(messageBodies[1]);await page.waitForTimeout(300);
   assert.equal(await page.evaluate(()=>window.__nookNotificationCalls.length),1);
   check.checks.push('routine conversation is suppressed');
   const quietSettings=await context.request.patch(origin+'/api/settings',{data:{dndUntil:Date.now()+60000}});
   assert.ok(quietSettings.ok(),'quiet time is accepted');
   await recordTitleCount('afterQuietTime');
   await send(messageBodies[2],{mentions:[receiver.user.id]});await page.waitForTimeout(300);
   assert.equal(await page.evaluate(()=>window.__nookNotificationCalls.length),1);
   await recordTitleCount('afterQuietMention');
   check.checks.push('quiet mention is suppressed and title matches receiver active attention during quiet time');
   await send(messageBodies[3],{mentions:[receiver.user.id],urgent:true,urgentReason:privateAuthorContent});
   await page.waitForFunction(()=>window.__nookNotificationCalls.length>=2);
   await recordTitleCount('afterUrgent');
   const calls=await page.evaluate(()=>window.__nookNotificationCalls);
   assert.equal(calls.length,2);
   check.nativeConstructorCalls=calls.length;
   const notificationContent=calls.flatMap(call=>[call.title,call.body,call.tag]).filter(value=>typeof value==='string');
   const privateContent=[...messageBodies,privateAuthorContent,privateConversation.name,author.id,author.name,author.email].filter(value=>typeof value==='string'&&value.length>=4);
   for(const content of privateContent)assert.ok(notificationContent.every(value=>!value.includes(content)),'notification content excludes message bodies and private author content');
   check.checks.push('notification content excludes message bodies and private author content');

   await page.reload();
   await page.waitForFunction(()=>document.querySelector('[data-live-connected="true"]'));
   await recordTitleCount('afterReload');
   await leave();await page.waitForTimeout(300);
   assert.equal(await page.evaluate(()=>window.__nookNotificationCalls.length),0,'reload backlog is a baseline');
   check.checks.push('reload establishes a baseline without replaying notifications');
   await owner('/auth/operator/status',{operatorId:receiver.user.id,status:'inactive'});
   await page.waitForURL(url=>url.pathname==='/signin');
   assert.equal(await page.evaluate(()=>document.querySelectorAll('.message').length),0);
   check.checks.push('revocation clears the open client');
  }catch(error){
   failure=error;
  }finally{
   if(context){
    try{await context.close();check.resourcesClosed=true}
    catch(error){failure??=error}
   }else check.resourcesClosed=true;
  }
  check.status=failure?'failed':'passed';
  if(failure){check.failure='journey failed';failures.push(failure)}
  checks.push(check);
  await writeFile(join(destination,'team-notifications.json'),JSON.stringify({checks,observedOSDelivery:false,resourcesClosed:checks.every(result=>result.resourcesClosed)},null,2)+'\n');
 }
 if(failures.length)throw new AggregateError(failures,'Team notification browser journeys failed');
 return {checks,observedOSDelivery:false,resourcesClosed:checks.every(result=>result.resourcesClosed)};
}
