// The same Details door lives in the conversation menu on phones.
export async function openConversationDetails(page){
 const header=page.locator('.header-members')
 if(await header.isVisible())await header.click()
 else{await page.locator('.conversation-menu > summary').click();await page.locator('.conversation-menu').getByRole('button',{name:'Members and details',exact:true}).click()}
}
