import {join} from 'node:path';
const evidence=join(process.env.NOOK_EVIDENCE_DIR??'evidence','notes');
import {chromium,expect} from '@playwright/test';import {mkdir} from 'node:fs/promises';
export async function notesBrowser({origin,ana,room,note,root,threadNote}){
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
 try{await mkdir(evidence,{recursive:true});for(const width of [1440,390]){
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width,height:width===390?844:1000}});
  try{const [name,...v]=ana.cookie.split('=');await context.addCookies([{name,value:v.join('='),url:origin}]);const page=await context.newPage();await page.goto(origin+`/app?conversation=${room.id}&panel=notes`);
   const panel=page.getByRole('region',{name:'Conversation notes'});await expect(panel).toBeVisible();const autosaved=async()=>{await page.waitForTimeout(1500);await expect(panel.getByText('Saved',{exact:true})).toBeVisible()};await panel.getByRole('button',{name:new RegExp(note.title)}).click();await expect(panel.getByRole('heading',{name:note.title,exact:true})).toBeVisible();await expect(panel.getByText('Link, not synced',{exact:false})).toBeVisible();await panel.getByRole('button',{name:'Version history',exact:true}).click();await expect(panel.getByRole('region',{name:'Note version history'})).toBeVisible();await page.screenshot({animations:'disabled',path:`${evidence}/channel-${width}.png`});
   await panel.getByRole('button',{name:'New note',exact:true}).click();await expect(panel.getByLabel('Title',{exact:true})).toBeFocused();await panel.getByLabel('Title',{exact:true}).fill('Customer contacts '+width);await panel.getByLabel('Note',{exact:true}).fill('Coverage for the Thursday customer launch.');await panel.getByRole('button',{name:'Add checklist item'}).click();await panel.getByLabel('Checklist item 1',{exact:true}).fill('Confirm escalation contact');await panel.getByRole('checkbox',{name:'Pin in this conversation'}).check();await autosaved();await panel.getByRole('button',{name:'All notes',exact:true}).click();await panel.getByRole('button',{name:new RegExp('Customer contacts '+width)}).click();await expect(panel.getByRole('heading',{name:'Customer contacts '+width})).toBeVisible();await panel.getByRole('button',{name:'Edit note',exact:true}).click();await expect(panel.getByLabel('Title',{exact:true})).toBeFocused();await panel.getByLabel('Note',{exact:true}).fill('Escalation coverage confirmed by the support team.');await autosaved();await panel.getByRole('button',{name:'All notes',exact:true}).click();await panel.getByRole('button',{name:new RegExp('Customer contacts '+width)}).click();await expect(panel.getByText('Escalation coverage confirmed by the support team.',{exact:true})).toBeVisible();await panel.getByRole('checkbox',{name:'Confirm escalation contact',exact:true}).click();await expect(panel.getByRole('checkbox',{name:'Confirm escalation contact',exact:true})).toBeChecked();await page.screenshot({animations:'disabled',path:`${evidence}/edit-${width}.png`});
   await page.goto(origin+`/app?conversation=${room.id}&thread=${root.id}&panel=notes`);const thread=page.getByRole('region',{name:'Thread notes'});await expect(thread).toBeVisible();await thread.getByRole('button',{name:new RegExp(threadNote.title)}).click();await expect(thread.getByRole('heading',{name:threadNote.title,exact:true})).toBeVisible();await page.screenshot({animations:'disabled',path:`${evidence}/thread-${width}.png`});
   if(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth))throw Error('Notes overflow viewport');
  }finally{await context.close()}
 }}finally{await browser.close()}
}
// After the original author is erased, a remaining member still sees the shared content and history.
export async function erasedNotesBrowser({origin,lee,room,shared}){
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
 try{for(const width of [1440,390]){
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width,height:width===390?844:1000}});
  try{const [name,...v]=lee.cookie.split('=');await context.addCookies([{name,value:v.join('='),url:origin}]);const page=await context.newPage();await page.goto(origin+`/app?conversation=${room.id}&panel=notes`);
   const panel=page.getByRole('region',{name:'Conversation notes'});await panel.getByRole('button',{name:new RegExp(shared.title)}).click();await expect(panel.getByText(shared.body,{exact:true})).toBeVisible();await expect(panel.getByText(/^Pinned by a former member/)).toBeVisible();
   await panel.getByRole('button',{name:'Version history',exact:true}).click();const history=panel.getByRole('region',{name:'Note version history'});await expect(history.getByText(/^Version 1 · Former member/)).toBeVisible();await expect(history.getByText(/^Version 2 · Lee-Chen/)).toBeVisible();await page.screenshot({animations:'disabled',path:`${evidence}/erased-author-${width}.png`});await history.evaluate(el=>el.scrollIntoView({block:'center'}));await page.screenshot({animations:'disabled',path:`${evidence}/erased-history-${width}.png`});
   if(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth))throw Error('Notes overflow viewport');
  }finally{await context.close()}
 }}finally{await browser.close()}
}

export async function memberErasurePreview({origin,ownerCookie}){
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});
 try{for(const width of [1440,390]){
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width,height:width===390?844:1000}});
  try{const [name,...v]=ownerCookie.split('=');await context.addCookies([{name,value:v.join('='),url:origin}]);const page=await context.newPage();await page.goto(origin+'/app?view=team');
   await page.getByText('About erasing people',{exact:true}).click();await expect(page.getByText(/Shared notes keep their content and history as Former member/)).toBeVisible();await page.getByText(/Shared notes keep their content and history as Former member/).evaluate(el=>el.scrollIntoView({block:'center'}));await page.screenshot({animations:'disabled',path:`${evidence}/member-policy-${width}.png`});
   const member=page.locator('.team-people li').filter({hasText:'Ana-Martinez'});await member.getByRole('button',{name:'Erase member',exact:true}).click();const dialog=page.getByRole('dialog');await expect(dialog.getByLabel('Type ERASE to confirm')).toBeVisible();await dialog.getByText('What erasing removes',{exact:true}).click();await expect(dialog.getByText(/Shared notes keep their content and history as Former member/)).toBeVisible();await page.screenshot({animations:'disabled',path:`${evidence}/member-preview-${width}.png`});
   if(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth))throw Error('Erasure preview overflows viewport');await page.keyboard.press('Escape');
  }finally{await context.close()}
 }}finally{await browser.close()}
}
