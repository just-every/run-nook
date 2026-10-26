import type {Bindings} from './platform/repository.server'
import {empty,mutate,type Identity} from './family/team-chat/domain'
import {demoPeople} from './demo/people'
import {saveDemo} from './demo/save'
import {week} from './demo/week'

/** Fixed sample identities and domain commands, with no mail or network calls. */
export async function seedDemo(env:Bindings,{ownerEmail,now}:{ownerEmail:string;now:Date}){
 if(env.RER_DEMO!=='1')throw Error('Sample data requires demo mode')
 const state=empty(),people=await demoPeople(env,ownerEmail,now)
 state.users=people
 const commands:{at:number;apply:(stamp:string)=>void}[]=[]
 const command=(author:number,action:string,id:string,input:Record<string,unknown>,newId:string,daysAgo:number,hour:number,minute:number,offsetMinutes=0)=>{
  const at=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()-daysAgo,hour,minute+offsetMinutes)
  commands.push({at,apply:stamp=>mutate(state,people[author] as Identity,action,id,input,newId,stamp)})
 }
 for(const name of ['household','groceries','garden']){
  command(0,'conversations','',{name,kind:'channel',participants:people.slice(1).map(p=>p.id)},'demo-'+name,7,8,0)
 }
 for(const [index,item] of week.entries()){
  const id='demo-week-'+index,channel='demo-'+item.channel
  command(item.author,'messages',channel,{body:item.body,intent:id},id,item.daysAgo,item.hour,item.minute)
  if('reply' in item)command(item.replyBy,'messages',channel,{body:item.reply,parent:id,intent:id+'-reply'},id+'-reply',item.daysAgo,item.hour,item.minute,item.replyAfterMinutes)
 }
 command(1,'outcomes','demo-household',{kind:'decision',body:'Shared dinners on Fridays at 7 pm; add guests here by Thursday.'},'demo-dinners',2,16,35)
 command(1,'outcomes','demo-household',{kind:'commitment',body:'Pick up coffee and fresh bread for Saturday lunch',assignee:people[0].id,deadline:new Date(now.getTime()+2*86400000).toISOString().slice(0,10)},'demo-shopping',1,12,40)
 command(1,'outcomes','demo-garden',{kind:'commitment',body:'Plant the herb seedlings beside the back steps',assignee:people[2].id},'demo-herbs',1,8,45)
 command(2,'reviseOutcome','demo-herbs',{action:'accept',version:1},'demo-herbs-accepted',1,9,5)
 command(2,'reviseOutcome','demo-herbs',{action:'complete',version:2},'demo-herbs-complete',0,11,5)
 // Shift the whole timeline when today's last sample is still ahead, preserving every gap.
 const shift=Math.max(0,Math.max(...commands.map(command=>command.at))-now.getTime())
 for(const {at,apply} of commands.sort((a,b)=>a.at-b.at))apply(new Date(at-shift).toISOString())
 await saveDemo(env.DB,state)
 await env.DB.prepare('INSERT INTO oa_first_run(singleton,completed_by,completed_at) VALUES(1,?,?) ON CONFLICT DO NOTHING').bind(people[0].id,now.getTime()).run()
}
