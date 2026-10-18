import {detachAssignee} from './audit'
import {authIdentity} from './auth-identity'
import {graph} from './graph'
import type {Context} from '../../platform/storage/context'
import {fenceService,type Sql} from './portability'
import {sql,fencedRows,audit} from './statements'
export async function identity(c:Context,f:Awaited<ReturnType<typeof fenceService>>,target:string){
 const affected=await c.rows('SELECT id AS conversation FROM nook_conversations c WHERE EXISTS(SELECT 1 FROM nook_members WHERE conversation=c.id AND user=?) OR EXISTS(SELECT 1 FROM nook_dm_roster WHERE conversation=c.id AND user=?) OR owner=? OR EXISTS(SELECT 1 FROM nook_channel_settings WHERE conversation=c.id AND manager=?) OR EXISTS(SELECT 1 FROM nook_erased_messages WHERE conversation=c.id AND author=?) OR EXISTS(SELECT 1 FROM nook_erased_attachments WHERE conversation=c.id AND author=?) OR EXISTS(SELECT 1 FROM nook_outcomes WHERE conversation=c.id AND assignee=?)',[target,target,target,target,target,target,target])
 const historical=affected.length>0||!!await c.one("SELECT 1 FROM nook_imports WHERE owner=? UNION ALL SELECT 1 FROM nook_import_uploads WHERE owner=? UNION ALL SELECT 1 FROM nook_import_reviews WHERE EXISTS(SELECT 1 FROM json_each(nook_import_reviews.summary_json,'$.actors') a WHERE json_extract(a.value,'$.association')=?) UNION ALL SELECT 1 FROM nook_messages WHERE deleted=0 AND EXISTS(SELECT 1 FROM json_each(nook_messages.payload,'$.mentions') WHERE value=?) LIMIT 1",[target,target,target,target])
 const person=await c.one('SELECT email,display_name FROM oa_operators WHERE id=?',[target]),result:Sql[]=[...audit('SELECT value FROM json_each(?)',[JSON.stringify(affected.map(r=>r.conversation))]),...await detachAssignee(c,f,target),...await fencedRows(c,f,'nook_attention',['id'],'EXISTS(SELECT 1 FROM nook_events e WHERE e.conversation=nook_attention.conversation AND e.seq=nook_attention.event_seq AND e.actor=?)',[target])]
 result.push(...await authIdentity(c,f,target),sql("DELETE FROM oa_dev_credentials WHERE (credential='oa_sessions' AND id IN (SELECT id FROM oa_sessions WHERE operator_id=?)) OR (credential='oa_tokens' AND id IN (SELECT id FROM oa_tokens WHERE operator_id=? OR issuer_id=?))",target,target,target),sql('UPDATE oa_sessions SET source_token_id=NULL WHERE operator_id<>? AND source_token_id IN (SELECT id FROM oa_tokens WHERE issuer_id=?)',target,target))
 const edges:[string,string[],string,any[]][]=graph.member.edges.filter(edge=>'phase' in edge&&edge.phase==='identity').map(edge=>{
 const e=edge as any;return [e.table,[...e.key],e.where??Object.keys(e.on).map(key=>key+'=?').join(' AND '),(e.params??Object.keys(e.on)).map(()=>target)]
 })
 result.push(sql("UPDATE nook_schedules SET state='failed',version=version+1,reason='A mentioned person was erased; review recipients before rescheduling',payload=json_set(payload,'$.mentions',json((SELECT json_group_array(value) FROM json_each(payload,'$.mentions') WHERE value<>?)),'$.urgent',json('false'),'$.urgentReason',NULL),definition=json_set(definition,'$.payload.mentions',json((SELECT json_group_array(value) FROM json_each(definition,'$.payload.mentions') WHERE value<>?)),'$.payload.urgent',json('false'),'$.payload.urgentReason',NULL) WHERE EXISTS(SELECT 1 FROM json_each(payload,'$.mentions') WHERE value=?)",target,target,target))
 result.push(...await fencedRows(c,f,'nook_reminder_occurrences',['reminder','due'],'reminder IN (SELECT id FROM nook_reminders WHERE user=? OR recipient=?)',[target,target]),sql('DELETE FROM nook_reminder_occurrences WHERE reminder IN (SELECT id FROM nook_reminders WHERE user=? OR recipient=?)',target,target))
 result.push(sql('DELETE FROM nook_schedule_occurrences WHERE schedule IN (SELECT id FROM nook_schedules WHERE user=?)',target))
 for(const [table,keys,where,params] of edges)result.push(...await fencedRows(c,f,table,keys,where,params),sql(`DELETE FROM ${table} WHERE ${where}`,...params))
 // A redacted pin remains portable under its real primary key. Fence the old
 // checkpoint, rather than banning the anonymous row from future archives.
 if(await c.one('SELECT 1 FROM nook_profile_field_actions WHERE actor=? LIMIT 1',[target]))result.push(...await f.checkpoint(),sql('UPDATE nook_profile_field_actions SET actor=NULL WHERE actor=?',target))
 if(await c.one('SELECT 1 FROM nook_channel_pins WHERE actor=? LIMIT 1',[target]))result.push(...await f.checkpoint(),sql('UPDATE nook_channel_pins SET actor=NULL WHERE actor=?',target))
 if(await c.one('SELECT 1 FROM nook_broadcast_actions WHERE actor=? LIMIT 1',[target]))result.push(...await f.checkpoint(),sql('UPDATE nook_broadcast_actions SET actor=NULL WHERE actor=?',target))
 if(await c.one('SELECT 1 FROM nook_default_actions WHERE actor=? LIMIT 1',[target]))result.push(...await f.checkpoint(),sql('UPDATE nook_default_actions SET actor=NULL WHERE actor=?',target))
 result.push(sql("UPDATE nook_invite_plans SET state='cancelled' WHERE email=? OR issuer=?",person.email,target),sql('DELETE FROM nook_invite_plans WHERE email=? OR issuer=?',person.email,target),
  sql("INSERT INTO nook_channel_settings(conversation,manager) SELECT c.id,NULL FROM nook_conversations c LEFT JOIN nook_channel_settings s ON s.conversation=c.id WHERE c.kind<>'dm' AND CASE WHEN s.conversation IS NULL THEN c.owner ELSE s.manager END=? ON CONFLICT(conversation) DO UPDATE SET manager=NULL",target),
  sql('UPDATE nook_group_conversions SET actor=NULL WHERE actor=?',target),sql('UPDATE nook_channel_actions SET actor=NULL WHERE actor=?',target),sql('UPDATE nook_channel_actions SET subject=NULL WHERE subject=?',target),
  sql('DELETE FROM nook_members WHERE user=?',target),sql('DELETE FROM nook_guest_grants WHERE user=?',target),sql('DELETE FROM nook_creator_revocations WHERE user=?',target),sql('DELETE FROM nook_access WHERE user=?',target),
  sql('DELETE FROM nook_attention WHERE EXISTS(SELECT 1 FROM nook_events e WHERE e.conversation=nook_attention.conversation AND e.seq=nook_attention.event_seq AND e.actor=?)',target),
  sql("UPDATE nook_conversations SET name='Direct conversation' WHERE kind='dm' AND (owner=? OR id IN (SELECT conversation FROM nook_dm_roster WHERE user=?))",target,target),
  sql("UPDATE nook_events SET kind='erasure',actor=NULL,object=lower(hex(randomblob(16))) WHERE actor=? OR object=?",target,target),
  sql('UPDATE oa_domain_rules SET created_by=NULL WHERE created_by=?',target),sql('UPDATE oa_first_run SET completed_by=NULL WHERE completed_by=?',target),
  ...(historical?[sql('INSERT INTO nook_erased_actors VALUES(?)',target)]:[]),...await f.row('nook_actors',{id:target}),...await f.row('oa_operators',{id:target}),
  sql('UPDATE oa_bootstrap SET claim_id=lower(hex(randomblob(16))) WHERE claim_id=?',target),sql('DELETE FROM nook_actors WHERE id=?',target),sql('DELETE FROM oa_operators WHERE id=?',target))
 // Owner claim proof keeps its authority nonce, never the erased person's values.
 const tables=await c.rows("SELECT name FROM sqlite_master WHERE type='table'")
 if(tables.some(t=>t.name==='oc_owner_claims'))result.unshift(sql("UPDATE oc_owner_claims SET email='',operator_id=lower(hex(randomblob(16))),session_id='' WHERE operator_id=?",target))
 return result
}
