import type {Context} from '../platform/storage/context'
import {allowedGrant} from '../team/access'
import {publishedImport,sourceCreated} from '../imports/projection'
// This is a disclosed copy projection, not a source read grant. The destination
// is authorized first; only Show message permits its body. No source name leaks.
async function source(c:Context,id:string){
 const native=await c.one(`SELECT m.id,m.conversation,m.body,m.parent,m.version,m.created,a.name AS authorName FROM nook_messages m JOIN nook_actors a ON a.id=m.author WHERE m.id=? AND m.deleted=0`,[id]);if(native)return native
 const row=await c.one(`SELECT r.id,r.conversation,r.body,r.parent,1 AS version,r.source_timestamp,a.source_record FROM nook_import_records r JOIN nook_imports j ON j.id=r.job AND j.state='complete' AND ${publishedImport} LEFT JOIN nook_import_actors a ON a.job=r.job AND a.source_id=r.source_actor WHERE r.id=?`,[id]);if(!row)return null
 let actor:any={};try{actor=JSON.parse(row.source_record??'{}')}catch{}return {...row,created:sourceCreated(row.source_timestamp),authorName:actor.real_name??actor.name??'Imported author'}
}
export async function effectiveBody(c:Context,id:string){
 const seen=new Set<string>(),parts:string[]=[];let next:string|null=id
 while(next){if(seen.has(next))return null;seen.add(next);const row=await source(c,next);if(!row)return null;parts.push(row.body);const forward:{source:string;mode:string}|null=await c.one<{source:string;mode:string}>('SELECT source,mode FROM nook_forwards WHERE message=?',[next]);next=forward?.mode==='show'?forward.source:null}
 return parts.filter(Boolean).join('\n\n')
}
export async function forwardProjection(c:Context,items:any[],conversation?:string){
 if(!items.length)return items
 const records=new Map((await c.rows('SELECT * FROM nook_forwards WHERE message IN (SELECT value FROM json_each(?))',[JSON.stringify(items.map(m=>m.id))],conversation??items[0].conversation)).map(row=>[row.message,row]))
 for(const item of items){
  const row=records.get(item.id);if(!row)continue
  const original=await source(c,row.source)
  if(!original){item.deleted=1;item.body='';item.attachments=[];item.forward={tombstone:true};continue}
  const accessible=await c.one(`SELECT v.name FROM nook_conversations v JOIN nook_members m ON m.conversation=v.id WHERE v.id=? AND m.user=? AND ${allowedGrant('m.user','m.conversation')} AND NOT EXISTS(SELECT 1 FROM nook_import_channels ch JOIN nook_imports j ON j.id=ch.job WHERE ch.conversation=v.id AND (j.state<>'complete' OR NOT (${publishedImport})))`,[original.conversation,c.uid])
  item.forward={mode:row.mode,note:row.note,author:original.authorName,created:original.created,source:row.source,conversation:accessible?original.conversation:null,name:accessible?.name??null,body:row.mode==='show'?await effectiveBody(c,row.source):null}
 }
 return items
}
