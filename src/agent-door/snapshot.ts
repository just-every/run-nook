import type {Context} from '../platform/storage/context'
import {readProfile} from '../profiles/server'
import {bookmarks} from '../team/bookmarks.server'
import {readPoll} from '../team/polls.server'
import {conversationNotifyExceptions} from '../team/conversation-notify.server'

/** Stable native witnesses; wall-clock presentation fields are not state. */
export async function personalSnapshot(c:Context){
 const rooms=await c.rows("SELECT v.id FROM nook_conversations v JOIN nook_members m ON m.conversation=v.id WHERE m.user=? AND v.kind IN ('channel','private') ORDER BY v.id",[c.uid])
 const bars=[]
 for(const room of rooms){await c.check(room.id);bars.push({conversation:room.id,...await bookmarks(c,room.id)})}
 const polls=[]
 for(const room of rooms){
  for(const poll of await c.rows('SELECT message FROM nook_polls WHERE conversation=? ORDER BY message',[room.id],room.id)){
   if(await c.one('SELECT 1 FROM nook_messages WHERE id=? AND deleted=0',[poll.message],room.id))polls.push(await readPoll(c,poll.message))
  }
 }
 return {profile:(await readProfile(c)).profile,bookmarks:bars,polls,notificationChoices:await conversationNotifyExceptions(c)}
}
