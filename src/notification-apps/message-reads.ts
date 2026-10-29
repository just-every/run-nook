import type {StorageBindings} from '../platform/storage/context'
import type {Approval} from './context'
import {InstalledContext} from './installed-context'
import {historyPage} from '../platform/storage/history'
import {fail} from '../family/team-chat/domain'

export async function appMessages(env:StorageBindings,app:Approval,method:string,a:Record<string,unknown>){
 const c=new InstalledContext(env,app,'read_messages'),channel=app.conversation
 await c.check(channel)
 const limit=a.limit===undefined?100:Number(a.limit),cursor=a.cursor===undefined||a.cursor===''?null:Number(a.cursor)
 if(!Number.isSafeInteger(limit)||limit<1||limit>100||cursor!==null&&(!Number.isSafeInteger(cursor)||cursor<1))fail(400,'Invalid pagination')
 let where='m.deleted=0',values:unknown[]=[],descending=method==='conversations.history'
 if(descending){where+=' AND m.parent IS NULL'+(cursor===null?'':' AND m.sequence<?');if(cursor!==null)values.push(cursor)}
 else{
  if(typeof a.ts!=='string'||!a.ts)fail(400,'Thread required')
  const root=await c.one('SELECT id FROM nook_message_history WHERE id=? AND conversation=? AND parent IS NULL AND deleted=0',[a.ts,channel],channel)
  if(!root)fail(404,'Message unavailable')
  where+=' AND (m.id=? OR m.parent=?)'+(cursor===null?'':' AND m.sequence>?');values=[a.ts,a.ts,...(cursor===null?[]:[cursor])]
 }
 const page=await historyPage(c,channel,where,values,limit+1,descending),items=page.slice(0,limit),hasMore=page.length>limit
 return {ok:true,messages:items.map(m=>({type:'message',user:m.author,text:m.body,ts:m.id,...(m.parent?{thread_ts:m.parent}:{})})),has_more:hasMore,response_metadata:{next_cursor:hasMore?String(items.at(-1)!.sequence):''}}
}
