import {fail} from '../family/team-chat/domain'
import {publishedImport,sourceCreated} from '../imports/projection'
import {allowedGrant} from './access'

export type SavedKind='message'|'attachment'|'link'
export type SavedTarget={conversation:string;kind:SavedKind;target:string}
export const savedPageSize=50

function object(value:unknown):Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value))fail(400,'Expected a JSON object')
 return value as Record<string,unknown>
}
export function exact(value:unknown,keys:string[]){
 const input=object(value)
 if(Object.keys(input).length!==keys.length||keys.some(key=>!Object.hasOwn(input,key)))fail(400,'Unexpected or missing fields')
 return input
}
export function savedId(value:unknown){
 if(typeof value!=='string'||!value.length||value.length>128||value.trim()!==value||/[\u0000-\u001f\u007f]/.test(value))fail(400,'Invalid source ID')
 return value as string
}
export function savedUrl(value:unknown){
 if(typeof value!=='string'||!value.length||value.length>2048||value.trim()!==value||/[\u0000-\u0020\u007f]/.test(value))fail(400,'Invalid saved URL')
 let url:URL
 try{url=new URL(value as string)}catch{fail(400,'Invalid saved URL')}
 if(!['http:','https:'].includes(url!.protocol)||url!.username||url!.password||!url!.hostname||url!.href.length>2048)fail(400,'Use an HTTP or HTTPS URL without credentials')
 return url!.href
}
export function savedInput(value:unknown):SavedTarget{
 const input=object(value),sources=['message','attachment','url'].filter(key=>Object.hasOwn(input,key))
 if(sources.length!==1)fail(400,'Choose exactly one message, attachment or URL')
 const field=sources[0];exact(input,['conversation',field])
 return {conversation:savedId(input.conversation),kind:field==='url'?'link':field as SavedKind,target:field==='url'?savedUrl(input.url):savedId(input[field])}
}
export function savedAfter(value:unknown){
 const input=object(value)
 if(Object.keys(input).some(key=>key!=='after'))fail(400,'Unexpected page field')
 if(input.after===undefined||input.after==='')return Number.MAX_SAFE_INTEGER
 if(typeof input.after!=='string'||!/^\d{1,16}$/.test(input.after))fail(400,'Invalid saved cursor')
 const seq=Number(input.after)
 if(!Number.isSafeInteger(seq)||seq<1)fail(400,'Invalid saved cursor')
 return seq
}
// Correlated current membership matches Context.memberFence, including guest
// grants and unpublished imports. A role never opens a saved source.
export const savedAccess=(conversation:string,user:string)=>`EXISTS(SELECT 1 FROM nook_members mf WHERE mf.conversation=${conversation} AND mf.user=${user} AND ${allowedGrant('mf.user','mf.conversation')} AND NOT EXISTS(SELECT 1 FROM nook_import_channels ch JOIN nook_imports j ON j.id=ch.job WHERE ch.conversation=mf.conversation AND NOT (j.owner=mf.user AND substr(j.id,1,6)<>'slack-') AND (j.state<>'complete' OR NOT (${publishedImport}))))`
export const savedCollectionsSql=`WITH source AS (
 SELECT id,conversation FROM nook_messages WHERE id=? AND deleted=0
 UNION ALL SELECT r.id,r.conversation FROM nook_import_records r JOIN nook_imports j ON j.id=r.job WHERE r.id=? AND j.state='complete' AND ${publishedImport}
 ) SELECT (SELECT s.id FROM nook_saved_items s WHERE s.user=? AND s.conversation=m.conversation AND s.kind='message' AND s.target=m.id) AS savedId,
 EXISTS(SELECT 1 FROM nook_channel_pins p WHERE p.conversation=m.conversation AND p.message=m.id AND cv.kind IN ('channel','private')) AS pinned,
 (cv.kind IN ('channel','private') AND NOT EXISTS(SELECT 1 FROM nook_channel_settings settings WHERE settings.conversation=cv.id AND settings.archived=1)) AS canPin
 FROM source m JOIN nook_conversations cv ON cv.id=m.conversation WHERE ${savedAccess('m.conversation','?')}`
