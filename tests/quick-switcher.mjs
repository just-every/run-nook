import assert from 'node:assert/strict'
import {expect} from '@playwright/test'
import {resolve} from 'node:path'

export async function quickSwitcherGaps({origin,page,owner,member,call,send,destination,checks}){
 const room=await call(owner,'conversations',{name:'Customer onboarding',kind:'private',participants:[member.user.id]})
 const root=await send(owner,room.id,'Review the Q4 onboarding schedule')
 await call(member,`messages/${root.id}/follow`,{follow:false})
 await page.goto(origin+`/app?view=chat&conversation=${room.id}&thread=${root.id}&focus=${root.id}`)
 await expect(page.getByLabel('Reply in thread',{exact:true})).toBeVisible()
 await page.goto(origin+'/app?view=channels')
 const switcher=page.getByRole('dialog',{name:'Jump to a conversation',exact:true})
 const open=async(query)=>{await page.locator('.nook-app[data-live-connected=true]').waitFor();await page.keyboard.press('Control+k');await switcher.getByRole('combobox').fill(query);await expect(switcher.getByRole('status')).not.toContainText('loading')}
 await open(root.body)
 await expect(switcher.getByRole('option',{name:/Review the Q4 onboarding schedule/})).toBeVisible()
 await switcher.getByRole('combobox').press('Enter');await expect(page.getByLabel('Reply in thread',{exact:true})).toBeVisible()
 assert.equal(new URL(page.url()).searchParams.get('thread'),root.id)
 await page.reload();await open(root.body);await expect(switcher.getByRole('option',{name:/Review the Q4 onboarding schedule/})).toBeVisible();await page.keyboard.press('Escape')
 checks.push('ordinary thread navigation records an unfollowed recent visit, survives reload, and quick-switch selection restores its deep link')
 // Sign another account into the same browser storage, which must not inherit
 // the member’s visit even though it can read the thread as its author.
 const [cookieName,...cookieValue]=owner.cookie.split('=')
 await page.context().addCookies([{name:cookieName,value:cookieValue.join('='),url:origin}])
 await call(owner,`messages/${root.id}/follow`,{follow:false})
 await page.goto(origin+'/app?view=channels');await open(root.body)
 await expect(switcher.getByRole('option',{name:/Review the Q4 onboarding schedule/})).toHaveCount(0);await page.keyboard.press('Escape')
 const [memberName,...memberValue]=member.cookie.split('=');await page.context().addCookies([{name:memberName,value:memberValue.join('='),url:origin}])
 await call(owner,`conversations/${room.id}/members`,{user:member.user.id,remove:true})
 await page.goto(origin+'/app?view=channels');await open(root.body)
 await expect(switcher.getByRole('option',{name:/Review the Q4 onboarding schedule/})).toHaveCount(0)
 await switcher.getByRole('combobox').fill(room.name);await expect(switcher.getByRole('option',{name:new RegExp(room.name)})).toHaveCount(0);await page.keyboard.press('Escape')
 checks.push('saved visits are account-isolated; current membership revocation removes both private channel and visited thread')
 const followedRoom=await call(owner,'conversations',{name:'Launch planning',kind:'private',participants:[member.user.id]})
 const oldest=await send(member,followedRoom.id,'Coverage for the December onboarding rollout')
 for(let i=0;i<101;i++)await send(member,followedRoom.id,'Weekly planning update '+(i+1)+': Please review the upcoming onboarding dates.')
 const first=await call(member,'threads?limit=100');assert.equal(first.hasMore,true);assert.equal(first.items.some(t=>t.root.id===oldest.id),false)
 await page.goto(origin+'/app?view=channels')
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===390?844:1000});await open(oldest.body)
  await expect(switcher.getByRole('option',{name:/Coverage for the December onboarding rollout/})).toBeVisible()
  await page.screenshot({animations:'disabled',path:resolve(destination,`quick-switcher-${width}.png`)})
  await page.keyboard.press('Escape')
 }
 checks.push('fuzzy switcher searches followed threads beyond its first complete server page at 1440/390')
}
