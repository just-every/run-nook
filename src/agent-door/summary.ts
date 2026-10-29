import type { ApprovalSummary, ToolContext } from '../base/modules/agent-door/types.ts'
import type { Context } from '../platform/storage/context'
import type { Spec } from './tool-native'
import { payload, read, outcome, getNote } from './tool-native'
import { ToolRefusal } from '../base/modules/agent-door/index.ts'
const label=(value:string)=>value.replaceAll('_',' ').replace(/([A-Z])/g,' $1').replace(/^./,letter=>letter.toUpperCase())
function display(value:unknown):string{
 if(value===null)return 'None'
 if(typeof value==='boolean')return value?'Yes':'No'
 if(Array.isArray(value))return value.map(display).join('; ')||'None'
 if(value&&typeof value==='object'){
  const record=value as Record<string,unknown>
  if(typeof record.text==='string')return `${record.checked===true?'Checked':'Open'}: ${record.text}`
  if(typeof record.url==='string')return `${record.label??'Link'}: ${record.url}`
  return Object.entries(record).map(([key,item])=>`${label(key)}: ${display(item)}`).join('; ')
 }
 return String(value)
}
export async function nativeSummary(spec:Spec,args:Record<string,unknown>,who:ToolContext,c:Context):Promise<ApprovalSummary>{
 const id=String(args.id??args.conversation??who.person.id)
 const conversation=typeof args.conversation==='string'?args.conversation:spec.name.startsWith('conversations.')&&typeof args.id==='string'?args.id:null
 const room=conversation?await c.one<{name:string}>('SELECT name FROM nook_conversations WHERE id=?',[conversation],conversation):null
 const items=Object.entries(payload(args,Object.keys(spec.schema.properties))).filter(([key])=>!['id','conversation'].includes(key)).map(([key,value])=>`${label(key)}: ${display(value)}`)
 let source:Record<string,any>|null=null
 const messageId=typeof args.message==='string'?args.message:typeof args.id==='string'&&(spec.name.startsWith('messages.')||spec.name.startsWith('threads.'))?args.id:null
 if(messageId)source=await read(c,'message',messageId)
 else if(typeof args.id==='string'&&spec.name.startsWith('outcomes.'))source=await outcome(c,args.id)
 else if(typeof args.id==='string'&&typeof args.conversation==='string'&&spec.name.startsWith('notes.'))source=await getNote(c,args.conversation,args.id)
 if(source){
  if(typeof args.version==='number'&&source.version!==args.version)throw new ToolRefusal('revision_conflict')
  if(typeof source.title==='string')items.push(`Current title: ${source.title}`)
  if(typeof source.body==='string')items.push(`Current content: ${source.body}`)
 }
 if(spec.name==='notes.propose'){
  const item=source?.items.find((item:{id:string})=>item.id===args.item)
  if(!item)throw new ToolRefusal('not_found')
  items.push(`Proposed commitment: ${item.text}`)
 }
 if(spec.name==='notes.revert'){
  const saved=await c.one<{title:string;body:string;items_json:string;links_json:string;pinned:number}>('SELECT title,body,items_json,links_json,pinned FROM nook_note_versions WHERE note=? AND version=? AND deleted=0',[args.id,args.restoreVersion],String(args.conversation))
  if(!saved)throw new ToolRefusal('not_found')
  items.push(`Restore title: ${saved.title}`,`Restore content: ${saved.body}`,`Restore checklist: ${display(JSON.parse(saved.items_json))}`,`Restore links: ${display(JSON.parse(saved.links_json))}`,`Restore pinned: ${display(!!saved.pinned)}`)
 }
 return {target:{id,...(room?{name:room.name}:{})},items,...(typeof args.user==='string'?{recipients:[args.user]}:{})}
}
