import assert from 'node:assert/strict'
import {expect} from '@playwright/test'
import {browserWidths,checkScreen,evidenceDirectory} from './browser-support.mjs'

// NOOK-070 polls at 1440 and 390: create single-choice and multiple-choice anonymous polls as the owner, vote as a member from the same width, watch the counts follow, close one and see the final count.
export async function pollsBrowser({origin,owner,member,room,destination=evidenceDirectory('polls')}){
 await browserWidths(async(width,open)=>{
  const errors=[],manager=await open({cookie:owner.cookie,origin},{errors}),reader=await open({cookie:member.cookie,origin}),url=origin+'/app?conversation='+room.id
  try{
   const {page}=manager,mine=reader.page,named='Which day for the launch review? '+width,anonymous='Which rooms should we book? '+width
   const openPoll=async()=>{await page.getByTitle('Conversation options',{exact:true}).click();await page.getByRole('button',{name:'Create poll',exact:true}).click()};
   await page.goto(url);await openPoll()
   const form=page.getByRole('form',{name:'Create a poll'});await form.getByLabel('Question',{exact:true}).fill(named);await form.getByLabel('Option 1',{exact:true}).fill('Tuesday');await form.getByLabel('Option 2',{exact:true}).fill('Wednesday')
   await form.getByRole('button',{name:'Add option',exact:true}).click();await form.getByLabel('Option 3',{exact:true}).fill('Thursday');await form.getByRole('button',{name:'Remove option 3',exact:true}).click()
   await expect(form.getByLabel('Option 3',{exact:true})).toHaveCount(0)
   await checkScreen(page,destination,'poll-create-'+width,errors)
   await form.getByRole('button',{name:'Post poll',exact:true}).click()
   const card=page.getByRole('region',{name:'Poll: '+named,exact:true});await expect(card).toBeVisible()
   await mine.goto(url);const theirs=mine.getByRole('region',{name:'Poll: '+named,exact:true});await expect(theirs).toBeVisible();await expect(theirs.getByText('Anonymous poll · counts only',{exact:false})).toBeVisible()
   await theirs.getByLabel(/^Wednesday/).check();await theirs.getByRole('button',{name:'Vote',exact:true}).click()
   await expect(theirs.getByRole('button',{name:'Change vote',exact:true})).toBeVisible()
   const started=Date.now();await expect(card.locator('.poll-option').filter({hasText:'Wednesday'}).locator('.poll-count')).toHaveText('1',{timeout:20000});console.log(`POLL live count reached the other open page in ${Date.now()-started} ms at ${width}`)
   await expect(card.locator('.poll-voters')).toHaveCount(0)
   await checkScreen(page,destination,'poll-named-'+width,errors)
   await card.getByRole('button',{name:'Close poll',exact:true}).click();await expect(card.getByText('closed · final count',{exact:false})).toBeVisible();await expect(card.getByRole('button',{name:'Vote'})).toHaveCount(0)
   await mine.reload();await expect(mine.getByRole('region',{name:'Poll: '+named,exact:true}).getByRole('button',{name:/Vote/})).toHaveCount(0)

   await openPoll()
   const second=page.getByRole('form',{name:'Create a poll'});await second.getByLabel('Question',{exact:true}).fill(anonymous);await second.getByLabel('Option 1',{exact:true}).fill('Atrium');await second.getByLabel('Option 2',{exact:true}).fill('Studio')
   await second.getByLabel('Allow several choices').check();await second.getByRole('button',{name:'Post poll',exact:true}).click()
   await mine.reload();const secret=mine.getByRole('region',{name:'Poll: '+anonymous,exact:true});await secret.getByLabel(/^Atrium/).check();await secret.getByLabel(/^Studio/).check();await secret.getByRole('button',{name:'Vote',exact:true}).click()
   await expect(secret.getByRole('button',{name:'Change vote',exact:true})).toBeVisible();await expect(secret.getByText('Anonymous poll · counts only',{exact:false})).toBeVisible();await expect(secret.locator('.poll-voters')).toHaveCount(0)
   await checkScreen(mine,destination,'poll-anonymous-'+width,[])
  }finally{await manager.close();await reader.close()}
 },destination)
}
