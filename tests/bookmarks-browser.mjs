import {expect} from '@playwright/test'
import {browserWidths,checkScreen,evidenceDirectory} from './browser-support.mjs'

// NOOK-070 bookmarks at 1440 and 390: a member who may post adds a link, a folder and a file, reorders and removes; a restricted member sees the bar and the reason, not the controls.
export async function bookmarksBrowser({origin,manager,restricted,room,file,destination=evidenceDirectory('bookmarks')}){
 await browserWidths(async(width,open)=>{
  const errors=[],admin=await open({cookie:manager.cookie,origin},{errors}),reader=await open({cookie:restricted.cookie,origin}),url=origin+'/app?conversation='+room.id
  try{
   const {page}=admin,dialog=page.getByRole('dialog')
   await page.goto(url);await page.locator('summary[aria-label="Conversation options"]').click();await page.getByRole('button',{name:'Channel bookmarks',exact:true}).click()
   const add=async(kind,title,extra)=>{const form=dialog.getByRole('form',{name:'Add a bookmark'});await form.getByLabel('Kind',{exact:true}).selectOption(kind);await form.getByLabel('Title',{exact:true}).fill(title);await extra?.(form);await form.getByRole('button',{name:'Add bookmark',exact:true}).click();await expect(dialog.getByRole('list',{name:'Bookmarks'}).getByText(title,{exact:true})).toBeVisible()}
   await add('link','Brief '+width,form=>form.getByLabel('Web address',{exact:true}).fill('https://docs.example.test/brief'))
   await add('folder','Customer '+width)
   await add('link','FAQ '+width,async form=>{await form.getByLabel('Web address',{exact:true}).fill('https://docs.example.test/faq');await form.getByLabel('Put it in',{exact:true}).selectOption({label:'Customer '+width})})
   await add('file','Plan '+width,form=>form.getByLabel('File',{exact:true}).selectOption({label:file.name}))
   await dialog.getByRole('button',{name:'Move later: Brief '+width,exact:true}).click()
   await expect.poll(async()=>{const names=await dialog.getByRole('list',{name:'Bookmarks'}).locator('.bookmark-name strong').allTextContents();return names.indexOf('Customer '+width)<names.indexOf('Brief '+width)}).toBe(true)
   await checkScreen(page,destination,'bookmarks-dialog-'+width,errors)
   await dialog.getByRole('button',{name:'Close dialog',exact:true}).click()
   const bar=page.getByRole('navigation',{name:'Channel bookmarks'});await expect(bar.getByRole('link',{name:'Brief '+width,exact:true})).toHaveAttribute('href','https://docs.example.test/brief');await expect(bar.getByRole('link',{name:'Plan '+width,exact:true})).toHaveAttribute('href',new RegExp('/api/attachments/'+file.id+'/download'))
   await bar.getByText('Customer '+width,{exact:false}).click();await expect(bar.getByRole('link',{name:'FAQ '+width,exact:true})).toBeVisible()
   await checkScreen(page,destination,'bookmarks-bar-'+width,errors)
   await reader.page.goto(url);const theirs=reader.page.getByRole('navigation',{name:'Channel bookmarks'});await expect(theirs.getByRole('link',{name:'Brief '+width,exact:true})).toBeVisible()
   await reader.page.locator('summary[aria-label="Conversation options"]').click();await reader.page.getByRole('button',{name:'Channel bookmarks',exact:true}).click()
   const refused=reader.page.getByRole('dialog');await expect(refused.getByText('Only members who can post in this channel change its bookmarks.',{exact:false})).toBeVisible();await expect(refused.getByRole('button',{name:'Add bookmark'})).toHaveCount(0);await expect(refused.getByRole('button',{name:/^Remove/})).toHaveCount(0)
   await checkScreen(reader.page,destination,'bookmarks-restricted-'+width,[])
   await refused.getByRole('button',{name:'Close dialog',exact:true}).click()
   await dialog.waitFor({state:'detached'}).catch(()=>{})
   await page.locator('summary[aria-label="Conversation options"]').click();await page.getByRole('button',{name:'Channel bookmarks',exact:true}).click()
   await dialog.getByRole('button',{name:'Remove Brief '+width,exact:true}).click();await expect(dialog.getByText('Brief '+width,{exact:true})).toHaveCount(0)
   await dialog.getByRole('button',{name:'Close dialog',exact:true}).click()
  }finally{await admin.close();await reader.close()}
 },destination)
}
