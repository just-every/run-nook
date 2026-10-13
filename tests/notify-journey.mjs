import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {chromium} from '@playwright/test';
import {notifyInstallation} from './notify/install.mjs';
import {people} from './notify/people.mjs';
import {settingsBrowser} from './notify/browser.mjs';
// C14 through public doors: two people's sessions, the real run loop (ChatHub
// alarm) and rer's development outbox as the only mail edge. Optional
// --evidence DIR keeps the screenshots; --axe FILE also runs axe's published source.
const root=resolve(import.meta.dirname,'..'),flag=name=>{const i=process.argv.indexOf(name);return i>0?process.argv[i+1]:undefined;};
const evidence=flag('--evidence')??await mkdtemp(join(tmpdir(),'nook-notify-shots-')),axeSource=flag('--axe')?await readFile(flag('--axe'),'utf8'):null;
const CANARY='NOTIFY-CANARY-7f3a91',FILE_CANARY='notify-canary-7f3a91.txt',QUIET=9_000;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const installation=await notifyInstallation(root);let browser;
const step=name=>console.log('NOTIFY '+name);
try{
 const {signIn,invite}=people(installation),notices=to=>installation.outbox().filter(m=>m.to.includes(to)&&m.text.includes('/notify/off?t='));
 const waitFor=async(check,label,ms=60_000)=>{const deadline=Date.now()+ms;for(;;){const value=await check();if(value)return value;if(Date.now()>deadline)throw Error('Timed out: '+label);await sleep(500);}};
 const about=(to,conversation)=>notices(to).filter(m=>m.text.includes('conversation='+conversation));
 const expectOne=async(to,conversation,label)=>{const [mail]=await waitFor(()=>about(to,conversation).length&&about(to,conversation),label);await sleep(QUIET);assert.equal(about(to,conversation).length,1,label+': exactly one email');return mail;};
 const expectNone=async(to,conversation,label)=>{await sleep(QUIET);assert.equal(about(to,conversation).length,0,label);};
 const sam=await signIn('sam@example.test');
 const setup=await fetch(installation.origin+'/setup',{method:'POST',redirect:'manual',headers:{Origin:installation.origin,cookie:sam.cookie,'Content-Type':'application/x-www-form-urlencoded'},body:'confirm=yes'});assert.equal(setup.status,303,'the owner finishes first-run setup');
 const channel=async name=>(await sam.post('/api/conversations',{name,kind:'channel'})).id;
 const welcome=await channel('Welcome'),rowan=await invite(sam,'Rowan',[welcome]),casey=await invite(sam,'Casey',[welcome]);
 const room=async(name,...members)=>{const id=await channel(name);for(const person of members)await sam.post(`/api/conversations/${id}/members`,{user:person.user.id});return id;};
 const say=(who,conversation,body,extra={})=>who.post(`/api/conversations/${conversation}/messages`,{body,intent:crypto.randomUUID(),...extra});

 step('email starts off');
 const before=await room('Before opt-in',rowan);await say(sam,before,'Rowan, are you there?',{mentions:[rowan.user.id]});
 assert.deepEqual(await rowan.get('/api/notify').then(s=>[s.mentions,s.urgent,s.urgentQuiet,s.address]),[false,false,false,rowan.email]);
 await expectNone(rowan.email,before,'nothing is emailed before a member turns email on');

 browser=await chromium.launch({channel:'chromium'});
 step('settings block, keyboard opt-in and owner line');
 await settingsBrowser({browser,origin:installation.origin,rowan,sam,evidence,axeSource,phase:'settings'});
 assert.equal((await rowan.get('/api/notify')).mentions,true,'the keyboard opt-in reached the server');

 step('mention while away, with a file and canaries');
 const mention=await room('Launch plans',rowan),file=await sam.post(`/api/conversations/${mention}/attachments`,{name:FILE_CANARY,mime:'text/plain',data:Buffer.from('canary bytes').toString('base64')});
 const intent=crypto.randomUUID(),payload={body:`Rowan please review ${CANARY}`,intent,mentions:[rowan.user.id],attachments:[file.id]};
 const sent=await sam.post(`/api/conversations/${mention}/messages`,payload);
 assert.equal((await sam.post(`/api/conversations/${mention}/messages`,payload)).id,sent.id,'an identical retry is the same event');
 const mail=await expectOne(rowan.email,mention,'one email for a mention while away');
 assert.match(mail.subject,/^Sam mentioned you in #Launch plans$/);assert.ok(mail.text.includes(`focus=${sent.id}`),'the email links to the message');

 step('routine follow sends nothing');
 const follow=await room('Follow only',rowan),root=await say(sam,follow,'Thread root');await rowan.post(`/api/messages/${root.id}/follow`,{follow:true});
 await say(sam,follow,'A reply nobody was mentioned in',{parent:root.id});
 assert.ok((await rowan.get('/api/attention')).items.some(item=>item.reason==='thread-follow'),'the follow reached Attention');
 await expectNone(rowan.email,follow,'a routine follow is never emailed');

 step('two mentions fold into one email');
 const pair=await room('Pair',rowan);await say(sam,pair,'First',{mentions:[rowan.user.id]});await say(sam,pair,'First',{mentions:[rowan.user.id]});
 assert.match((await expectOne(rowan.email,pair,'two identical mentions in the window')).subject,/\(\+1 more\)$/);

 step('commitment proposal to the assignee');
 const commit=await room('Commitments',rowan);await sam.post(`/api/conversations/${commit}/outcomes`,{kind:'commitment',body:`Ship the ${CANARY} report`,assignee:rowan.user.id});
 assert.match((await expectOne(rowan.email,commit,'one email for a commitment proposal')).subject,/^Sam asked you to take on a commitment in #Commitments$/);

 step('quiet time and urgent requests');
 await rowan.patch('/api/settings',{dndUntil:Date.now()+3600_000});
 const quiet=await room('Quiet',rowan),urgentOff=await room('Urgent off',rowan),urgentHeld=await room('Urgent held',rowan),urgent={urgent:true,urgentReason:`Numbers ${CANARY}`};
 await say(sam,quiet,'During quiet time',{mentions:[rowan.user.id]});await say(sam,urgentOff,'Urgent before opting in',{mentions:[rowan.user.id],...urgent});
 await expectNone(rowan.email,quiet,'nothing is emailed while quiet time is on');assert.equal(about(rowan.email,urgentOff).length,0,'urgent requests need their own opt-in');
 await rowan.patch('/api/notify',{urgent:true});await say(sam,urgentHeld,'Urgent during quiet time',{mentions:[rowan.user.id],...urgent});
 await expectNone(rowan.email,urgentHeld,'quiet time holds an urgent request unless urgent may come through');
 await rowan.patch('/api/notify',{urgentQuiet:true});
 assert.match((await expectOne(rowan.email,urgentHeld,'urgent through quiet time once chosen')).subject,/^Urgent request from Sam in #Urgent held$/);
 await rowan.patch('/api/settings',{dndUntil:null});await expectOne(rowan.email,quiet,'the held mention arrives when quiet time ends');
 assert.equal(about(rowan.email,urgentOff).length,0,'an event from before the opt-in is never emailed');

 step('removal and deletion before the run loop cancel the email');
 const removed=await room('Removed',rowan);await say(sam,removed,'Before removal',{mentions:[rowan.user.id]});await sam.post(`/api/conversations/${removed}/members`,{user:rowan.user.id,remove:true});
 const deleted=await room('Deleted',rowan),gone=await say(sam,deleted,'Soon deleted',{mentions:[rowan.user.id]});await sam.patch(`/api/messages/${gone.id}`,{delete:true,version:gone.version});
 await expectNone(rowan.email,removed,'removed from the conversation before the email was built');await expectNone(rowan.email,deleted,'message deleted before the email was built');

 step('a refused send retries, shows as not delivered, then succeeds once');
 await casey.patch('/api/notify',{mentions:true});const fault=await room('Fault',rowan,casey);
 await installation.sql("CREATE TRIGGER notify_journey_outbox_refuses BEFORE INSERT ON rer_mail_development_outbox BEGIN SELECT RAISE(ABORT,'refused'); END");
 try{
  await say(rowan,fault,'Casey, can you take this?',{mentions:[casey.user.id]});
  const shown=await waitFor(async()=>(await rowan.get('/api/notify')).notDelivered.find(p=>p.recipient==='Casey'),'the sender sees email not delivered');
  assert.equal(shown.error,'refused');assert.equal(shown.retrying,true);
  const owner=await sam.get('/api/notify');assert.equal(owner.workspace.notDelivered.error,'refused','the owner sees it too');
  await settingsBrowser({browser,origin:installation.origin,rowan,sam,evidence,axeSource,phase:'not-delivered'});
  await waitFor(()=>installation.read("SELECT attempts FROM nook_notify_queue WHERE conversation=? AND attempts>=2",fault).length,'a second scheduled attempt',90_000);
 }finally{await installation.sql('DROP TRIGGER IF EXISTS notify_journey_outbox_refuses');}
 await waitFor(()=>about(casey.email,fault).length,'delivery after the fault clears',120_000);await sleep(QUIET);
 assert.equal(about(casey.email,fault).length,1,'no duplicate after the retries');
 assert.equal((await rowan.get('/api/notify')).notDelivered.length,0,'the not-delivered line clears after success');

 step('restart mid-queue');
 // A queued retry waits across a stop: the queue is in D1 and the alarm resumes it.
 const restart=await room('Restart',casey);
 await installation.sql("CREATE TRIGGER notify_journey_outbox_refuses BEFORE INSERT ON rer_mail_development_outbox BEGIN SELECT RAISE(ABORT,'refused'); END");
 try{await say(sam,restart,'Before the restart',{mentions:[casey.user.id]});await waitFor(()=>installation.read("SELECT 1 FROM nook_notify_queue WHERE conversation=? AND state='retrying'",restart).length,'a queued retry');await installation.stop();}
 finally{await installation.sql('DROP TRIGGER IF EXISTS notify_journey_outbox_refuses');}
 assert.equal(about(casey.email,restart).length,0);await installation.start();
 await expectOne(casey.email,restart,'a restarted Worker loses and duplicates nothing');

 step('deactivation cancels the email');
 const inactive=await room('Inactive',casey);await say(sam,inactive,'Before deactivation',{mentions:[casey.user.id]});const status=await fetch(installation.origin+'/auth/operator/status',{method:'POST',headers:{Origin:installation.origin,'Content-Type':'application/json',cookie:sam.cookie},body:JSON.stringify({operatorId:casey.user.id,status:'inactive'})});assert.equal(status.status,200,'the owner deactivates Casey');
 await expectNone(casey.email,inactive,'nothing is sent to a deactivated member');

 step('turn these off without a session');
 const link=new URL(mail.text.match(/Turn these emails off: (\S+)/)[1]);assert.equal(link.origin,installation.origin);
 const landing=await fetch(link);assert.equal(landing.status,200);assert.match(await landing.text(),/Turn off these emails/);
 assert.equal((await rowan.get('/api/notify')).mentions,true,'opening the link alone changes nothing');
 const off=await fetch(installation.origin+'/notify/off',{method:'POST',headers:{Origin:installation.origin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({t:link.searchParams.get('t')})});
 assert.equal(off.status,200);assert.deepEqual(await rowan.get('/api/notify').then(s=>[s.mentions,s.urgent,s.urgentQuiet]),[false,false,false]);
 const after=await room('After turning off',rowan);await say(sam,after,'Still there?',{mentions:[rowan.user.id]});await expectNone(rowan.email,after,'the next event sends nothing');

 step('no message text or file names in any email');
 const all=installation.outbox().filter(m=>m.text.includes('/notify/off?t='));assert.ok(all.length>=7);
 for(const m of all)assert.ok(!(m.subject+m.text).includes(CANARY)&&!(m.subject+m.text).includes(FILE_CANARY)&&!(m.subject+m.text).includes('notify-canary'),'email carries no message text, file name or urgent reason');
 console.log(`NOTIFY-JOURNEY passed: ${all.length} notification emails through the development outbox; screenshots in ${evidence}`);
}finally{await browser?.close();await installation.close();if(!flag('--evidence'))await rm(evidence,{recursive:true,force:true});}
