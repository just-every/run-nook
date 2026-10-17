import {fail,text} from '../family/team-chat/domain'
import {Context} from '../platform/storage/context'
import {allowedGrant} from './access'
import {channelDetails} from './channel-lifecycle.server'
import {channelManagement} from './channel-policy'
import {channelDeparture} from './channel-departure'

export async function changeChannelMember(c:Context,id:string,input:Record<string,any>){
 const uid=text(input.user,128)
 if(input.remove!==undefined&&typeof input.remove!=='boolean')fail(400,'remove must be boolean')
 if(uid===c.uid)fail(400,'Use Leave channel to remove your own membership')
 const channel=await channelDetails(c,id)
 if(channel.kind==='dm'||!channel.canManage)fail(403,'Only the channel manager or a current member owner or admin may change membership; DMs are fixed')
 const statements=[...c.event(id,'membership',uid),...(input.remove?channelDeparture(c,id,uid):[]),input.remove?c.sql('DELETE FROM nook_members WHERE conversation=? AND user=?',id,uid):c.sql('INSERT OR IGNORE INTO nook_members VALUES(?,?)',id,uid)]
 const condition=`${channelManagement('?','?')} AND EXISTS(SELECT 1 FROM nook_conversations WHERE id=? AND kind<>'dm') AND EXISTS(SELECT 1 FROM oa_operators target WHERE id=? AND status='active' AND ${allowedGrant('target.id','?')}) AND (? OR EXISTS(SELECT 1 FROM nook_members WHERE conversation=? AND user=?) OR (SELECT count(*) FROM nook_members WHERE conversation=?)<50)`
 const values=[c.uid,id,id,uid,id,input.remove?1:0,id,uid,id]
 if(input.remove)await c.batch(statements,id,condition,values);else await c.writeBatch(statements,id,condition,values)
 await c.hint();return {ok:true}
}
