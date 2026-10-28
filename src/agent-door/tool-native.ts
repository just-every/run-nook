import type { ToolDefinition, ToolContext, ClassAndFacts, JsonSchema } from '../base/modules/agent-door/types.ts'
import { ToolRefusal } from '../base/modules/agent-door/index.ts'
import { nativeContext, nativeCall } from './context'
import type { Context, StorageBindings } from '../platform/storage/context'
import { read, outcome } from '../platform/storage/read'
import { write } from '../platform/storage/commands'
import { channelDetails, updateChannel, archiveChannel, leaveChannel, transferChannel } from '../team/channel-lifecycle.server'
import { changeChannelMember } from '../team/channel-membership.server'
import { createNote, reviseNote, revertNote } from '../notes/write'
import { getNote, listNotes, noteHistory, noteProposals } from '../notes/read'
import { proposeNoteItem } from '../notes/proposals'
import { react, reactions, reactionActors } from '../team/reactions.server'
import { save, listSaved, deleteSaved, pins, pin, messageCollections } from '../team/saved.server'
import { personalWorkspace, updatePersonalWorkspace } from '../personal/workspace.server'

export const str:JsonSchema={type:'string',minLength:1,maxLength:128},body:JsonSchema={type:'string',minLength:1,maxLength:40000},number:JsonSchema={type:'integer',minimum:1},bool:JsonSchema={type:'boolean'}
export const list:JsonSchema={type:'array',items:str,maxItems:1000},input=(properties:Record<string,JsonSchema>,required:string[]=Object.keys(properties))=>({type:'object' as const,properties,required,additionalProperties:false})
export const noteFields={title:{type:'string',minLength:1,maxLength:200},body:{type:'string',maxLength:8000},items:{type:'array',maxItems:50,items:{type:'object',properties:{id:str,text:{type:'string',maxLength:500},checked:bool},required:['id','text','checked'],additionalProperties:false}},links:{type:'array',maxItems:10,items:{type:'object',properties:{url:{type:'string',maxLength:2048},label:{type:'string',maxLength:200}},required:['url','label'],additionalProperties:false}},pinned:bool} satisfies Record<string,JsonSchema>
export type Spec={name:string;clauses:string[];read?:boolean;schema:ReturnType<typeof input>;area?:string;run(c:Context,a:Record<string,any>):Promise<any>;risk?:(c:Context,a:Record<string,any>)=>Promise<ClassAndFacts[]>;classes?:ToolDefinition['classes'];revision?:(c:Context,a:Record<string,any>)=>Promise<number|null>;authority?:ToolDefinition['authority'];widens?:false;narrowing?:ToolDefinition['narrowing']}
export const payload=(a:Record<string,any>,keys:string[])=>Object.fromEntries(keys.filter(k=>a[k]!==undefined).map(k=>[k,a[k]]))
export const standard=()=>[{class:'standard' as const,facts:{measure:1}}]
export const membershipRisk=async(c:Context,a:Record<string,any>)=>[{class:'access' as const,facts:{measure:1,direction:a.remove?'narrows' as const:'widens' as const}}]
export const conversationVersion=async(c:Context,a:Record<string,any>)=>(await channelDetails(c,a.id)).version as number
export const messageVersion=async(c:Context,a:Record<string,any>)=>(await read(c,'message',a.id)).version as number

export {read,outcome,write,channelDetails,updateChannel,archiveChannel,leaveChannel,transferChannel,changeChannelMember,createNote,reviseNote,revertNote,getNote,listNotes,noteHistory,noteProposals,proposeNoteItem,react,reactions,reactionActors,save,listSaved,deleteSaved,pins,pin,messageCollections,personalWorkspace,updatePersonalWorkspace}

// Bind the record observed during classification to the native CAS. Reserved
// door arguments never substitute for the service's own version fence.
const leaveVersions=new WeakMap<object,number>()
export async function classifyLeave(c:Context,args:Record<string,any>):Promise<ClassAndFacts[]>{
 const room=await channelDetails(c,args.id);leaveVersions.set(args,room.version)
 return [{class:'access',facts:{measure:1,direction:'narrows'}}]
}
export async function runLeave(c:Context,args:Record<string,any>){
 const version=leaveVersions.get(args)
 if(version===undefined)throw new ToolRefusal('revision_conflict')
 return leaveChannel(c,args.id,{version})
}
export async function conversationGrants(c:Context,args:Record<string,any>){
 const row=await c.one('SELECT 1 FROM nook_members WHERE conversation=? AND user=?',[args.id,c.uid])
 if(!row)return {grants:[]}
 try{await c.check(args.id);return {grants:['conversation:read']}}catch{return {grants:[]}}
}
