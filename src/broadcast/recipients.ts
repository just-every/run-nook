import type {Context} from '../platform/storage/context'
import {fail} from '../family/team-chat/domain'
export async function broadcastRecipients(c:Context,message:string,after:string){
 const source=await c.one('SELECT conversation FROM nook_messages WHERE id=? AND deleted=0',[message])
 if(!source)fail(404,'Message unavailable')
 const rows=await c.rows('SELECT r.user AS id,a.name FROM nook_broadcast_recipients r JOIN nook_actor_history a ON a.id=r.user WHERE r.message=? AND r.user>? ORDER BY r.user LIMIT 101',[message,after],source.conversation)
 return {items:rows.slice(0,100),hasMore:rows.length>100}
}
// Both send acknowledgements and history projections expose the saved count,
// rather than recomputing against today's membership or presence.
export const broadcastSummary=(message:string)=>`(SELECT json_object('kind',b.kind,'recipients',b.recipients,'quiet',b.quiet,'otherZones',b.other_zones) FROM nook_broadcasts b WHERE b.message=${message})`
