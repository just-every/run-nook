import type {Context} from '../platform/storage/context'
import {allowedGrant} from '../team/access'
import {publishedImport} from '../imports/projection'
import {extractFileText,fileExtractionLimits} from './file-extract'

export {fileExtractionLimits}
export type FileSearchText={attachment:string;name:string;text:string;status:'indexed'|'unsupported'|'unindexed'}
type FileRow={id:string;message:string;conversation:string;name:string;mime:string;size:number;sha256:string|null;object_key:string|null}

// Attachment rows do not themselves grant access. Requiring a live source also
// excludes staged files, erased messages and unpublished/undone imported files.
const liveFiles=`WITH args AS (SELECT ? AS user,? AS messages)
 SELECT a.id,a.message,a.conversation,a.name,a.mime,a.size,a.sha256,a.object_key
 FROM json_each((SELECT messages FROM args)) requested
 JOIN nook_attachments a ON a.message=requested.value CROSS JOIN args
 WHERE a.state='attached'
 AND EXISTS(SELECT 1 FROM nook_members member WHERE member.conversation=a.conversation AND member.user=args.user AND ${allowedGrant('member.user','member.conversation')})
 AND NOT EXISTS(SELECT 1 FROM nook_import_channels ch JOIN nook_imports j ON j.id=ch.job WHERE ch.conversation=a.conversation AND (j.state<>'complete' OR NOT (${publishedImport})))
 AND (EXISTS(SELECT 1 FROM nook_messages m WHERE m.id=a.message AND m.conversation=a.conversation AND m.deleted=0)
 OR EXISTS(SELECT 1 FROM nook_import_files link JOIN nook_import_records r ON r.id=link.message AND r.job=link.job AND r.conversation=a.conversation JOIN nook_imports j ON j.id=r.job
 WHERE link.attachment=a.id AND link.message=a.message AND j.state='complete' AND ${publishedImport}))
 ORDER BY a.message,a.position,a.id`

const sameFile=(a:FileRow,b:FileRow)=>a.id===b.id&&a.message===b.message&&a.conversation===b.conversation&&a.name===b.name&&a.mime===b.mime&&a.size===b.size&&a.sha256===b.sha256&&a.object_key===b.object_key
const supported=(mime:string)=>mime==='text/plain'||mime==='application/pdf'
const digest=async(bytes:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as Uint8Array<ArrayBuffer>)),value=>value.toString(16).padStart(2,'0')).join('')

async function readText(c:Context,row:FileRow):Promise<FileSearchText>{
 const result:FileSearchText={attachment:row.id,name:row.name,text:'',status:supported(row.mime)?'unindexed':'unsupported'}
 if(!supported(row.mime)||!row.object_key||!row.sha256||row.size<1||row.size>fileExtractionLimits.bytes)return result
 try{
  const object=await c.env.FILES.get(row.object_key)
  if(!object)return result
  if(object.size!==row.size||object.customMetadata?.sha256!==row.sha256){await object.body.cancel();return result}
  const bytes=new Uint8Array(await object.arrayBuffer())
  if(bytes.length!==row.size||await digest(bytes)!==row.sha256)return result
  const text=await extractFileText(bytes,row.mime)
  if(text===null)return result
  // A replacement/deletion during parsing invalidates the captured bytes even
  // when the attachment metadata has not changed yet.
  const current=await c.env.FILES.head(row.object_key)
  if(!current||current.version!==object.version||current.size!==row.size||current.customMetadata?.sha256!==row.sha256)return result
  result.text=text;result.status='indexed'
 }catch{
  // Parse failures and unavailable/corrupt objects are explicit unindexed files;
  // parser/provider errors may contain private storage keys and never escape.
 }
 return result
}

/** Derive text from current private R2 bytes, with at most two files resident at
 * once. No extracted text or private object key is persisted or returned as
 * metadata. Callers match both name and text, and expose non-indexed statuses.
 * The final authenticated snapshot rechecks every file and its current ACL
 * after ALL R2/extraction awaits, so a slow later file cannot stale earlier ACLs.
 */
export async function searchFileText(c:Context,messageIds:string[]):Promise<Map<string,FileSearchText[]>>{
 const result=new Map<string,FileSearchText[]>(),ids=[...new Set(messageIds)]
 if(!ids.length){await c.check();return result}
 const args=[c.uid,JSON.stringify(ids)],rows=await c.rows<FileRow>(liveFiles,args)
 const extracted:FileSearchText[]=new Array(rows.length)
 let next=0
 await Promise.all(Array.from({length:Math.min(2,rows.length)},async()=>{
  while(next<rows.length){const index=next++;extracted[index]=await readText(c,rows[index])}
 }))
 const current=new Map((await c.rows<FileRow>(liveFiles,args)).map(row=>[row.id,row]))
 for(let index=0;index<rows.length;index++){
  const row=rows[index],now=current.get(row.id)
  if(!now||!sameFile(row,now))continue
  const files=result.get(row.message)??[]
  files.push(extracted[index]);result.set(row.message,files)
 }
 return result
}

/** Final response fence after imported message presentation has awaited reads. */
export async function currentSearchFiles(c:Context,messageIds:string[]){
 return new Set((await c.rows<FileRow>(liveFiles,[c.uid,JSON.stringify(messageIds)])).map(row=>row.id))
}
