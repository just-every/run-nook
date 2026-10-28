import type { ToolDefinition, ToolContext } from '../base/modules/agent-door/types.ts'
import type { StorageBindings } from '../platform/storage/context'
import { nativeContext, nativeCall } from './context'
import { standard } from './tool-native'
import { nativeSummary } from './summary'
import { admitNativeArguments } from './admission'
import { conversationsTools } from './tools-conversations'
import { messagesTools } from './tools-messages'
import { notesTools } from './tools-notes'
import { workspaceTools } from './tools-workspace'
import {recordTools} from './tools-records'
import {personalTools} from './tools-personal'
import {nativeTarget} from './target'
export const specs=[...conversationsTools,...messagesTools,...notesTools,...workspaceTools,...recordTools,...personalTools]

export function nookTools(env:StorageBindings):ToolDefinition[]{return specs.map(spec=>({
 name:'nook.'+spec.name,title:spec.name.replaceAll('.',' '),description:`Nook native ${spec.name}; current sponsor and conversation authority required.`,scope:spec.read?'nook:read':'nook:write',readOnly:!!spec.read,inputSchema:spec.schema,outputSchema:{anyOf:[{type:'object'},{type:'array'}]},classes:spec.classes??['standard'],clauses:spec.clauses,untrusted:!!spec.read,
 classify:async(a,who)=>nativeCall(async()=>{const c=await nativeContext(env,who);await admitNativeArguments(spec.name,a,c);return spec.risk?spec.risk(c,a):standard()}),
 target:async(a,who)=>nativeCall(async()=>nativeTarget(spec,a,await nativeContext(env,who))),
 ...(!spec.read?{summary:async(a:Record<string,unknown>,who:ToolContext)=>nativeCall(async()=>nativeSummary(spec,a,who,await nativeContext(env,who)))}:{}),
 ...(spec.revision?{revision:async(a:Record<string,unknown>,who:ToolContext)=>nativeCall(async()=>spec.revision!(await nativeContext(env,who),a))}:{}),
 ...(spec.authority?{authority:spec.authority}:{}),
 ...(spec.widens===false?{widens:false as const,narrowing:spec.narrowing}:{}),
 run:async(a,who)=>nativeCall(async()=>{const result=await spec.run(await nativeContext(env,who),a);const id=spec.area&&(result?.id??a.id);const resources=id?[{uri:`nook://${spec.area}/${encodeURIComponent(id)}`,name:spec.name}]:undefined;if(!spec.read&&resources)for(const r of resources)who.emit('nook.'+spec.name,r.uri);return {result,resources}}),
 }))}
