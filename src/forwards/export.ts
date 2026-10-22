import {publishedImport} from '../imports/projection'
const readable=`COALESCE((SELECT m.body FROM nook_messages m WHERE m.id=chain.id AND m.deleted=0),(SELECT r.body FROM nook_import_records r JOIN nook_imports j ON j.id=r.job WHERE r.id=chain.id AND j.state='complete' AND ${publishedImport}))`
// Export the shown copy's current projection in the destination's own scope.
// The underlying original is never granted to a Link-only recipient.
export const forwardExport={name:'forwards',sql:`SELECT json_array(f.conversation,f.message) AS _key,f.conversation,f.message,f.source,f.mode,f.note,f.created,
 COALESCE((SELECT a.name FROM nook_messages m JOIN nook_actors a ON a.id=m.author WHERE m.id=f.source),(SELECT json_extract(a.source_record,'$.real_name') FROM nook_import_records r JOIN nook_import_actors a ON a.job=r.job AND a.source_id=r.source_actor WHERE r.id=f.source)) AS original_author,
 CASE WHEN f.mode='show' THEN (WITH RECURSIVE chain(id,depth) AS (SELECT f.source,0 UNION ALL SELECT p.source,chain.depth+1 FROM nook_forwards p JOIN chain ON p.message=chain.id WHERE p.mode='show') SELECT group_concat(body,char(10)||char(10)) FROM (SELECT ${readable} AS body FROM chain ORDER BY depth)) END AS shown_body
 FROM nook_forwards f WHERE f.conversation IN (SELECT conversation FROM scope)`}
