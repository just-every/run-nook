import {importedPreviewFiles} from './file-preview-fixture.mjs'
import {createRequire} from 'node:module'
import {zipFixture} from './slack-import/fixture.mjs'
const require=createRequire(import.meta.url)
import {chromium,expect} from '@playwright/test'
import {mkdir,readFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import assert from 'node:assert/strict'

export async function filesBrowser({origin,owner,member,destination,sql}){
 const base=typeof origin==='function'?origin():origin
 const call=async(path,body,person=owner)=>{
  const response=await fetch(base+path,{method:'POST',headers:{cookie:person.cookie,origin:base,'content-type':'application/json'},body:JSON.stringify(body)})
  assert.equal(response.status,200,await response.clone().text());return response.json()
 }
 const png=await readFile(new URL('../public/icons/nook-192.png',import.meta.url))
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{
  if(destination)await mkdir(destination,{recursive:true})
  for(const width of [1440,390]){
   const context=await browser.newContext({serviceWorkers:'block',viewport:{width,height:width===390?844:1000}})
   try{
    const [name,...value]=member.cookie.split('=');await context.addCookies([{name,value:value.join('='),url:base}])
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text())})
    const room=await call('/api/conversations',{name:'Customer rollout documents '+width,kind:'private',participants:[member.user.id]})
    const uploadPage=await context.newPage();
    try{
     const content=Buffer.alloc(8*1024*1024+17,65),filename='synthetic-nook-resume-'+width+'.zip';let dropped=false,firstParts=0;
     uploadPage.on('request',request=>{if(/\/api\/uploads\/[^/]+\/parts\/1$/.test(new URL(request.url()).pathname))firstParts++});
     await uploadPage.route('**/api/uploads/*/parts/2',async route=>{if(!dropped){dropped=true;await route.abort()}else await route.continue()});
     await uploadPage.goto(base+'/app?conversation='+room.id);
     const interrupted=uploadPage.waitForEvent('requestfailed',{predicate:request=>/\/api\/uploads\/[^/]+\/parts\/2$/.test(new URL(request.url()).pathname)});
     await uploadPage.getByLabel('Attach file',{exact:true}).setInputFiles({name:filename,mimeType:'application/zip',buffer:content});
     await interrupted;await expect(uploadPage.getByRole('button',{name:'Retry upload',exact:true})).toBeEnabled();assert.equal(dropped,true);
     if(destination)await uploadPage.screenshot({path:resolve(destination,`upload-interrupted-${width}.png`),fullPage:true});
     await uploadPage.reload();await uploadPage.getByLabel('Attach file',{exact:true}).setInputFiles({name:filename,mimeType:'application/zip',buffer:content});
     await uploadPage.getByRole('button',{name:'Retry upload',exact:true}).click();
     await expect(uploadPage.locator('.staged-files')).toContainText(filename);assert.equal(firstParts,1,'reload resumes after the stored first part');
     await uploadPage.getByRole('textbox',{name:'Message '+room.name,exact:true}).fill('synthetic-nook resumed upload '+width);await uploadPage.getByRole('button',{name:'Send',exact:true}).click();
     await expect(uploadPage.locator('.file-row a[download="'+filename+'"]')).toBeVisible();
     await uploadPage.addScriptTag({content:await readFile(require.resolve('axe-core/axe.min.js'),'utf8')});
     const serious=await uploadPage.evaluate(async()=>(await axe.run()).violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>v.id));assert.deepEqual(serious,[]);
     if(destination)await uploadPage.screenshot({path:resolve(destination,`upload-resumed-${width}.png`),fullPage:true});
     dropped=false;const expiredName='synthetic-nook-expired-'+width+'.zip';
     const declared=uploadPage.waitForResponse(response=>new URL(response.url()).pathname==='/api/conversations/'+room.id+'/uploads'&&response.request().method()==='POST');
     const expiredInterrupted=uploadPage.waitForEvent('requestfailed',{predicate:request=>/\/api\/uploads\/[^/]+\/parts\/2$/.test(new URL(request.url()).pathname)});
     await uploadPage.getByLabel('Attach file',{exact:true}).setInputFiles({name:expiredName,mimeType:'application/zip',buffer:content});const expired=(await(await declared).json());await expiredInterrupted;await expect(uploadPage.getByRole('button',{name:'Retry upload',exact:true})).toBeEnabled();
     await sql(`UPDATE nook_attachments SET expires=0 WHERE id='${expired.id}'`);await sql(`UPDATE nook_multipart_uploads SET expires=0 WHERE attachment='${expired.id}'`);
     const cleanup=await call('/api/conversations/'+room.id+'/attachments',{name:'synthetic-nook-expiry-cleanup.txt',mime:'text/plain',data:Buffer.from('cleanup').toString('base64'),intent:crypto.randomUUID()},member);
     await uploadPage.reload();await uploadPage.getByLabel('Attach file',{exact:true}).setInputFiles({name:expiredName,mimeType:'application/zip',buffer:content});await uploadPage.getByRole('button',{name:'Retry upload',exact:true}).click();await expect(uploadPage.getByRole('alert')).toContainText('Upload expired');
     await uploadPage.addScriptTag({content:await readFile(require.resolve('axe-core/axe.min.js'),'utf8')});assert.deepEqual(await uploadPage.evaluate(async()=>(await axe.run()).violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>v.id)),[]);
     if(destination)await uploadPage.screenshot({path:resolve(destination,`upload-expired-${width}.png`),fullPage:true});
     await uploadPage.getByRole('button',{name:'Discard upload',exact:true}).click();const removed=await context.request.patch(base+'/api/attachments/'+cleanup.id,{headers:{Origin:base},data:{delete:true}});assert.equal(removed.status(),200);

    }finally{await uploadPage.close()}
    const notes='Thursday rollout\nCustomer success briefing: 09:00\nSupport handoff: 09:30\nLaunch owner: Elena\n'
    const document=await call(`/api/conversations/${room.id}/attachments`,{name:(width===1440?'east':'west')+'-coast-rollout-checklist.txt',mime:'text/plain',data:Buffer.from(notes).toString('base64'),intent:crypto.randomUUID()})
    const root=await call(`/api/conversations/${room.id}/messages`,{body:'Here is the customer rollout checklist. Please review the support handoff before Thursday.',attachments:[document.id],intent:crypto.randomUUID()})
    const image=await call(`/api/conversations/${room.id}/attachments`,{name:(width===1440?'east':'west')+'-coast-launch-icon.png',mime:'image/png',data:png.toString('base64'),intent:crypto.randomUUID()},member)
    const reply=await call(`/api/conversations/${room.id}/messages`,{body:'The Nook icon for the launch briefing is attached.',parent:root.id,attachments:[image.id],intent:crypto.randomUUID()},member)
    const inert=[];for(const [name,mime,bytes] of [['synthetic-nook-data.csv','text/plain','name,value\nsynthetic,<img src=x onerror=alert(1)>'],['synthetic-nook-long.txt','text/plain','const label = "synthetic";\n'.repeat(4000)]]){const file=await call(`/api/conversations/${room.id}/attachments`,{name,mime,data:Buffer.from(bytes).toString('base64'),intent:crypto.randomUUID()});inert.push(file)}await call(`/api/conversations/${room.id}/messages`,{body:'Synthetic inert preview samples',attachments:inert.map(file=>file.id),intent:crypto.randomUUID()})
    const imported=await importedPreviewFiles({origin:base,owner,member,files:[{name:'synthetic-nook-archive.zip',bytes:zipFixture([['<img src=x onerror=alert(1)>.txt','Private content']])}]});inert.push(imported.files[0])
    await page.goto(base+'/app?view=you');await expect(page.locator('.nook-app')).toHaveAttribute('data-live-connected','true');if(destination)await page.screenshot({animations:'disabled',path:resolve(destination,`you-${width}.png`)});await page.locator('.profile-page').getByRole('button',{name:'Files',exact:true}).click()
    const textCard=page.getByRole('article',{name:'File '+document.name,exact:true}),imageCard=page.getByRole('article',{name:'File '+image.name,exact:true})
    await expect(textCard).toBeVisible();await expect(imageCard.getByRole('img',{name:image.name,exact:true})).toBeVisible()
    await page.getByText('Filters',{exact:true}).click();await page.getByLabel('Conversation',{exact:true}).selectOption(room.id)
    await expect(textCard).toBeVisible();await expect(imageCard).toBeVisible()
    if(destination)await page.screenshot({animations:'disabled',path:resolve(destination,`files-${width}.png`)})
    await page.getByLabel('Conversation',{exact:true}).selectOption('')
    for(const file of [document,...inert]){const card=page.getByRole('article',{name:'File '+file.name,exact:true});await card.getByText('Preview '+file.name,{exact:true}).click();await expect(card.getByRole('textbox')).toHaveCount(0);await expect(card.getByLabel('Preview of '+file.name,{exact:true})).toBeVisible();if(file.name.endsWith('.csv')||file.name.endsWith('.zip')){await expect(card.getByLabel('Preview of '+file.name,{exact:true})).toContainText('<img src=x onerror=alert(1)>');await expect(card.locator('img')).toHaveCount(0)}if(file.name==='synthetic-nook-long.txt')await expect(card.getByRole('status')).toContainText('Truncated preview')}
    await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});assert.deepEqual(await page.evaluate(async()=>{const r=await window.axe.run(document.querySelector('.page-content'));return r.violations.filter(v=>['serious','critical'].includes(v.impact))}),[]);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.equal(await page.evaluate(()=>window.__rerHydration?.count??0),0)
    const zipCard=page.getByRole('article',{name:'File synthetic-nook-archive.zip',exact:true});await zipCard.scrollIntoViewIfNeeded();if(destination)await page.screenshot({animations:'disabled',path:resolve(destination,`inert-previews-${width}.png`)})
    await page.getByLabel('Conversation',{exact:true}).selectOption(room.id)
    await page.getByLabel('File type',{exact:true}).selectOption('text')
    await expect(textCard).toBeVisible();await expect(imageCard).toHaveCount(0)
    if(destination)await page.screenshot({animations:'disabled',path:resolve(destination,`text-${width}.png`)})
    const downloaded=page.waitForEvent('download');await textCard.getByRole('link',{name:document.name,exact:true}).click()
    const download=await downloaded;assert.equal(download.suggestedFilename(),document.name)
    const chunks=[];for await(const chunk of await download.createReadStream())chunks.push(chunk)
    assert.equal(Buffer.concat(chunks).toString(),notes)
    await page.getByLabel('File type',{exact:true}).selectOption('')
    await page.getByLabel('Person',{exact:true}).selectOption('me')
    await expect(imageCard).toBeVisible();await expect(textCard).toHaveCount(0)
    if(destination)await page.screenshot({animations:'disabled',path:resolve(destination,`mine-${width}.png`)})
    await imageCard.getByRole('button',{name:'Open in conversation',exact:true}).click()
    await expect(page).toHaveURL(new RegExp('conversation='+room.id));await expect(page).toHaveURL(new RegExp('thread='+root.id))
    await expect(page.getByText(reply.body,{exact:true})).toBeVisible()
    if(destination)await page.screenshot({animations:'disabled',path:resolve(destination,`message-context-${width}.png`)})
    await page.getByRole('navigation',{name:'Conversation content',exact:true}).getByRole('button',{name:'Files',exact:true}).click()
    await expect(textCard).toBeVisible();await expect(imageCard).toBeVisible()
    await expect(page).toHaveURL(new RegExp('view=chat&conversation='+room.id+'&panel=files'))
    await expect(page.getByRole('heading',{name:room.name,exact:true})).toBeVisible()
    await expect(page.getByRole('navigation',{name:'Conversation content',exact:true}).getByRole('button',{name:'Files',exact:true})).toHaveAttribute('aria-pressed','true')
    await expect(page.getByRole('navigation',{name:'Conversation content',exact:true}).getByRole('button',{name:'Messages',exact:true})).toHaveAttribute('aria-pressed','false')
    await page.reload();await expect(textCard).toBeVisible();await expect(imageCard).toBeVisible()
    await expect(page.getByLabel('Conversation',{exact:true})).toHaveCount(0)
    if(destination)await page.screenshot({animations:'disabled',path:resolve(destination,`conversation-${width}.png`)})
    const viewport=await page.evaluate(()=>({width:innerWidth,content:document.documentElement.scrollWidth}))
    assert.ok(viewport.content<=viewport.width+1,'Files view should fit the viewport')
    // Settle navigation before changing two scopes. Keeping the old Files view
    // alive between writes legitimately starts denied preview/list/replay reads.
    const protectedFilesURL=page.url();await page.goto(base+'/app?view=you');await expect(page.locator('.profile-page')).toBeVisible()
    await call(`/api/conversations/${room.id}/members`,{user:member.user.id,remove:true});await call(`/api/conversations/${imported.conversation}/members`,{user:member.user.id,remove:true})
    await page.goto(protectedFilesURL);await expect(textCard).toHaveCount(0);await expect(imageCard).toHaveCount(0);await expect(page.getByRole('navigation',{name:'Conversation content',exact:true})).toHaveCount(0)
    if(destination)await page.screenshot({animations:'disabled',path:resolve(destination,`unavailable-${width}.png`)})
    await page.goto(base+'/app?view=files');await page.getByText('Filters',{exact:true}).click();await expect(page.getByLabel('File type',{exact:true})).toBeVisible()
    await expect(textCard).toHaveCount(0);await expect(imageCard).toHaveCount(0)
    if(destination)await page.screenshot({animations:'disabled',path:resolve(destination,`revoked-${width}.png`)})
    // Separately prove live withdrawal without reloading the protected view.
    // HTTP authorization refusals on this page are expected; script failures are not.
    const liveRoom=await call('/api/conversations',{name:'Synthetic live file access '+width,kind:'private',participants:[member.user.id]})
    const liveFile=await call(`/api/conversations/${liveRoom.id}/attachments`,{name:'synthetic-nook-live-access-'+width+'.txt',mime:'text/plain',data:Buffer.from('Synthetic live file custody').toString('base64'),intent:crypto.randomUUID()})
    await call(`/api/conversations/${liveRoom.id}/messages`,{body:'Synthetic live file access control',attachments:[liveFile.id],intent:crypto.randomUUID()})
    const livePage=await context.newPage();livePage.on('pageerror',error=>errors.push(error.message))
    try{await livePage.goto(base+'/app?view=files&conversation='+liveRoom.id);const liveCard=livePage.getByRole('article',{name:'File '+liveFile.name,exact:true});await expect(liveCard).toBeVisible();await expect(livePage).toHaveURL(new RegExp('view=chat&conversation='+liveRoom.id+'&panel=files'));await expect(livePage.locator('.nook-app')).toHaveAttribute('data-live-connected','true');await call(`/api/conversations/${liveRoom.id}/members`,{user:member.user.id,remove:true});await expect(liveCard).toHaveCount(0);if(destination)await livePage.screenshot({animations:'disabled',path:resolve(destination,`live-revoked-${width}.png`)})}finally{await livePage.close()}
    if(width===1440){
     for(const [path,target] of [['/settings','/app?view=you'],['/app/settings','/app?view=you'],['/app/channels','/app?view=channels'],['/app/people','/app?view=people'],['/login','/signin'],['/sign-in','/signin']]){
      const response=await page.request.get(base+path,{maxRedirects:0});assert.equal(response.status(),307);assert.equal(response.headers().location,target)
     }
     for(const path of ['/x','/app/x'])assert.equal((await page.request.get(base+path)).status(),404)
     const signedOut=await browser.newContext({serviceWorkers:'block'})
     try{for(const path of ['/settings','/app/settings','/app/channels','/app/people']){const response=await signedOut.request.get(base+path);assert.equal(new URL(response.url()).pathname,'/signin','aliases retain the sign-in gate')}}finally{await signedOut.close()}

    }
    assert.deepEqual(errors,[])
   }finally{await context.close()}
  }
 }finally{await browser.close()}
}
