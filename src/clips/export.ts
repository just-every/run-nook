// The readable-export scope CTE already intersects the export owner's current
// membership. Native files carry the bytes once, under their ordinary file ID.
export const clipExportDatasets=[
 {name:'clips',sql:`SELECT json_array(clip.conversation,clip.attachment) AS _key,clip.* FROM nook_clips clip WHERE clip.conversation IN (SELECT conversation FROM scope)`,project:(row:Record<string,any>)=>({...row,policy:{audience:'source-message',retention:'source-inherited',export:'source-inherited',erasure:'source-inherited',hold:'none'}})},
 {name:'clip_transcripts',sql:`SELECT json_array(h.conversation,h.attachment,h.version) AS _key,h.*,a.name AS actorName FROM nook_clip_transcripts h LEFT JOIN nook_actor_history a ON a.id=h.actor WHERE h.conversation IN (SELECT conversation FROM scope)`,project:(row:Record<string,any>)=>{const {cues_json,...rest}=row;return {...rest,cues:JSON.parse(cues_json)}}},
]
