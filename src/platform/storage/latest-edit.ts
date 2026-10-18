import type {Context} from './context'
import {canPost} from '../../team/posting-policy'
import {channelWritable} from '../../team/channel-policy'
import {fail} from '../../family/team-chat/domain'

// Select from the durable log, independent of the history window in the browser.
// The ordinary edit API still rechecks author, ACL, version and posting rights.
export async function latestEditable(c:Context,conversation:string,thread:unknown,hydrate:(id:string)=>Promise<any>){
 if(thread!==null&&thread!==undefined&&(typeof thread!=='string'||!thread||thread.length>128))fail(400,'Invalid thread')
 const parent=thread??null
 const row=await c.one(`SELECT m.id FROM nook_messages m WHERE m.conversation=? AND m.author=? AND m.deleted=0 AND m.parent IS ? AND ${channelWritable('m.conversation')} AND ${canPost('m.conversation','?','m.parent')} ORDER BY m.sequence DESC LIMIT 1`,[conversation,c.uid,parent,c.uid],conversation)
 return row?hydrate(row.id):null
}
