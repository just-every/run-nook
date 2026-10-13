import type {Context} from '../../platform/storage/context'
import {fail} from '../../family/team-chat/domain'
import {manager} from './authorization'
/** Imported authors are source identities, never sign-in accounts. */
export async function importedAuthors(c:Context){
 await c.check()
 if(!await c.one(`SELECT 1 WHERE ${manager} AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner')`,[c.uid,c.uid,c.uid]))fail(403,'Only an owner can manage imported authors')
 return c.rows(`SELECT a.job||':'||a.source_id AS id,COALESCE(json_extract(a.source_record,'$.real_name'),json_extract(a.source_record,'$.name'),a.source_id) AS name FROM nook_import_actors a JOIN nook_imports j ON j.id=a.job WHERE NOT EXISTS(SELECT 1 FROM nook_import_records r WHERE r.job=a.job AND r.source_actor=a.source_id AND NOT EXISTS(SELECT 1 FROM nook_members m JOIN nook_conversations v ON v.id=m.conversation WHERE m.conversation=r.conversation AND m.user=? AND v.kind<>'dm')) ORDER BY a.job,a.source_id LIMIT 100`,[c.uid])
}
