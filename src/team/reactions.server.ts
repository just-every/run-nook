import {fail} from '../family/team-chat/domain'
import {Context} from '../platform/storage/context'
export const emojis=['👍','❤️','🎉','👀','✅','🙌'] as const
export async function reactionActors(c:Context,id:string,emoji:string,after=''){
 if(!emojis.includes(emoji as typeof emojis[number])||after.length>128)fail(400,'Invalid reaction page')
 const message=await c.one('SELECT conversation FROM nook_messages WHERE id=?',[id]);if(!message)fail(404,'Native message unavailable');await c.check(message.conversation)
 const rows=await c.rows('SELECT r.user AS id,a.name FROM nook_reactions r JOIN nook_actors a ON a.id=r.user WHERE r.message=? AND r.emoji=? AND r.user>? ORDER BY r.user LIMIT 51',[id,emoji,after],message.conversation)
 return {actors:rows.slice(0,50),cursor:rows.length>50?rows[49].id:null}
}
export async function reactions(c:Context,id:string){
 const message=await c.one('SELECT id,conversation,deleted FROM nook_messages WHERE id=?',[id]);
 if(!message)fail(404,'Native message unavailable; imported history is immutable')
 await c.check(message.conversation)
 const counts=await c.rows('SELECT emoji,count(*) AS count,max(CASE WHEN user=? THEN 1 ELSE 0 END) AS mine FROM nook_reactions WHERE message=? GROUP BY emoji',[c.uid,id],message.conversation)
 const result=[]
 for(const count of counts){const page=await reactionActors(c,id,count.emoji);result.push({...count,mine:!!count.mine,...page})}
 return result
}
export async function react(c:Context,id:string,input:Record<string,any>){
 if(!emojis.includes(input.emoji)||typeof input.add!=='boolean')fail(400,'Choose an available reaction and add or remove')
 const m=await c.one('SELECT conversation,deleted FROM nook_messages WHERE id=?',[id]);if(!m)fail(404,'Native message unavailable; imported history is immutable')
 // Event production is driven by actual row changes in this same transaction.
 // Exact add/remove retries are no-ops, including their replay frontier.
 const exists=`EXISTS(SELECT 1 FROM nook_reactions WHERE message=? AND user=? AND emoji=?)`
 await c.batch([
  c.sql(`UPDATE nook_conversations SET seq=seq+1 WHERE id=? AND ${input.add?'NOT ':''}${exists}`,m.conversation,id,c.uid,input.emoji),
  c.sql(`INSERT INTO nook_events SELECT id,seq,'reaction',?,? FROM nook_conversations WHERE id=? AND ${input.add?'NOT ':''}${exists}`,id,c.uid,m.conversation,id,c.uid,input.emoji),
  input.add?c.sql('INSERT OR IGNORE INTO nook_reactions VALUES(?,?,?,?)',id,c.uid,input.emoji,new Date().toISOString()):c.sql('DELETE FROM nook_reactions WHERE message=? AND user=? AND emoji=?',id,c.uid,input.emoji)
 ],m.conversation,'EXISTS(SELECT 1 FROM nook_messages WHERE id=? AND deleted=0)',[id]);
 await c.hint();return reactions(c,id)
}
