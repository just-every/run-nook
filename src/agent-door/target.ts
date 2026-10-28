import type {Context} from '../platform/storage/context'
import {admitNativeArguments} from './admission'
import type {Spec} from './tool-native'

/** Native ids only, resolved after the same membership checks as classification. */
export async function nativeTarget(spec:Spec,args:Record<string,unknown>,c:Context){
 await admitNativeArguments(spec.name,args,c)
 if(typeof args.id==='string'){
  if(spec.name.startsWith('messages.')||spec.name.startsWith('polls.')||spec.name==='threads.follow')return {kind:'message',id:args.id}
  if(spec.name.startsWith('outcomes.'))return {kind:'outcome',id:args.id}
  if(spec.name.startsWith('notes.'))return {kind:'note',id:args.id}
  if(spec.name.startsWith('conversations.')&&spec.name!=='conversations.grants')return {kind:'conversation',id:args.id}
 }
 if(typeof args.conversation==='string')return {kind:'conversation',id:args.conversation}
 return null
}
