import assert from 'node:assert/strict'
const nav=(page,name)=>page.getByRole('navigation',{name:'Workspace',exact:true}).getByRole('button',{name:new RegExp('^'+name+'( \\d+)?$')})
async function json(page,origin,path){const response=await page.request.get(origin+'/api/'+path);assert.equal(response.status(),200,path);return response.json()}
export async function groupDmFlow({alice,bob,origin,aliceUser,bobUser,bobName}){
 await alice.locator('.nook-app[data-live-connected=true]').waitFor()
 const third=(await json(alice,origin,'users')).find(p=>p.id!==aliceUser.id&&p.id!==bobUser.id&&p.active!==0&&p.mode!=='guest')
 assert.ok(third,'a third current full teammate is available')
 await nav(alice,'Channels').click();await alice.getByRole('button',{name:'New message',exact:true}).last().click()
 const groupDialog=alice.getByRole('dialog',{name:'New message',exact:true})
 await groupDialog.getByRole('button',{name:'Start a group message',exact:true}).click()
 await groupDialog.getByLabel(bobName,{exact:true}).check();await groupDialog.getByLabel(third.name,{exact:true}).check()
 const created=alice.waitForResponse(r=>new URL(r.url()).pathname==='/api/conversations'&&r.request().method()==='POST')
 await groupDialog.getByRole('button',{name:'Start group message',exact:true}).click();const id=(await(await created).json()).id;await groupDialog.waitFor({state:'hidden'})
 const group=(await json(alice,origin,'workspace?conversation='+id)).conversations.find(c=>c.id===id)
 assert.ok(group,'group DM has exactly the selected audience')
 assert.deepEqual(group.participants.map(p=>p.id).sort(),[aliceUser.id,bobUser.id,third.id].sort())
 const groupText='Customer handoff: confirm the US support window together.'
 await alice.locator('.chat .composer textarea').fill(groupText);await alice.locator('.chat .composer textarea').press('Enter')
 await bob.goto(origin+`/app?view=chat&conversation=${group.id}`);await bob.getByText(groupText,{exact:true}).waitFor()
 const fixed=await alice.request.post(origin+`/api/conversations/${group.id}/members`,{headers:{Origin:origin},data:{user:third.id,remove:true}})
 assert.equal(fixed.status(),403,'group DM audience stays fixed')
}
