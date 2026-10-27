// The same Details door lives in the conversation menu on phones.
export async function openConversationDetails(page){
 const header=page.locator('.header-members')
 if(await header.isVisible())await header.click()
 else{await page.locator('.conversation-menu > summary').click();await page.locator('.conversation-menu').getByRole('button',{name:'Members and details',exact:true}).click()}
}

// Reveal the message's actions through the same message tap the phone uses.
export async function clickMessageAction(action){
 const row=action.locator('xpath=ancestor::article[contains(concat(" ",normalize-space(@class)," ")," message ")][1]')
 if(await row.count())await row.click({position:{x:4,y:4}})
 await action.click()
}
