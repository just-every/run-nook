import {signIn} from './auth-support.mjs'
import assert from 'node:assert/strict'
import {chromium,expect} from '@playwright/test'

/** Fresh people exercise the command without inheriting a previous profile choice. */
export async function profileZoneBrowser({origin,registered,post,get,owner}){
 const base=typeof origin==='function'?origin():origin,browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{for(const width of [1440,390]){
  const actor=await registered('ZoneMember'+width),room=(await post('/api/conversations',{name:'Customer handoff '+width,kind:'private',participants:[actor.user.id]})).data
  const context=await browser.newContext({viewport:{width,height:width===390?844:900},timezoneId:'Australia/Brisbane',serviceWorkers:'block'})
  try{
   const [name,...value]=actor.cookie.split('=');await context.addCookies([{name,value:value.join('='),url:base}])
   const page=await context.newPage(),profile=page.getByRole('region',{name:'Your profile',exact:true}),zone=profile.getByLabel('Time zone',{exact:true})
   await page.goto(base+'/app?view=you');await expect(zone).toHaveValue('Australia/Brisbane')
   await page.goto(base+'/app?conversation='+room.id)
   const composer=page.getByRole('textbox',{name:'Message '+room.name,exact:true})
   await composer.fill('/status :palm_tree: Back tomorrow');await composer.press('Enter')
   await page.getByLabel('Command result').getByRole('button',{name:'Confirm',exact:true}).click();await expect(page.getByLabel('Command result')).toHaveCount(0)
   assert.equal((await get('/api/profile',actor.cookie)).data.profile.zoneChosen,false)
   await page.goto(base+'/app?view=you');await expect(zone).toHaveValue('Australia/Brisbane')
   await profile.getByLabel('Display name',{exact:true}).fill('Customer colleague '+width)
   await profile.getByRole('button',{name:'Save profile',exact:true}).click();await expect(profile.getByRole('status')).toContainText('Profile saved')
   assert.equal((await get('/api/profile',actor.cookie)).data.profile.zoneChosen,false)
   assert.equal((await get('/api/people?q='+encodeURIComponent('Customer colleague '+width),owner.cookie)).data.items.find(p=>p.id===actor.user.id).zone,'')
   await zone.selectOption('UTC');await profile.getByRole('button',{name:'Save profile',exact:true}).click();await expect(profile.getByRole('status')).toContainText('Profile saved')
   await page.reload();await expect(zone).toHaveValue('UTC')
   const chosen=(await get('/api/people?q='+encodeURIComponent('Customer colleague '+width),owner.cookie)).data.items.find(p=>p.id===actor.user.id)
   assert.equal(chosen.zone,'UTC');assert.equal(chosen.zoneChosen,true)
   await page.goto(base+'/app?conversation='+room.id)
   await composer.fill('/status Reviewing the handoff');await composer.press('Enter')
   await page.getByLabel('Command result').getByRole('button',{name:'Confirm',exact:true}).click();await expect(page.getByLabel('Command result')).toHaveCount(0)
   await page.goto(base+'/app?view=you');await expect(zone).toHaveValue('UTC')
   assert.equal((await get('/api/profile',actor.cookie)).data.profile.zoneChosen,true)
   if(width===390){
    const email='synthetic-nook-profile-guest@example.test'
    await post('/api/team/invitations',{email,role:'member',mode:'guest',scopes:[room.id]})
    await post('/auth/invite',{email,displayName:'Customer guest',role:'member'},owner.cookie,202)
    const guest=await signIn(base,email,{requestLink:false}),at=guest.cookie.indexOf('=')
    await context.clearCookies();await context.addCookies([{name:guest.cookie.slice(0,at),value:guest.cookie.slice(at+1),url:base}])
    await page.goto(base+'/app?view=you');await profile.getByLabel('Display name',{exact:true}).fill('Customer guest profile')
    await profile.getByRole('button',{name:'Save profile',exact:true}).click()
    await expect(profile.getByRole('button',{name:'Save profile',exact:true})).toBeEnabled()
    await page.reload();await expect(profile.getByLabel('Display name',{exact:true})).toHaveValue('Customer guest profile')
   }

  }finally{await context.close()}
 }}finally{await browser.close()}
}
