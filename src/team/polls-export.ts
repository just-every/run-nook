// Compatible with exit/catalog's Dataset shape; its scope CTE is the export job's current conversation intersection.
// Counts are exported for every poll. Voters are exported only for a named poll, never for an anonymous one.
export const pollExportDatasets=[
 {name:'polls',sql:`SELECT json_array(p.conversation,p.message) AS _key,p.conversation,p.message,p.creator,p.multiple,p.anonymous,p.closes,p.closed_at,p.created,
  (SELECT json_group_array(json_object('position',o.position,'label',o.label,'count',(SELECT count(*) FROM nook_poll_votes v WHERE v.message=o.message AND v.position=o.position))) FROM (SELECT * FROM nook_poll_options WHERE message=p.message ORDER BY position) o) AS options
  FROM nook_polls p WHERE p.conversation IN (SELECT conversation FROM scope)`,project:(row:Record<string,any>)=>({...row,options:JSON.parse(row.options)})},
 {name:'poll_votes',sql:`SELECT json_array(v.conversation,v.message,v.voter,v.position) AS _key,v.conversation,v.message,v.voter,a.name AS voterName,v.position,v.created FROM nook_poll_votes v JOIN nook_polls p ON p.message=v.message AND p.anonymous=0 LEFT JOIN nook_actor_history a ON a.id=v.voter WHERE v.conversation IN (SELECT conversation FROM scope)`},
]
