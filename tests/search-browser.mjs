import {chromium,expect} from '@playwright/test'
import {mkdir} from 'node:fs/promises'
import {resolve} from 'node:path'
import assert from 'node:assert/strict'
import {searchPdf} from './search.mjs'
export async function searchBrowser({origin,owner,member,destination}){
 const base=typeof origin==='function'?origin():origin
 const call=async(path,body)=>{const r=await fetch(base+path,{method:'POST',headers:{cookie:owner.cookie,origin:base,'content-type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,200,await r.clone().text());return r.json()}
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{
  if(destination)await mkdir(destination,{recursive:true})
  for(const width of [1440,390]){
   const context=await browser.newContext({serviceWorkers:'block',viewport:{width,height:width===390?844:1000},timezoneId:'America/New_York'})
   try{
    const [name,...value]=member.cookie.split('=');await context.addCookies([{name,value:value.join('='),url:base}])
    const room=await call('/api/conversations',{name:'Customer success launch '+width,kind:'private',participants:[member.user.id]})
    const file=await call(`/api/conversations/${room.id}/attachments`,{name:'Customer-success-Q3-brief.pdf',mime:'application/pdf',data:searchPdf('Customer success handoff: PO 5k. HR approved the Q3 rollout.').toString('base64'),intent:crypto.randomUUID()})
    const root=await call(`/api/conversations/${room.id}/messages`,{body:'The signed launch brief and support handoff are ready for review.',attachments:[file.id],intent:crypto.randomUUID()})
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
    await page.goto(base+'/app?view=search&q='+encodeURIComponent(`"Customer success handoff" in:#${room.id} has:file`))
    const result=page.locator('.search-result').filter({hasText:file.name})
    await expect(result).toBeVisible();await expect(result).toContainText('PO 5k')
    await expect(page.getByRole('button',{name:'Remove filter has:file',exact:true})).toBeVisible()
    if(destination)await page.screenshot({animations:'disabled',path:resolve(destination,`file-text-${width}.png`)})
    await page.getByRole('button',{name:'Remove filter has:file',exact:true}).click();await expect(result).toBeVisible()
    await page.getByLabel('Search conversations',{exact:true}).fill('HR Q3 -draft')
    await page.getByText('Filters',{exact:true}).click()
    await page.getByLabel('Conversation type',{exact:true}).selectOption('private')
    await page.locator('.search-form').getByRole('button',{name:'Search',exact:true}).click()
    await expect(result).toBeVisible()
    await page.getByText('Filters',{exact:true}).click()
    if(destination)await page.screenshot({animations:'disabled',path:resolve(destination,`filters-${width}.png`)})
    await result.getByRole('button',{name:'Open in conversation',exact:true}).click()
    await expect(page).toHaveURL(new RegExp('focus='+root.id));await expect(page.getByRole('complementary',{name:'Thread',exact:true}).getByText(root.body,{exact:true})).toBeVisible()
    await page.goto(base+'/app?view=search&q='+encodeURIComponent('"missing quotation'))
    await expect(page.getByRole('alert')).toContainText('Close the quoted search phrase')
    if(destination)await page.screenshot({animations:'disabled',path:resolve(destination,`query-error-${width}.png`)})
    await page.goto(base+'/app?view=search&q='+encodeURIComponent(`"Customer success handoff"`))
    await expect(result).toBeVisible()
    await call(`/api/conversations/${room.id}/members`,{user:member.user.id,remove:true})
    await page.reload();await expect(result).toHaveCount(0)
    if(destination)await page.screenshot({animations:'disabled',path:resolve(destination,`revoked-${width}.png`)})
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[])
   }finally{await context.close()}
  }
 }finally{await browser.close()}
}

export async function aiSearchBrowser({origin,owner,member,room,revokedFilename,app,edge,destination}){
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
 try{await mkdir(destination,{recursive:true});for(const width of [1440,390]){const context=await browser.newContext({serviceWorkers:'block',viewport:{width,height:width===390?844:1000}});try{
  const setCookie=async cookie=>{const at=cookie.indexOf('=');await context.clearCookies();await context.addCookies([{name:cookie.slice(0,at),value:cookie.slice(at+1),url:origin}])};await setCookie(member.cookie);let page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/app?view=search&q=release');const section=page.getByRole('region',{name:'Ask with cited evidence'});await expect(section.getByRole('button',{name:'Ask AI search',exact:true})).toBeDisabled();await section.getByLabel('Question',{exact:true}).fill('What does the release evidence say?');await expect(section.getByRole('button',{name:'Ask AI search',exact:true})).toBeEnabled();await section.scrollIntoViewIfNeeded();await page.screenshot({path:resolve(destination,`ask-${width}.png`),animations:'disabled'});await section.getByRole('button',{name:'Ask AI search',exact:true}).click();const answer=section.getByRole('region',{name:'AI search answer'});await expect(answer).toContainText('Answered by');await expect(answer).toContainText('5 November');assert.equal(await answer.locator('a[href^="http"]').count(),0);assert.equal(await answer.locator('script').count(),0);await answer.scrollIntoViewIfNeeded();await page.screenshot({path:resolve(destination,`cited-answer-${width}.png`),animations:'disabled'});await answer.getByRole('button',{name:'Give feedback',exact:true}).first().click();await section.getByLabel('Feedback or correction').fill('Confirm the date before sharing the release note.');await section.getByRole('button',{name:'Save feedback',exact:true}).click();await expect(section).toContainText('Feedback saved separately');await answer.getByRole('button',{name:'Open original',exact:true}).first().click();await expect(page).toHaveURL(/focus=/);
  await page.goto(origin+'/app?view=search&q=release');await section.getByLabel('Question',{exact:true}).fill('What does the release evidence say?');
  edge.mode='unavailable';edge.during=()=>app.call('/api/conversations/'+room.id+'/members','POST',{user:member.user.id,remove:true},owner.cookie);
  const failedResponse=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/ai-search'&&r.request().method()==='POST');
  await section.getByRole('button',{name:'Ask AI search',exact:true}).click();const failed=await (await failedResponse).json();assert.equal(failed.state,'unavailable');assert.ok(!JSON.stringify(failed).includes(revokedFilename));
  await expect(answer).toBeVisible();await expect(answer.locator('.search-result')).toHaveCount(0);await expect(answer).not.toContainText(revokedFilename);await answer.scrollIntoViewIfNeeded();await page.screenshot({path:resolve(destination,`provider-failure-revoked-${width}.png`),animations:'disabled'});
  await app.call('/api/conversations/'+room.id+'/members','POST',{user:member.user.id},owner.cookie);edge.mode='normal';
  await page.goto(origin+'/app?view=search&q=bounded-search');await section.getByLabel('Question',{exact:true}).fill('What support was found?');edge.mode='unsupported';
  const boundedResponse=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/ai-search'&&r.request().method()==='POST');await section.getByRole('button',{name:'Ask AI search',exact:true}).click();const bounded=await(await boundedResponse).json();assert.equal(bounded.scope,'searched-passages');assert.equal(bounded.more,true);assert.equal(bounded.state,'abstain');await expect(answer).toContainText(bounded.message);await expect(answer.locator('.search-result')).toHaveCount(0);await answer.scrollIntoViewIfNeeded();await page.screenshot({path:resolve(destination,`bounded-abstention-${width}.png`),animations:'disabled'});edge.mode='normal';
  await page.close();await setCookie(owner.cookie);page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/app?view=team');const settings=page.getByRole('region',{name:'AI search settings',exact:true});await expect(settings).toBeVisible();await expect(settings.getByLabel('Provider key',{exact:true})).toHaveValue('');await settings.getByLabel('Daily call cap',{exact:true}).fill('80');await settings.getByRole('button',{name:'Save AI search settings',exact:true}).click();await expect(settings).toContainText('AI search settings saved');await settings.scrollIntoViewIfNeeded();await page.screenshot({path:resolve(destination,`owner-settings-${width}.png`),animations:'disabled'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
 }finally{await context.close()}}}finally{await browser.close()}
}

export async function recapBrowser({app,edge,room,member,owner,first,reply,omitted,omissions,inaccessibleName,destination}){
 const {origin,call}=app,browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});await mkdir(destination,{recursive:true});
 try{for(const width of [1440,390]){const context=await browser.newContext({serviceWorkers:'block',viewport:{width,height:width===390?844:1000}});try{
  const at=member.cookie.indexOf('=');await context.addCookies([{name:member.cookie.slice(0,at),value:member.cookie.slice(at+1),url:origin}]);const page=await context.newPage(),errors=[];let revocationExpected=false;page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!(revocationExpected&&/status of (403|404)/.test(m.text())))errors.push(m.text())});
  await page.goto(origin+'/app?conversation='+room.id);await page.getByRole('button',{name:'Recap this conversation',exact:true}).click();const panel=page.getByRole('region',{name:'Conversation recap'});await expect(panel.getByRole('button',{name:'Ask for recap',exact:true})).toBeEnabled();await page.screenshot({path:resolve(destination,`ask-${width}.png`),animations:'disabled'});
  const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/recaps'&&r.request().method()==='POST');await panel.getByRole('button',{name:'Ask for recap',exact:true}).click();const delivered=await(await response).json(),answer=panel.getByRole('region',{name:'Cited recap'});await expect(answer).toContainText('Cited recap');await expect(answer.getByRole('link',{name:'Open original'}).first()).toBeVisible();await expect(answer).toContainText('Proposal');await expect(answer).toContainText('Accepted obligation');await expect(answer).toContainText('not verified');const rangeTimes=await page.evaluate(range=>[range.from,range.through].map(at=>new Date(at).toLocaleString()),delivered.range);for(const at of rangeTimes)await expect(answer).toContainText(at);await expect(answer).toContainText(delivered.notice);
  const question=answer.locator('article').filter({hasText:reply.body});await expect(question.getByText(/^Unresolved question/)).toBeVisible();await expect(question.locator('blockquote')).toHaveText(reply.body);
  await expect(answer.getByText(new RegExp('^Omitted within this authorized range: '+omitted+'\\.'))).toBeVisible();for(const file of omissions)await expect(answer.getByText(file.name+': '+file.status,{exact:true})).toBeVisible();await expect(answer).not.toContainText(inaccessibleName);await answer.getByText(omissions[0].name+': '+omissions[0].status,{exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:resolve(destination,`omissions-${width}.png`),animations:'disabled'});
  assert.ok(await panel.evaluate(el=>el.scrollWidth<=el.clientWidth+1));await answer.locator('blockquote').first().scrollIntoViewIfNeeded();await page.screenshot({path:resolve(destination,`cited-${width}.png`),animations:'disabled'});
  await answer.getByRole('button',{name:'Correct claim',exact:true}).first().click();await panel.getByLabel('Your correction',{exact:true}).fill('Confirm the handoff with the release lead.');await panel.getByRole('button',{name:'Save correction',exact:true}).click();await expect(panel).toContainText('Your correction: Confirm the handoff');await page.screenshot({path:resolve(destination,`correction-${width}.png`),animations:'disabled'});await answer.getByRole('button',{name:'Dismiss recap',exact:true}).click();await expect(panel).toContainText('Recap dismissed');await expect(answer).toHaveCount(0);
  await panel.getByRole('button',{name:'Ask for recap',exact:true}).click();await expect(answer).toContainText('Cited recap');const original=answer.getByRole('link',{name:'Open original'}).first();await original.click();await expect(page).toHaveURL(/focus=/);await page.goto(origin+'/app?conversation='+room.id+'&thread='+first.id);await page.getByRole('button',{name:'Recap this conversation',exact:true}).click();await page.screenshot({path:resolve(destination,`thread-door-${width}.png`),animations:'disabled'});await panel.getByLabel('Recap range',{exact:true}).selectOption('thread');await panel.getByRole('button',{name:'Ask for recap',exact:true}).click();await expect(answer).toContainText('Cited recap');
  // Removal happens inside the provider await; the rendered result must contain
  // no claim from the earlier authorized range.
  revocationExpected=true;edge.during=()=>call('/api/conversations/'+room.id+'/members','POST',{user:member.user.id,remove:true},owner.cookie);
  const refusal=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/recaps'&&r.request().method()==='POST');await panel.getByRole('button',{name:'Ask for recap',exact:true}).click();assert.equal((await refusal).status(),404);await expect(answer).toHaveCount(0);await expect(page.getByText('Recap unavailable',{exact:true}).or(page.getByRole('alert').filter({hasText:'This conversation is unavailable'}))).toBeVisible();await page.goto(origin+'/app?conversation='+room.id);await expect(page.getByRole('alert').filter({hasText:'This conversation is unavailable'})).toBeVisible();await expect(page.getByText('Loading conversation…',{exact:true})).toHaveCount(0);await page.screenshot({path:resolve(destination,`refused-${width}.png`),animations:'disabled'});await call('/api/conversations/'+room.id+'/members','POST',{user:member.user.id},owner.cookie);
  await page.addScriptTag({path:resolve('node_modules/axe-core/axe.min.js')});const violations=await page.evaluate(async()=> (await axe.run(document)).violations.filter(v=>['serious','critical'].includes(v.impact)));assert.deepEqual(violations,[]);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
 }finally{await context.close()}}}finally{await browser.close()}
}
