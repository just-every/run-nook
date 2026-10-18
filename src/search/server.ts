import {fail} from '../family/team-chat/domain'
import {allowedGrant,visibleIdentity} from '../team/access'
import type {Context} from '../platform/storage/context'
import {publishedImport,sourceCreated} from '../imports/projection'
import {slackText} from '../imports/presentation'
import {messageAuthorLabel} from '../imports/slack-records.mjs'
import {parseSearch,searchCursor,type SearchQuery,type SearchSource,type SearchPosition} from './query'
import {matchesSearch,searchExcerpt} from './terms'
import {searchFileText,currentSearchFiles} from './files'

const pageSize=100,scanSize=2000
const access=(conversation:string,user='a.user')=>`EXISTS(SELECT 1 FROM nook_members audience WHERE audience.conversation=${conversation} AND audience.user=${user} AND ${allowedGrant('audience.user','audience.conversation')}) AND NOT EXISTS(SELECT 1 FROM nook_import_channels ch JOIN nook_imports j ON j.id=ch.job WHERE ch.conversation=${conversation} AND (j.state<>'complete' OR NOT (${publishedImport})))`
const milliseconds=(alias:string)=>`(CAST(substr(${alias}.source_timestamp,1,instr(${alias}.source_timestamp,'.')-1) AS INTEGER)*1000+CAST(substr(${alias}.source_timestamp,instr(${alias}.source_timestamp,'.')+1,3) AS INTEGER))`
const escaped=(text:string)=>text.replace(/[&<>]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;'})[ch]!)
const quote=(text:string)=>'"'+text.replaceAll('"','""')+'"'

async function resolveFilters(c:Context,query:SearchQuery){
 const result={...query}
 if(query.conversation){
  const rows=await c.rows(`SELECT cv.id FROM nook_conversations cv WHERE ${access('cv.id','?')} AND (cv.id=? OR cv.name=? COLLATE NOCASE) ORDER BY CASE WHEN cv.id=? THEN 0 ELSE 1 END,cv.id LIMIT 2`,[c.uid,query.conversation,query.conversation,query.conversation])
  if(!rows.length)fail(400,'Conversation filter is unavailable')
  if(rows.length>1&&rows[0].id!==query.conversation)fail(400,'Conversation name is ambiguous; choose its ID')
  result.conversation=rows[0].id
 }
 for(const key of ['person','participant'] as const){
  const value=query[key]
  if(value==='me'){result[key]=c.uid;continue}
  if(!value)continue
  const rows=await c.rows(`SELECT person.id FROM nook_actor_history person WHERE person.erased=0 AND ${visibleIdentity('?','person.id')} AND (person.id=? OR person.name=? COLLATE NOCASE) ORDER BY CASE WHEN person.id=? THEN 0 ELSE 1 END,person.id LIMIT 2`,[c.uid,c.uid,c.uid,value,value,value])
  if(!rows.length)fail(400,'Person filter is unavailable')
  if(rows.length>1&&rows[0].id!==value)fail(400,'Person name is ambiguous; choose their ID')
  result[key]=rows[0].id
 }
 return result
}

function filters(alias:string,stamp:string,person:string){return `${access(alias+'.conversation')}
 AND (a.conversation IS NULL OR ${alias}.conversation=a.conversation)
 AND (a.kind IS NULL OR EXISTS(SELECT 1 FROM nook_conversations cv WHERE cv.id=${alias}.conversation AND cv.kind=a.kind))
 AND (a.participant IS NULL OR EXISTS(SELECT 1 FROM nook_members peer WHERE peer.conversation=${alias}.conversation AND peer.user=a.participant))
 AND (a.direct_to_me=0 OR ${person}<>a.user)
 AND (a.thread=0 OR ${alias}.parent IS NOT NULL OR EXISTS(SELECT 1 FROM nook_messages reply WHERE reply.parent=${alias}.id AND reply.deleted=0) OR EXISTS(SELECT 1 FROM nook_import_history reply WHERE reply.parent=${alias}.id AND reply.erased=0))
 AND (a.link=0 OR instr(${alias}.body_lower,'https://')>0 OR instr(${alias}.body_lower,'http://')>0 OR instr(${alias}.body_lower,'mailto:')>0 OR instr(${alias}.body_lower,'](/')>0)
 AND (a.reaction IS NULL OR EXISTS(SELECT 1 FROM nook_reactions reaction WHERE reaction.message=${alias}.id AND reaction.emoji=a.reaction) ${alias==='r'?`OR EXISTS(SELECT 1 FROM json_each(json_extract(r.source_record,'$.reactions')) reaction WHERE json_extract(reaction.value,'$.name')=a.reaction_name AND json_extract(reaction.value,'$.count')>0)`:''})
 AND (a.person IS NULL OR (${alias}.retained_body=0 AND ${person}=a.person))
 AND (a.after_date IS NULL OR ${stamp}>=a.after_date) AND (a.before_date IS NULL OR ${stamp}<a.before_date)
 AND (a.has_file=0 OR EXISTS(SELECT 1 FROM nook_attachments af WHERE af.message=${alias}.id AND af.conversation=${alias}.conversation AND af.state='attached' AND af.object_key IS NOT NULL))
 AND (a.pinned=0 OR (${alias}.erased=0 AND EXISTS(SELECT 1 FROM nook_channel_pins pin WHERE pin.conversation=${alias}.conversation AND pin.message=${alias}.id)))
 AND (a.saved=0 OR (${alias}.erased=0 AND EXISTS(SELECT 1 FROM nook_saved_items saved WHERE saved.user=a.user AND saved.conversation=${alias}.conversation AND (saved.kind='message' AND saved.target=${alias}.id OR saved.kind='attachment' AND EXISTS(SELECT 1 FROM nook_attachments sf WHERE sf.id=saved.target AND sf.message=${alias}.id AND sf.state='attached' AND sf.object_key IS NOT NULL)))))`}

// Drive FTS once from the query arguments; correlating MATCH with each history row rebuilds its hit list.
function pageSql(useFts:boolean){
 const fts=(source:SearchSource,alias:string)=>useFts?`AND (${alias}.id IN (SELECT message FROM search_matches WHERE source='${source}') OR EXISTS(SELECT 1 FROM nook_attachments file WHERE file.message=${alias}.id AND file.conversation=${alias}.conversation AND file.state='attached' AND file.object_key IS NOT NULL))`:''
 return `WITH a AS (SELECT ? AS user,? AS term,? AS slack_term,? AS after_source,? AS after_id,? AS conversation,? AS person,? AS after_date,? AS before_date,? AS has_file,? AS saved,? AS pinned,? AS source_only,? AS fts,? AS kind,? AS participant,? AS direct_to_me,? AS thread,? AS link,? AS reaction,? AS reaction_name),
 ${useFts?`search_matches AS MATERIALIZED (SELECT message,source FROM a CROSS JOIN nook_search WHERE nook_search MATCH a.fts),`:''}
 native_live_page AS MATERIALIZED (
  SELECT 0 AS source_class,m.id,m.conversation,m.body_lower AS search_body FROM nook_messages m CROSS JOIN a
  WHERE m.deleted=0 AND (a.source_only IS NULL OR a.source_only='native') AND a.after_source=0 AND m.id>a.after_id
  AND ${filters('m',"CAST(unixepoch(m.created,'subsec')*1000 AS INTEGER)",'m.author').replaceAll('m.retained_body','0').replaceAll('m.erased','0')} ${fts('native','m')}
  ORDER BY m.id LIMIT ${scanSize+1}
 ), native_retained_page AS MATERIALIZED (
  SELECT 0 AS source_class,m.id,m.conversation,m.body_lower AS search_body FROM nook_message_history m CROSS JOIN a
  WHERE m.retained_body=1 AND m.deleted=0 AND (a.source_only IS NULL OR a.source_only='native') AND a.after_source=0 AND m.id>a.after_id
  AND ${filters('m',"CAST(unixepoch(m.created,'subsec')*1000 AS INTEGER)",'m.author')} ${fts('native','m')}
  ORDER BY m.id LIMIT ${scanSize+1}
 ), native_page AS MATERIALIZED (SELECT * FROM native_live_page UNION ALL SELECT * FROM native_retained_page ORDER BY id LIMIT ${scanSize+1}
 ), imported_page AS MATERIALIZED (
  SELECT 1 AS source_class,r.id,r.conversation,r.body_lower AS search_body FROM nook_import_history r
  JOIN nook_imports j ON j.id=r.job LEFT JOIN nook_import_actors actor ON actor.job=r.job AND actor.source_id=r.source_actor CROSS JOIN a
  WHERE (r.erased=0 OR r.retained_body=1) AND j.state='complete' AND ${publishedImport}
  AND (a.source_only IS NULL OR a.source_only='imported') AND (a.after_source=0 OR r.id>a.after_id)
  AND ${filters('r',milliseconds('r'),'actor.association')} ${fts('imported','r')}
  ORDER BY r.id LIMIT ${scanSize+1}
 ), candidates AS MATERIALIZED (
  SELECT * FROM native_page UNION ALL SELECT * FROM imported_page ORDER BY source_class,id LIMIT ${scanSize+1}
 ), examined AS MATERIALIZED (SELECT * FROM candidates ORDER BY source_class,id LIMIT ${scanSize}),
 hits AS MATERIALIZED (SELECT * FROM examined ORDER BY source_class,id),
 meta AS (SELECT (SELECT count(*)>${scanSize} FROM candidates) AS scan_more,(SELECT source_class FROM examined ORDER BY source_class DESC,id DESC LIMIT 1) AS scanned_source,(SELECT id FROM examined ORDER BY source_class DESC,id DESC LIMIT 1) AS scanned_id)
 SELECT h.*,meta.* FROM meta LEFT JOIN hits h ON 1 ORDER BY h.source_class,h.id`
}

/** Keep large history views out of an outer join: SQLite otherwise rebuilds
 * all history for every cursor. Each UNION arm seeks only the bounded IDs. */
async function candidateMessages(c:Context,positions:any[]){
 if(!positions.length)return []
 const ids=JSON.stringify(positions.map(row=>row.id))
 const native=await c.rows(`SELECT 0 AS source_class,m.id,m.conversation,m.body AS native_body,m.parent AS native_parent,m.version AS native_version,m.retained_body AS native_retained,m.author AS native_author,m.created AS native_created,CASE WHEN m.retained_body=1 THEN 'Former member' ELSE person.name END AS native_name FROM nook_message_history m LEFT JOIN nook_actor_history person ON person.id=m.author WHERE m.id IN (SELECT value FROM json_each(?))`,[ids])
 const imported=await c.rows(`SELECT 1 AS source_class,r.id,r.conversation,r.body AS import_body,r.parent AS import_parent,r.retained_body AS import_retained,r.erased AS import_erased,r.source_actor,r.source_timestamp,r.key,r.job AS import_job,r.source_record AS message_source_record,actor.source_record AS actor_record,actor.association,j.namespace FROM nook_import_history r JOIN nook_imports j ON j.id=r.job LEFT JOIN nook_import_actors actor ON actor.job=r.job AND actor.source_id=r.source_actor WHERE r.id IN (SELECT value FROM json_each(?))`,[ids])
 const byId=new Map([...native,...imported].map(row=>[row.source_class+':'+row.id,row]))
 return positions.flatMap(position=>{const item=byId.get(position.source_class+':'+position.id);return item?[item]:[]})

}

async function hydrate(c:Context,row:any){
 if(row.source_class===0)return {id:row.id,conversation:row.conversation,body:row.native_body,parent:row.native_parent,author:row.native_retained?null:row.native_author,authorName:row.native_name,created:row.native_created,source:'native',...(row.native_retained?{immutable:true,retainedSource:'native'}:{})}
 if(row.import_retained)return {id:row.id,conversation:row.conversation,body:row.import_body,parent:row.import_parent,author:null,authorName:'Former member',created:sourceCreated(row.source_timestamp),source:'imported',immutable:true,retainedSource:'imported'}
 const record=JSON.parse(row.message_source_record),actor=JSON.parse(row.actor_record)
 const displayBody=await slackText(c,{...row,job:row.import_job,body:row.import_body},record)
 return {id:row.id,conversation:row.conversation,body:row.import_body,displayBody,parent:row.import_parent,author:row.association??null,authorName:messageAuthorLabel(actor,record)??row.source_actor,created:sourceCreated(row.source_timestamp),source:'imported',immutable:true,provenance:{namespace:row.namespace,key:row.key,actor:row.source_actor,label:messageAuthorLabel(actor,record)??row.source_actor,association:row.association,timestamp:row.source_timestamp}}
}

/** Imported presentation awaits further reads. Before returning any captured
 * body, repeat ACL and current-source checks; edits/deletion also invalidate it. */
async function currentKeys(c:Context,rows:any[]){
 const chunks=Array.from({length:Math.ceil(rows.length/20)},(_,index)=>rows.slice(index*20,index*20+20))
 const sets=await Promise.all(chunks.map(chunk=>c.rows(`WITH requested AS (SELECT json_extract(value,'$.source') AS source,json_extract(value,'$.id') AS id,json_extract(value,'$.body') AS body,json_extract(value,'$.version') AS version,json_extract(value,'$.retained') AS retained FROM json_each(?)),a AS (SELECT ? AS user)
 SELECT '0:'||m.id AS key FROM nook_message_history m CROSS JOIN a WHERE m.id IN (SELECT id FROM requested WHERE source=0) AND m.deleted=0 AND EXISTS(SELECT 1 FROM requested x WHERE x.source=0 AND x.id=m.id AND m.body=x.body AND m.version=x.version AND m.retained_body=x.retained) AND ${access('m.conversation')}
 UNION ALL SELECT '1:'||r.id FROM nook_import_history r JOIN nook_imports j ON j.id=r.job CROSS JOIN a WHERE r.id IN (SELECT id FROM requested WHERE source=1) AND EXISTS(SELECT 1 FROM requested x WHERE x.source=1 AND x.id=r.id AND r.body=x.body AND r.retained_body=x.retained) AND (r.erased=0 OR r.retained_body=1) AND j.state='complete' AND ${publishedImport} AND ${access('r.conversation')}`,[JSON.stringify(chunk.map(r=>({source:r.source_class,id:r.id,body:r.source_class===0?r.native_body:r.import_body,version:r.native_version,retained:r.source_class===0?r.native_retained:r.import_retained}))),c.uid])))
 return new Set(sets.flat().map(row=>row.key as string))
}

export async function searchMessages(c:Context,input:Record<string,unknown>,source?:SearchSource){
 if(source!==undefined&&source!=='native'&&source!=='imported')fail(400,'Invalid search source')
 const parsed=parseSearch(input),query=await resolveFilters(c,parsed),cursor=await searchCursor(c.env.SESSION_SECRET,c.uid,query,source),position=await cursor.read(input.after)
 // A positive expression of at least three characters narrows body candidates.
 // Attached files stay candidates because their contents live privately in R2.
 const seed=query.terms.find(t=>!t.exclude&&!t.prefix&&/^[\x20-\x7e]+$/.test(t.value)&&Array.from(t.value).length>=3)?.value??''
 const fts='(body_lower:'+quote(seed)+' OR (source:"imported" AND body_lower:'+quote(escaped(seed))+'))'
 const aliases:Record<string,string>={'+1':'👍',thumbsup:'👍',heart:'❤️',tada:'🎉',eyes:'👀',white_check_mark:'✅',raised_hands:'🙌'}
 const rows=await c.rows(pageSql(!!seed),[c.uid,query.text,escaped(query.text),position.source,position.id,query.conversation,query.person,query.afterAt,query.beforeAt,+query.hasFile,+query.saved,+query.pinned,source??null,fts,query.conversationType,query.participant,+query.directToMe,+query.thread,+query.hasLink,query.reaction?(aliases[query.reaction]??query.reaction):null,query.reaction])
 const candidates=await candidateMessages(c,rows.filter(row=>row.id!==null)),fileText=await searchFileText(c,candidates.map(row=>row.id)),matched=candidates.filter(row=>matchesSearch([row.source_class===0?row.native_body:row.import_body,...(fileText.get(row.id)??[]).flatMap(file=>[file.name,file.text])],query.terms)),returned=matched.slice(0,pageSize),meta=rows[0]
 const rendered=await Promise.all(returned.map(row=>hydrate(c,row))),current=await currentKeys(c,returned),liveFiles=await currentSearchFiles(c,[...fileText.keys()])
 const items=rendered.flatMap((item,index)=>{
  const row=returned[index];if(!current.has(row.source_class+':'+row.id))return []
  return [{...item,files:(fileText.get(row.id)??[]).filter(file=>liveFiles.has(file.attachment)).map(file=>({...file,text:undefined,excerpt:file.status==='indexed'?searchExcerpt(file.text,query.terms):'',matches:matchesSearch([file.name,file.text],query.terms)}))}]
 })
 const more=matched.length>pageSize||!!meta?.scan_more
 const next:SearchPosition=matched.length>pageSize?{source:returned.at(-1).source_class,id:returned.at(-1).id}:meta?.scanned_id?{source:meta.scanned_source,id:meta.scanned_id}:position
 // Unsupported files are named even when their filename did not match. Their
 // bytes were never represented as searched, and each page has current ACL.
 const unsearchedFiles=[...fileText.values()].flat().filter(file=>liveFiles.has(file.attachment)&&file.status!=='indexed').map(({attachment,name,status})=>({attachment,name,status}))
 return {items,unsearchedFiles,cursor:next.id?await cursor.write(next):'',hasMore:more,semantics:'All terms, exact phrases, Unicode token prefixes (*) and case-insensitive substrings; - excludes. Live membership and source checks on every page. Plain-text and text-bearing PDF contents; unsupported or unindexed files are named.',filters:query,hints:parsed.hints}
}
