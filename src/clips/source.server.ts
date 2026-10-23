import type {Context} from '../platform/storage/context'
import {message} from '../platform/storage/read'
import {fail,Fault} from '../family/team-chat/domain'
import {isClipMime} from './media'
/** First identify the source through a no-scope query, then authorize with the
 * ordinary message door. Unrelated admins receive the same 404 as missing. */
export async function source(c:Context,attachment:string){
 const file=await c.one("SELECT a.id,a.message,a.conversation,a.mime,a.author FROM nook_attachments a JOIN nook_messages m ON m.id=a.message AND m.conversation=a.conversation AND m.deleted=0 WHERE a.id=? AND a.state='attached' AND NOT EXISTS(SELECT 1 FROM nook_import_files f WHERE f.attachment=a.id)",[attachment])
 if(!file||!isClipMime(file.mime))fail(404,'Clip unavailable')
 const parent=await message(c,file.message).catch(error=>{if(error instanceof Fault&&[403,404].includes(error.status))fail(404,'Clip unavailable');throw error})
 if(parent.deleted||parent.immutable||parent.conversation!==file.conversation)fail(404,'Clip unavailable')
 return {...file,parent:parent.parent}
}
export const liveSource=`EXISTS(SELECT 1 FROM nook_attachments a JOIN nook_messages m ON m.id=a.message AND m.conversation=a.conversation AND m.deleted=0 WHERE a.id=? AND a.message=? AND a.conversation=? AND a.state='attached' AND a.mime=? AND NOT EXISTS(SELECT 1 FROM nook_import_files f WHERE f.attachment=a.id))`
