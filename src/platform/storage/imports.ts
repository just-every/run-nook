import {historicalMessage,importedSelect} from '../../imports/projection'
import {publicMattermostRecord} from '../../imports/mattermost-public'
import {fail} from '../../family/team-chat/domain'
import type {Context} from './context'
import {download} from './files'
import {search} from './read'
export async function imports(c:Context,action:string,id:string,input:Record<string,any>={}):Promise<any>{
 if(action==='search')return search(c,input,'imported')
 if(action==='file'){const f=await c.one('SELECT f.attachment FROM nook_import_files f JOIN nook_imports j ON j.id=f.job WHERE f.id=? AND j.state=?',[id,'complete']);if(!f)fail(404,'Imported file unavailable');return download(c,f.attachment)}
 if(action==='history'){await c.check(id);const limit=input.limit??100,after=input.after??'';if(typeof after!=='string'||!Number.isSafeInteger(limit)||limit<1||limit>1000)fail(400,'Invalid imported history page');const cursor=after?await c.one('SELECT sequence FROM nook_import_history WHERE id=? AND conversation=?',[after,id],id):null;if(after&&!cursor)fail(400,'Imported history cursor unavailable');const rows=await c.rows(`${importedSelect} WHERE r.conversation=? AND r.sequence>? ORDER BY r.sequence LIMIT ?`,[id,cursor?.sequence??0,limit+1],id);const hasMore=rows.length>limit;rows.splice(limit);const records=[];for(const r of rows){if(r.erased){records.push(await historicalMessage(c,r));continue}records.push({id:r.id,conversation:r.conversation,body:r.body,parent:r.parent,immutable:true,provenance:{namespace:r.namespace,key:r.key,actor:r.source_actor,label:JSON.parse(r.actor_record).name??r.source_actor,association:r.association,timestamp:r.source_timestamp,sourceRecord:publicMattermostRecord(JSON.parse(r.source_record))},attachments:await c.rows('SELECT f.id,f.source_id,a.name,a.mime,a.size,a.sha256 FROM nook_import_files f JOIN nook_attachments a ON a.id=f.attachment WHERE f.message=? ORDER BY f.position LIMIT 5',[r.id],id)})}return {records,cursor:records.at(-1)?.id??after,hasMore}}
 fail(404,'Not found')
}
