import {nookAgentDoor} from './index.server'
import type {StorageBindings} from '../platform/storage/context'
import type {Operator} from '../base/modules/operator-auth/index.mjs'

/** Called only after the native guarded transaction commits. */
export async function emitPersonChanges(env:StorageBindings,operator:Operator,events:{type:string;uri:string}[]){
 const door=nookAgentDoor(env)
 const person={id:operator.id,email:operator.email,name:operator.displayName,role:operator.role,active:operator.status==='active'}
 for(const event of events)await door.emit({...event,person})
}
