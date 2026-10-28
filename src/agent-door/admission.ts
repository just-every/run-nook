import { ToolRefusal } from '../base/modules/agent-door/index.ts'
import type { Context } from '../platform/storage/context'
import { read, outcome } from '../platform/storage/read'
import { getNote } from '../notes/read'

/** Reuse native readers when classifying a selected record or proposed effect. */
export async function admitNativeArguments(name:string,args:Record<string,unknown>,c:Context){
 if(typeof args.conversation==='string')await c.check(args.conversation)
 if(name.startsWith('conversations.')&&name!=='conversations.grants'&&typeof args.id==='string')await c.check(args.id)
 const message=typeof args.message==='string'?args.message:typeof args.id==='string'&&(name.startsWith('messages.')||name==='threads.follow')?args.id:null
 let record:Record<string,any>|null=null
 if(message)record=await read(c,'message',message)
 else if(name.startsWith('outcomes.')&&typeof args.id==='string')record=await outcome(c,args.id)
 else if(name.startsWith('notes.')&&typeof args.id==='string'&&typeof args.conversation==='string')record=await getNote(c,args.conversation,args.id)
 if(record?.deleted||record?.erased)throw new ToolRefusal('not_found')
}
