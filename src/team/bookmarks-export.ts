// Compatible with exit/catalog's Dataset shape; its scope CTE is the export job's current conversation intersection.
// A link is exported as the stored text only; a file bookmark names its file by the ordinary file ID, whose bytes the files dataset carries.
export const bookmarkExportDatasets=[
 {name:'bookmarks',sql:`SELECT json_array(b.conversation,b.id) AS _key,b.conversation,b.id,b.kind,b.title,b.target,b.parent,b.position,b.author,a.name AS authorName,b.created FROM nook_bookmarks b LEFT JOIN nook_actor_history a ON a.id=b.author WHERE b.conversation IN (SELECT conversation FROM scope)`},
]