// Live tables intentionally exclude erasure's optional retained-body views.
export const savedLiveMessage=(id:string,conversation:string)=>`(EXISTS(SELECT 1 FROM nook_messages sm WHERE sm.id=${id} AND sm.conversation=${conversation} AND sm.deleted=0) OR EXISTS(SELECT 1 FROM nook_import_records sr JOIN nook_imports j ON j.id=sr.job WHERE sr.id=${id} AND sr.conversation=${conversation} AND j.state='complete' AND ${publishedImport}))`
export function savedTargetFence(kind:SavedKind){
 if(kind==='link')return 'EXISTS(SELECT 1 FROM nook_conversations WHERE id=?)'
 if(kind==='message')return savedLiveMessage('?','?')
 return `EXISTS(SELECT 1 FROM nook_attachments sa WHERE sa.id=? AND sa.conversation=? AND sa.state='attached' AND sa.object_key IS NOT NULL AND ${savedLiveMessage('sa.message','sa.conversation')})`
}
export function savedTargetValues(item:SavedTarget){return item.kind==='link'?[item.conversation]:item.kind==='message'?[item.target,item.conversation,item.target,item.conversation]:[item.target,item.conversation]}

/** One snapshot projects a bounded page and its authorized current sources.
 * No target, source scope, filename, URL or excerpt is returned for tombstones. */
export function savedProjection(pageSql:string){return `WITH page AS MATERIALIZED (${pageSql}),
 visible AS MATERIALIZED (SELECT p.*,cv.name AS conversation_name,cv.kind AS conversation_kind FROM page p JOIN nook_conversations cv ON cv.id=p.conversation WHERE ${savedAccess('p.conversation','?')}),
 live AS (
 SELECT w.id AS item_id,m.id,m.body,m.parent,m.created,m.author,a.name AS author_name,'native' AS source
 FROM visible w JOIN nook_messages m ON m.id=w.target AND m.conversation=w.conversation LEFT JOIN nook_actors a ON a.id=m.author WHERE w.kind='message' AND m.deleted=0
 UNION ALL
 SELECT w.id,r.id,r.body,r.parent,r.source_timestamp,NULL,COALESCE(json_extract(a.source_record,'$.real_name'),json_extract(a.source_record,'$.name'),r.source_actor),'imported'
 FROM visible w JOIN nook_import_records r ON r.id=w.target AND r.conversation=w.conversation JOIN nook_imports j ON j.id=r.job LEFT JOIN nook_import_actors a ON a.job=r.job AND a.source_id=r.source_actor WHERE w.kind='message' AND j.state='complete' AND ${publishedImport}
 )
 SELECT p.id,p.seq,p.created,p.kind,v.conversation,v.conversation_name,v.conversation_kind,
 CASE WHEN v.kind='link' THEN v.target END AS url,
 lm.id AS message,lm.body,lm.parent,lm.created AS message_created,lm.author,lm.author_name,lm.source,
 af.id AS attachment,af.name,af.mime,af.size,af.message AS attachment_message,af.created AS attachment_created,
 v.actor,pinner.display_name AS actor_name
 FROM page p LEFT JOIN visible v ON v.id=p.id LEFT JOIN live lm ON lm.item_id=v.id
 LEFT JOIN nook_attachments af ON v.kind='attachment' AND af.id=v.target AND af.conversation=v.conversation AND af.state='attached' AND af.object_key IS NOT NULL AND ${savedLiveMessage('af.message','af.conversation')}
 LEFT JOIN oa_operators pinner ON pinner.id=v.actor
 ORDER BY p.seq DESC`}
export function savedItem(row:any,shared=false){
 const base={id:row.id,kind:row.kind,created:row.created,...(shared?{pinnedBy:row.actor_name?{id:row.actor,name:row.actor_name}:null}: {})}
 if(!row.conversation||!(row.message||row.attachment||row.url))return {...base,unavailable:true}
 const context={conversation:row.conversation,conversationName:row.conversation_name,conversationKind:row.conversation_kind}
 return {...base,unavailable:false,...context,...(row.message?{message:{id:row.message,body:row.body,parent:row.parent,created:row.source==='imported'?sourceCreated(row.message_created):row.message_created,author:row.author,authorName:row.author_name,source:row.source}}:row.attachment?{attachment:{id:row.attachment,name:row.name,mime:row.mime,size:row.size,message:row.attachment_message,created:row.attachment_created}}:{url:row.url})}
}
