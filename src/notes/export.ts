// Compatible with exit/catalog's Dataset shape. Its scope CTE is already the
// export job's currently authorized conversation intersection.
export const noteExportDatasets=[
 {name:'notes',sql:`SELECT json_array(n.conversation,n.id) AS _key,n.*,a.name AS authorName FROM nook_notes n LEFT JOIN nook_actor_history a ON a.id=n.author WHERE n.conversation IN (SELECT conversation FROM scope)`},
 {name:'note_versions',sql:`SELECT json_array(n.conversation,v.note,v.version) AS _key,n.conversation,v.*,a.name AS actorName FROM nook_note_versions v JOIN nook_notes n ON n.id=v.note LEFT JOIN nook_actor_history a ON a.id=v.actor WHERE n.conversation IN (SELECT conversation FROM scope)`},
 {name:'note_proposals',sql:`SELECT json_array(n.conversation,p.outcome) AS _key,n.conversation,p.* FROM nook_note_proposals p JOIN nook_notes n ON n.id=p.note WHERE n.conversation IN (SELECT conversation FROM scope)`},
]
