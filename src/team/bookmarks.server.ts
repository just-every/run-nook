import {fail} from '../family/team-chat/domain'
import type {Context} from '../platform/storage/context'
import {canPost} from './posting-policy'
import {fullMember} from './access'
import {savedId,savedUrl,savedTargetFence} from './saved-policy'

export const BOOKMARKS_MAX=50,FOLDER_MAX=25,TITLE_MAX=80
const object=(value:unknown)=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:fail(400,'Expected a JSON object')
// Members who may post in the channel manage its bar; a guest, or someone held to an announcement-only policy, may only read it.
const permit=`${canPost('?','?','NULL')} AND ${fullMember('?')} AND EXISTS(SELECT 1 FROM nook_conversations WHERE id=? AND kind IN ('channel','private'))`
const permitValues=(c:Context,conversation:string)=>[conversation,c.uid,c.uid,conversation]
const refusal='Bookmarks are managed by members who can post in this channel'
async function permitted(c:Context,conversation:string){if(!await c.one(`SELECT 1 WHERE ${permit}`,permitValues(c,conversation),conversation))fail(403,refusal)}
const audit=(c:Context,conversation:string,kind:string,reason:string,count:string,...countValues:any[])=>c.sql(`INSERT INTO nook_audit SELECT ?,?,'bookmarks',?,?,?,(SELECT version FROM nook_bookmark_versions WHERE conversation=?),?,'confirmed',${count}`,crypto.randomUUID(),c.uid,Date.now(),kind,conversation,conversation,reason,...countValues)
// Each change moves the conversation frontier, so every open tab refreshes its bar. The event names the channel and no person.
const bump=(c:Context,conversation:string)=>[c.sql('INSERT INTO nook_bookmark_versions VALUES(?,1) ON CONFLICT(conversation) DO UPDATE SET version=version+1',conversation),c.sql('UPDATE nook_conversations SET seq=seq+1 WHERE id=?',conversation),c.sql("INSERT INTO nook_events SELECT id,seq,'bookmarks',id,NULL FROM nook_conversations WHERE id=?",conversation)]
const expected=(version:number)=>({sql:'COALESCE((SELECT version FROM nook_bookmark_versions WHERE conversation=?),0)=?',values:(conversation:string)=>[conversation,version]})

/** Previews follow the reader's current access: a file shows its name only while it is a live attached file of this channel; a link is stored text and is never fetched. */
export async function bookmarks(c:Context,value:unknown){
 const conversation=savedId(value),kind=await c.one('SELECT kind FROM nook_conversations WHERE id=?',[conversation],conversation)
 if(!kind||!['channel','private'].includes(kind.kind))fail(404,'Bookmarks are for channels')
 const [rows,version,can]=await Promise.all([
  c.rows(`SELECT b.id,b.kind,b.title,b.parent,b.position,b.created,CASE WHEN b.kind='link' THEN b.target END AS url,CASE WHEN b.kind='file' THEN b.target END AS file,af.name AS file_name,af.mime AS file_mime,af.size AS file_size,CASE WHEN b.kind='file' THEN af.id IS NOT NULL END AS file_available,b.author,a.display_name AS author_name
   FROM nook_bookmarks b LEFT JOIN nook_attachments af ON b.kind='file' AND af.id=b.target AND af.conversation=b.conversation AND af.state='attached' AND af.object_key IS NOT NULL AND EXISTS(SELECT 1 FROM nook_messages m WHERE m.id=af.message AND m.deleted=0)
   LEFT JOIN oa_operators a ON a.id=b.author WHERE b.conversation=? ORDER BY b.parent IS NOT NULL,b.parent,b.position`,[conversation],conversation),
  c.one('SELECT COALESCE((SELECT version FROM nook_bookmark_versions WHERE conversation=?),0) AS version',[conversation],conversation),
  c.one(`SELECT 1 AS can WHERE ${permit}`,permitValues(c,conversation),conversation),
 ])
 const items=rows.map((r:any)=>({id:r.id,kind:r.kind,title:r.title,parent:r.parent,position:r.position,created:r.created,
  ...(r.kind==='link'?{url:r.url}:{}),
  ...(r.kind==='file'?{file:r.file_available?{id:r.file,name:r.file_name,mime:r.file_mime,size:r.file_size,available:true}:{available:false}}:{}),
  addedBy:r.author&&r.author_name?{id:r.author,name:r.author_name}:null}))
 return {version:version!.version,canManage:!!can,limit:BOOKMARKS_MAX,items}
}

