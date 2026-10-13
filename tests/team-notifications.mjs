import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {signIn} from './auth-support.mjs';

// C15 replaces the open-tab OS constructor with server Web Push. This browser
// journey retains title-count, quiet-time, reload and revocation checks. No
// provider subscription is created; encrypted delivery has its own public flow.
export async function runTeamNotifications({browser,origin,ownerCookie,destination}){
 await mkdir(destination,{recursive:true});
 const checks=[],failures=[];
 for(const width of [1440,390]){
  const check={width,status:'running',permission:null,displayedNotifications:0,titleCounts:{},checks:[],resourcesClosed:false};
  let context,failure;
  try{
   context=await browser.newContext({viewport:{width,height:900},permissions:[]});
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
   await page.getByRole('region',{name:'Push notifications',exact:true}).waitFor();
   const choices=await context.request.get(origin+'/api/notify');assert.equal((await choices.json()).push.mentions,false);
   check.permission=await page.evaluate(()=>Notification.permission);check.checks.push('push starts off without a permission prompt');
   await page.waitForFunction(()=>document.querySelector('[data-live-connected="true"]'));
   const leave=()=>away.bringToFront();
   await away.goto(origin+'/');await leave();

   const messageBodies=[`Explicit mention body ${stamp}`,`Routine message body ${stamp}`,`Quiet mention body ${stamp}`,`Urgent message body ${stamp}`];
   const privateAuthorContent=`Private urgent context ${stamp}`;
   const send=(body,extra={})=>owner(`/api/conversations/${privateConversation.id}/messages`,{body,intent:crypto.randomUUID(),...extra});
   await send(messageBodies[0],{mentions:[receiver.user.id]});
   await page.waitForTimeout(300);
   assert.equal(await recordTitleCount('afterMention'),1,'the first mention is the sole active attention item');
   check.checks.push('one new mention updates the title without a duplicate local notification');
   await send(messageBodies[1]);await page.waitForTimeout(300);
   assert.equal(await page.evaluate(async()=> (await (await navigator.serviceWorker.ready).getNotifications()).length),0);
   check.checks.push('routine conversation is suppressed');
   const quietSettings=await context.request.patch(origin+'/api/settings',{data:{dndUntil:Date.now()+60000}});
   assert.ok(quietSettings.ok(),'quiet time is accepted');
   await recordTitleCount('afterQuietTime');
   await send(messageBodies[2],{mentions:[receiver.user.id]});await page.waitForTimeout(300);
   assert.equal(await page.evaluate(async()=> (await (await navigator.serviceWorker.ready).getNotifications()).length),0);
   await recordTitleCount('afterQuietMention');
   check.checks.push('quiet mention is suppressed and title matches receiver active attention during quiet time');
   await send(messageBodies[3],{mentions:[receiver.user.id],urgent:true,urgentReason:privateAuthorContent});
   await page.waitForTimeout(300);
   await recordTitleCount('afterUrgent');
   assert.equal(await page.evaluate(async()=> (await (await navigator.serviceWorker.ready).getNotifications()).length),0,'opted-out browser has no local OS notifications');
   check.checks.push('local OS notification path is retired');

   await page.reload();
   await page.waitForFunction(()=>document.querySelector('[data-live-connected="true"]'));
   await recordTitleCount('afterReload');
   await leave();await page.waitForTimeout(300);
   assert.equal(await page.evaluate(async()=> (await (await navigator.serviceWorker.ready).getNotifications()).length),0,'reload does not replay local notifications');
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
