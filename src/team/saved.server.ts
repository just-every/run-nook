import {fail} from '../family/team-chat/domain'
import type {Context} from '../platform/storage/context'
import {exact,savedCollectionsSql,savedAfter,savedId,savedInput,savedItem,savedPageSize,savedProjection,savedTargetFence,savedTargetValues,savedLiveMessage} from './saved-policy'

const personalColumns='id,seq,created,kind,conversation,target,NULL AS actor'
const pinColumns="id,seq,created,'message' AS kind,conversation,message AS target,actor"

/** Resolve the current native or published imported message, its membership and
 * both collection flags in one snapshot. Erased source bodies stay unavailable. */
export async function messageCollections(c:Context,value:unknown){
 const id=savedId(value)
 const row=await c.one(savedCollectionsSql,[id,id,c.uid,c.uid])
 if(!row)fail(404,'Message unavailable')
 return {savedId:row.savedId??null,pinned:!!row.pinned,canPin:!!row.canPin}
}

async function personalItem(c:Context,id:string){
 const row=await c.one(savedProjection(`SELECT ${personalColumns} FROM nook_saved_items WHERE user=? AND id=?`),[c.uid,id,c.uid])
 return row?savedItem(row):fail(404,'Saved item unavailable')
}
export async function listSaved(c:Context,input:unknown={}){
 const after=savedAfter(input)
 const rows=await c.rows(savedProjection(`SELECT ${personalColumns} FROM nook_saved_items WHERE user=? AND seq<? ORDER BY seq DESC LIMIT ${savedPageSize+1}`),[c.uid,after,c.uid])
 return {items:rows.slice(0,savedPageSize).map(row=>savedItem(row)),cursor:rows.length>savedPageSize?String(rows[savedPageSize-1].seq):null}
}
/** Exact JSON: {conversation,message} | {conversation,attachment} |
 * {conversation,url}. Duplicate saves preserve their original order/time. */
export async function save(c:Context,input:unknown){
 const item=savedInput(input),{conversation,kind,target}=item,values=savedTargetValues(item),fence=savedTargetFence(kind)
 if(!await c.one(`SELECT 1 WHERE ${fence}`,values,conversation))fail(404,'Source unavailable')
 const prior=await c.one('SELECT id FROM nook_saved_items WHERE user=? AND conversation=? AND kind=? AND target=?',[c.uid,conversation,kind,target],conversation)
 const id=prior?.id??crypto.randomUUID(),now=new Date().toISOString()
 const expected=prior?'EXISTS(SELECT 1 FROM nook_saved_items WHERE id=? AND user=?)':'NOT EXISTS(SELECT 1 FROM nook_saved_items WHERE user=? AND conversation=? AND kind=? AND target=?)'
 await c.batch([c.sql('INSERT INTO nook_saved_items(id,user,conversation,kind,target,created) SELECT ?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM nook_saved_items WHERE id=?)',id,c.uid,conversation,kind,target,now,id)],conversation,`${fence} AND ${expected}`,[...values,...(prior?[id,c.uid]:[c.uid,conversation,kind,target])])
 return personalItem(c,id)
}
/** Cleanup remains possible after losing source membership. Only the owner of
 * the private save can delete it; the transaction still checks current auth. */
export async function deleteSaved(c:Context,value:unknown){
 const id=savedId(value),prior=await c.one('SELECT seq FROM nook_saved_items WHERE id=? AND user=?',[id,c.uid])
 if(!prior)return {deleted:true}
 await c.batch([c.sql('DELETE FROM nook_saved_items WHERE id=? AND user=?',id,c.uid)],undefined,'EXISTS(SELECT 1 FROM nook_saved_items WHERE id=? AND user=? AND seq=?)',[id,c.uid,prior.seq])
 return {deleted:true}
}

async function channel(c:Context,conversation:string){
 const row=await c.one('SELECT kind FROM nook_conversations WHERE id=?',[conversation],conversation)
 if(!row||!['channel','private'].includes(row.kind))fail(400,'Pins require a channel')
}
export async function pins(c:Context,value:unknown,input:unknown={}){
 const conversation=savedId(value),after=savedAfter(input);await channel(c,conversation)
 // Kind is also checked in the data snapshot, not only in the preliminary read.
 const rows=await c.rows(savedProjection(`SELECT ${pinColumns} FROM nook_channel_pins WHERE conversation=? AND seq<? AND EXISTS(SELECT 1 FROM nook_conversations WHERE id=? AND kind IN ('channel','private')) ORDER BY seq DESC LIMIT ${savedPageSize+1}`),[conversation,after,conversation,c.uid],conversation)
 return {items:rows.slice(0,savedPageSize).map(row=>savedItem(row,true)),cursor:rows.length>savedPageSize?String(rows[savedPageSize-1].seq):null}
}
/** Opaque pin IDs also remove unavailable sources. Missing or other-channel IDs
 * are indistinguishable no-ops, with current channel/write authority still due. */
export async function deletePin(c:Context,value:unknown,pinValue:unknown){
 const conversation=savedId(value),id=savedId(pinValue);await channel(c,conversation)
 await c.writeBatch([c.sql('DELETE FROM nook_channel_pins WHERE id=? AND conversation=?',id,conversation)],conversation,"EXISTS(SELECT 1 FROM nook_conversations WHERE id=? AND kind IN ('channel','private'))",[conversation])
 return {pinned:false}
}
/** Exact JSON: {message:string,pinned:boolean}. Every currently authorized
 * channel member can pin/unpin, including a scoped guest; no admin bypass. */
export async function pin(c:Context,value:unknown,input:unknown){
 const conversation=savedId(value),data=exact(input,['message','pinned']),message=savedId(data.message)
 if(typeof data.pinned!=='boolean')fail(400,'pinned must be boolean')
 await channel(c,conversation)
 if(data.pinned&&!await c.one(`SELECT 1 WHERE ${savedLiveMessage('?','?')}`,[message,conversation,message,conversation],conversation))fail(404,'Source unavailable')
 const prior=await c.one('SELECT id FROM nook_channel_pins WHERE conversation=? AND message=?',[conversation,message],conversation)
 const id=prior?.id??crypto.randomUUID(),now=new Date().toISOString()
 const expected=prior?'EXISTS(SELECT 1 FROM nook_channel_pins WHERE id=? AND conversation=? AND message=?)':'NOT EXISTS(SELECT 1 FROM nook_channel_pins WHERE conversation=? AND message=?)'
 const live=data.pinned?` AND ${savedLiveMessage('?','?')}`:''
 const statement=data.pinned?c.sql('INSERT INTO nook_channel_pins(id,conversation,message,actor,created) SELECT ?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM nook_channel_pins WHERE id=?)',id,conversation,message,c.uid,now,id):c.sql('DELETE FROM nook_channel_pins WHERE conversation=? AND message=?',conversation,message)
 await c.writeBatch([statement],conversation,`EXISTS(SELECT 1 FROM nook_conversations WHERE id=? AND kind IN ('channel','private')) AND ${expected}${live}`,[conversation,...(prior?[id,conversation,message]:[conversation,message]),...(data.pinned?[message,conversation,message,conversation]:[])])
 if(!data.pinned)return {pinned:false}
 const row=await c.one(savedProjection(`SELECT ${pinColumns} FROM nook_channel_pins WHERE id=? AND conversation=?`),[id,conversation,c.uid],conversation)
 return {pinned:true,item:row?savedItem(row,true):null}
}
