import type {Bindings} from './platform/repository.server'
import {context} from './platform/storage/context'
import {read as storeRead} from './platform/storage/read'
import {write as storeWrite} from './platform/storage/commands'
import {operatorAuth,authBindings} from './platform/operator-auth.server'
import {firstRunResponse} from './base/setup'
import {demoPeople} from './demo/people'
import {week} from './demo/week'

/** Idempotent sample household; all product writes use Nook's own store APIs. */
export async function seedDemo(input:Bindings,{ownerEmail,now}:{ownerEmail:string;now:Date}){
 if(input.RER_DEMO!=='1')throw Error('Sample data requires demo mode')
 const env=authBindings(input),people=demoPeople(env)
 const read=async(headers:Headers,action:string,id='')=>storeRead(await context(env,headers),action,id)
 const write=async(headers:Headers,action:string,id:string,value:Record<string,unknown>)=>storeWrite(await context(env,headers),action,id,value)
 const owner=await people.owner(ownerEmail),sessions=[owner]
 try{
  const channels=new Map<string,string>()
  for(const name of ['household','groceries','garden']){
   const existing=(await read(owner,'conversations')).find((c:any)=>c.name===name)
   const channel=existing??await write(owner,'conversations','',{name,kind:'channel'})
   channels.set(name,channel.id)
  }
  for(const [email,name] of [['alex@demo.invalid','Alex Chen'],['morgan@demo.invalid','Morgan Reed']]){
   sessions.push(await people.member(owner,email,name,[...channels.values()]))
  }
  const users=await Promise.all(sessions.map(headers=>read(headers,'me')))
  for(const [index,item] of week.entries()){
   const channel=channels.get(item.channel)!,author=sessions[item.author]
   const message=await write(author,'messages',channel,{body:item.body,intent:`demo-week-${index}`})
   if('reply' in item)await write(sessions[item.replyBy],'messages',channel,{body:item.reply,parent:message.id,intent:`demo-reply-${index}`})
  }
  const household=channels.get('household')!,garden=channels.get('garden')!
  const cards=[
   {channel:household,kind:'decision',body:'Shared dinners on Fridays at 7 pm; add guests here by Thursday.'},
   {channel:household,kind:'commitment',body:'Pick up coffee and fresh bread for Saturday lunch',assignee:users[0].id,deadline:new Date(now.getTime()+2*86400000).toISOString().slice(0,10)},
   {channel:garden,kind:'commitment',body:'Plant the herb seedlings beside the back steps',assignee:users[2].id},
  ]
  for(const card of cards){
   const existing=(await read(sessions[1],'outcomes',card.channel)).find((o:any)=>o.body===card.body)
   const outcome=existing??await write(sessions[1],'outcomes',card.channel,card)
   if(card.channel===garden){
    let current=outcome
    if(current.status==='proposed')current=await write(sessions[2],'reviseOutcome',current.id,{action:'accept',version:current.version})
    if(current.status==='accepted')await write(sessions[2],'reviseOutcome',current.id,{action:'complete',version:current.version})
   }
  }
  const setup=await firstRunResponse(new Request(env.AUTH_ORIGIN+'/setup',{method:'POST',headers:{...Object.fromEntries(owner),origin:env.AUTH_ORIGIN,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'}),env,operatorAuth(env))
  if(setup?.status!==303)throw Error('Demo owner setup did not complete')
 }finally{for(const session of sessions)await people.leave(session)}
}