/** Exact JSON: {kind:'link',title,url} | {kind:'file',title,file} | {kind:'folder',title}, plus optional {parent:folder id}. */
export async function addBookmark(c:Context,value:unknown,input:unknown){
 const conversation=savedId(value),body=object(input),kind=body.kind
 if(!['link','file','folder'].includes(kind as string))fail(400,'Choose a link, a file or a folder')
 const allowed=['kind','title','parent',...(kind==='link'?['url']:kind==='file'?['file']:[])]
 if(Object.keys(body).some(key=>!allowed.includes(key)))fail(400,'Unexpected bookmark field')
 const title=typeof body.title==='string'?body.title.trim():''
 if(!title||title.length>TITLE_MAX)fail(400,`Give the bookmark a title of up to ${TITLE_MAX} characters`)
 const parent=body.parent===undefined||body.parent===null?null:savedId(body.parent)
 if(parent&&kind==='folder')fail(400,'Folders hold bookmarks, not other folders')
 const target=kind==='link'?savedUrl(body.url):kind==='file'?savedId(body.file):null
 await permitted(c,conversation)
 const fence=kind==='file'?savedTargetFence('attachment'):'1',fenceValues=kind==='file'?[target,conversation]:[]
 if(kind==='file'&&!await c.one(`SELECT 1 WHERE ${fence}`,fenceValues,conversation))fail(404,'That file is not available in this channel')
 if(parent&&!await c.one("SELECT 1 FROM nook_bookmarks WHERE id=? AND conversation=? AND kind='folder'",[parent,conversation],conversation))fail(404,'Folder unavailable')
 const total=(await c.one('SELECT count(*) AS n FROM nook_bookmarks WHERE conversation=?',[conversation],conversation))!.n,inFolder=parent?(await c.one('SELECT count(*) AS n FROM nook_bookmarks WHERE conversation=? AND parent=?',[conversation,parent],conversation))!.n:0
 if(total>=BOOKMARKS_MAX)fail(409,`A channel holds at most ${BOOKMARKS_MAX} bookmarks`)
 if(inFolder>=FOLDER_MAX)fail(409,`A folder holds at most ${FOLDER_MAX} bookmarks`)
 const id=crypto.randomUUID(),reason=kind==='folder'?'Bookmark folder added':kind==='file'?'File bookmark added':'Link bookmark added'
 await c.writeBatch([
  ...bump(c,conversation),
  c.sql('INSERT INTO nook_bookmarks SELECT ?,?,?,?,?,?,COALESCE((SELECT max(position) FROM nook_bookmarks WHERE conversation=? AND parent IS ?),0)+1,?,?',id,conversation,kind,title,target,parent,conversation,parent,c.uid,Date.now()),
  audit(c,conversation,'bookmark.add',reason,'1'),
 ],conversation,`${permit} AND ${fence} AND (SELECT count(*) FROM nook_bookmarks WHERE conversation=?)<? AND (? IS NULL OR EXISTS(SELECT 1 FROM nook_bookmarks WHERE id=? AND conversation=? AND kind='folder'))`,[...permitValues(c,conversation),...fenceValues,conversation,BOOKMARKS_MAX,parent,parent,conversation])
 await c.hint()
 return bookmarks(c,conversation)
}

/** Exact JSON: {version,parent:folder id|null,order:[every id under that parent]}. A stale version or a partial order is refused, never merged. */
export async function reorderBookmarks(c:Context,value:unknown,input:unknown){
 const conversation=savedId(value),body=object(input)
 if(Object.keys(body).sort().join()!=='order,parent,version'||!Number.isSafeInteger(body.version)||!Array.isArray(body.order)||body.order.length>BOOKMARKS_MAX||body.order.some(id=>typeof id!=='string'||!id)||new Set(body.order).size!==body.order.length)fail(400,'Send the current version and the full order')
 const parent=body.parent===null?null:savedId(body.parent),order=body.order as string[],version=body.version as number
 await permitted(c,conversation)
 const current=await c.one('SELECT COALESCE((SELECT version FROM nook_bookmark_versions WHERE conversation=?),0) AS version',[conversation],conversation)
 if(current!.version!==version)fail(409,'The bookmarks changed; reload before reordering')
 const same=`(SELECT count(*) FROM nook_bookmarks WHERE conversation=? AND parent IS ?)=? AND NOT EXISTS(SELECT 1 FROM json_each(?) j WHERE NOT EXISTS(SELECT 1 FROM nook_bookmarks b WHERE b.id=j.value AND b.conversation=? AND b.parent IS ?))`,sameValues=[conversation,parent,order.length,JSON.stringify(order),conversation,parent]
 if(!await c.one(`SELECT 1 WHERE ${same}`,sameValues,conversation))fail(409,'The bookmarks changed; reload before reordering')
 await c.writeBatch([
  ...bump(c,conversation),
  ...order.map((id,index)=>c.sql('UPDATE nook_bookmarks SET position=? WHERE id=? AND conversation=?',index+1,id,conversation)),
  audit(c,conversation,'bookmark.reorder','Bookmarks reordered','?',order.length),
 ],conversation,`${permit} AND ${expected(version).sql} AND ${same}`,[...permitValues(c,conversation),...expected(version).values(conversation),...sameValues])
 await c.hint()
 return bookmarks(c,conversation)
}

/** Removing a folder removes the bookmarks inside it; one audit row counts them. */
export async function removeBookmark(c:Context,value:unknown,bookmark:unknown){
 const conversation=savedId(value),id=savedId(bookmark)
 await permitted(c,conversation)
 const row=await c.one('SELECT kind FROM nook_bookmarks WHERE id=? AND conversation=?',[id,conversation],conversation)
 if(!row)fail(404,'Bookmark unavailable')
 await c.writeBatch([
  ...bump(c,conversation),
  audit(c,conversation,'bookmark.remove',row.kind==='folder'?'Bookmark folder removed':'Bookmark removed','(SELECT count(*) FROM nook_bookmarks WHERE conversation=? AND (id=? OR parent=?))',conversation,id,id),
  c.sql('DELETE FROM nook_bookmarks WHERE conversation=? AND (id=? OR parent=?)',conversation,id,id),
 ],conversation,`${permit} AND EXISTS(SELECT 1 FROM nook_bookmarks WHERE id=? AND conversation=?)`,[...permitValues(c,conversation),id,conversation])
 await c.hint()
 return bookmarks(c,conversation)
}
