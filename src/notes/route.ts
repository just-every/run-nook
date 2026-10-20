import type {Context} from '../platform/storage/context'
import {fail} from '../family/team-chat/domain'
import {createNote,reviseNote,revertNote} from './write'
import {getNote,listNotes,noteHistory,noteProposals} from './read'
import {proposeNoteItem} from './proposals'
import {deleteNote} from './erasure'
export async function noteRoute(c:Context,method:string,conversation:string,id:string|undefined,action:string|undefined,query:URLSearchParams,input:Record<string,any>){
 if(!id){if(method==='GET')return listNotes(c,conversation,{...(query.has('thread')?{thread:query.get('thread')}:{}),...(query.has('after')?{after:query.get('after')}:{} )});if(method==='POST')return createNote(c,conversation,input)}
 if(id&&!action){if(method==='GET')return getNote(c,conversation,id);if(method==='PATCH')return reviseNote(c,conversation,id,input);if(method==='DELETE')return deleteNote(c,conversation,id,input)}
 if(id&&action==='history'&&method==='GET')return noteHistory(c,conversation,id,query.has('before')?{before:Number(query.get('before'))}:{})
 if(id&&action==='revert'&&method==='POST')return revertNote(c,conversation,id,input)
 if(id&&action==='proposals'){if(method==='GET')return noteProposals(c,conversation,id,query.has('after')?{after:query.get('after')}:{ });if(method==='POST')return proposeNoteItem(c,conversation,id,input)}
 fail(404,'Note route unavailable')
}
