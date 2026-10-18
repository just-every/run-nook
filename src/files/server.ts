import type {Context} from '../platform/storage/context'
import {allowedGrant} from '../team/access'
import {publishedImport} from '../imports/projection'
import {messageAuthorLabel} from '../imports/slack-records.mjs'
import {filesAfter,filesCursor,filesFilters} from './query'
import type {FilesPage,ListedFile} from './types'

const pageSize=50
const audience=`EXISTS(SELECT 1 FROM nook_members member WHERE member.conversation=f.conversation AND member.user=args.user AND ${allowedGrant('member.user','member.conversation')})
 AND NOT EXISTS(SELECT 1 FROM nook_import_channels ch JOIN nook_imports j ON j.id=ch.job WHERE ch.conversation=f.conversation AND (j.state<>'complete' OR NOT (${publishedImport})))`
const sql=`WITH args AS (SELECT ? AS user,? AS conversation,? AS person,? AS type,? AS stamp,? AS id),
 available AS (
  SELECT a.id,a.conversation,a.message,a.name,a.mime,a.size,m.parent,m.author,person.name AS author_name,
   CAST(round(unixepoch(m.created,'subsec')*1000) AS INTEGER) AS stamp,'native' AS source,NULL AS actor_record,NULL AS source_record,NULL AS source_actor
  FROM nook_attachments a JOIN nook_messages m ON m.id=a.message AND m.conversation=a.conversation
  JOIN nook_actor_history person ON person.id=m.author
  WHERE a.state='attached' AND a.object_key IS NOT NULL AND m.deleted=0
  UNION ALL
  SELECT a.id,a.conversation,a.message,a.name,a.mime,a.size,r.parent,actor.association AS author,NULL AS author_name,
   CAST(CAST(r.source_timestamp AS REAL)*1000 AS INTEGER) AS stamp,'imported' AS source,actor.source_record AS actor_record,r.source_record,r.source_actor
  FROM nook_attachments a JOIN nook_import_files link ON link.attachment=a.id AND link.message=a.message
  JOIN nook_import_records r ON r.id=link.message AND r.job=link.job AND r.conversation=a.conversation
  JOIN nook_imports j ON j.id=r.job
  LEFT JOIN nook_import_actors actor ON actor.job=r.job AND actor.source_id=r.source_actor
  WHERE a.state='attached' AND a.object_key IS NOT NULL AND j.state='complete' AND ${publishedImport}
 ) SELECT f.* FROM available f CROSS JOIN args
 WHERE ${audience}
 AND (args.conversation IS NULL OR f.conversation=args.conversation)
 AND (args.person IS NULL OR f.author=args.person)
 AND (args.type='' OR args.type='image' AND f.mime LIKE 'image/%'
  OR args.type='pdf' AND f.mime='application/pdf' OR args.type='text' AND f.mime='text/plain'
  OR args.type='other' AND f.mime NOT LIKE 'image/%' AND f.mime NOT IN ('application/pdf','text/plain'))
 AND (args.stamp IS NULL OR f.stamp<args.stamp OR f.stamp=args.stamp AND f.id<args.id)
 ORDER BY f.stamp DESC,f.id DESC LIMIT ${pageSize+1}`

/** Metadata, live source, import publication and current audience are read in
 * one authenticated D1 snapshot. No R2 keys or source JSON reach the response.
 * Imported attachment.created is an epoch placeholder, so order by the message's
 * source time; native files likewise use the time they were shared. */
export async function listFiles(c:Context,input:Record<string,unknown>={}):Promise<FilesPage>{
 const filters=filesFilters(input,c.uid),after=filesAfter(input.after,filters)
 const rows=await c.rows(sql,[c.uid,filters.conversation,filters.person,filters.type,after?.stamp??null,after?.id??null],filters.conversation??undefined)
 const selected=rows.slice(0,pageSize)
 const items:ListedFile[]=selected.map(row=>({
  id:row.id,conversation:row.conversation,message:row.message,parent:row.parent,
  name:row.name,mime:row.mime,size:row.size,created:new Date(row.stamp).toISOString(),
  author:row.author??null,authorName:row.source==='native'?row.author_name:messageAuthorLabel(JSON.parse(row.actor_record??'{}'),JSON.parse(row.source_record))??row.source_actor,
  source:row.source,
 }))
 const last=selected.at(-1)
 return {items,hasMore:rows.length>pageSize,cursor:last?filesCursor({stamp:last.stamp,id:last.id},filters):''}
}
