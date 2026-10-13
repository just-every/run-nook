import {fail,text} from '../family/team-chat/domain'
import {Context} from '../platform/storage/context'
import {fullMember} from './access'
export async function browseChannels(c:Context,after=''){
 if(after.length>128)fail(400,'Invalid channel cursor')
 const mode=await c.one('SELECT mode FROM nook_access WHERE user=?',[c.uid]);if(mode?.mode!=='member')fail(403,'Channel discovery is available to workspace members')
 const rows=await c.rows(`SELECT id,name FROM nook_conversations WHERE kind='channel' AND id>? AND NOT EXISTS(SELECT 1 FROM nook_members WHERE conversation=nook_conversations.id AND user=?) AND ${fullMember('?')} ORDER BY id LIMIT 51`,[after,c.uid,c.uid]);
 return {items:rows.slice(0,50),cursor:rows.length>50?rows[49].id:null}
}
export async function joinChannel(c:Context,id:string){
 text(id,128)
 if((await c.one('SELECT mode FROM nook_access WHERE user=?',[c.uid]))?.mode!=='member')fail(403,'Channel joining is available to workspace members')
 if(!await c.one("SELECT id FROM nook_conversations WHERE id=? AND kind='channel'",[id]))fail(404,'Public channel unavailable')
 await c.batch([
  c.sql("UPDATE nook_conversations SET seq=seq+1 WHERE id=? AND NOT EXISTS(SELECT 1 FROM nook_members WHERE conversation=? AND user=?)",id,id,c.uid),
  c.sql("INSERT INTO nook_events SELECT id,seq,'membership',?,? FROM nook_conversations WHERE id=? AND NOT EXISTS(SELECT 1 FROM nook_members WHERE conversation=? AND user=?)",c.uid,c.uid,id,id,c.uid),
  c.sql('INSERT OR IGNORE INTO nook_members VALUES(?,?)',id,c.uid)
 ],undefined,`${fullMember('?')} AND EXISTS(SELECT 1 FROM nook_conversations WHERE id=? AND kind='channel') AND (EXISTS(SELECT 1 FROM nook_members WHERE conversation=? AND user=?) OR (SELECT count(*) FROM nook_members WHERE conversation=?)<50)`,[c.uid,id,id,c.uid,id]);
 await c.hint();return {id,joined:true,history:'full'}
}
