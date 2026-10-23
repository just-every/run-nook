// Only aggregate counts leave the installation, in readable exports and archives.
export const pollExportDatasets=[
 {name:'polls',sql:`SELECT json_array(p.conversation,p.message) AS _key,p.conversation,p.message,p.creator,p.multiple,p.anonymous,p.closes,p.closed_at,p.created,p.voters,
 (SELECT json_group_array(json_object('position',o.position,'label',o.label,'count',o.count)) FROM (SELECT * FROM nook_poll_options WHERE message=p.message ORDER BY position) o) AS options
 FROM nook_polls p WHERE p.conversation IN (SELECT conversation FROM scope)`,project:(row:Record<string,any>)=>({...row,options:JSON.parse(row.options)})},
]
