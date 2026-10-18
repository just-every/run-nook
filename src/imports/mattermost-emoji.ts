import {context,type StorageBindings} from '../platform/storage/context'
import {Fault,fail} from '../family/team-chat/domain'
import {publishedImport} from './projection'
export async function mattermostEmojiRoute(request:Request,env:StorageBindings):Promise<Response|null>{
 const match=new URL(request.url).pathname.match(/^\/api\/mattermost-emoji\/([^/]+)\/([^/]+)$/)
 if(!match)return null
 try{
  if(request.method!=='GET')fail(405,'Read only')
  const c=await context(env,request.headers),conversation=decodeURIComponent(match[1]),name=decodeURIComponent(match[2]);await c.check(conversation)
  const job=await c.one(`SELECT j.id FROM nook_import_channels ch JOIN nook_imports j ON j.id=ch.job WHERE ch.conversation=? AND j.state='complete' AND ${publishedImport}`,[conversation],conversation)
  if(!job)fail(404,'Source emoji unavailable')
  const catalogs=await c.rows('SELECT source_record FROM nook_import_channels WHERE job=?',[job.id],conversation)
  const emoji=catalogs.flatMap(row=>JSON.parse(row.source_record).emojiCatalog??[]).find(e=>e.name===name)
  if(!emoji)fail(404,'Source emoji unavailable')
  return new Response(Buffer.from(emoji.base64,'base64'),{headers:{'Content-Type':emoji.mime,'Content-Length':String(emoji.size),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}})
 }catch(error){return new Response('Source emoji unavailable',{status:error instanceof Fault?error.status:404,headers:{'Cache-Control':'no-store'}})}
}
