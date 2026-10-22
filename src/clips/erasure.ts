import type {Context} from '../platform/storage/context'
/** Collect before native file deletion. Parent passes keys to f.row(), places
 * before ahead of EVERY clip/history/native DELETE, and after last in that batch.
 * The guard refuses a correction racing key collection, including a lazily
 * created first transcript. No R2 copy or retention authority belongs here. */
export async function clipErasurePlan(c:Context,attachments:string[]){
 const ids=JSON.stringify(attachments)
 const rows=await c.rows<{kind:'clip'|'history';attachment:string;version:number}>(`SELECT 'clip' AS kind,attachment,version FROM nook_clips WHERE attachment IN (SELECT value FROM json_each(?)) UNION ALL SELECT 'history' AS kind,attachment,version FROM nook_clip_transcripts WHERE attachment IN (SELECT value FROM json_each(?))`,[ids,ids])
 const snapshots=JSON.stringify(rows.filter(row=>row.kind==='clip').map(({attachment,version})=>({attachment,version}))),guard=crypto.randomUUID()
 const keys=rows.map<{table:'nook_clip_transcripts'|'nook_clips';key:Record<string,string|number>}>(row=>row.kind==='history'?{table:'nook_clip_transcripts',key:{attachment:row.attachment,version:row.version}}:{table:'nook_clips',key:{attachment:row.attachment} as Record<string,string|number>})
 return {keys,before:{sql:`INSERT INTO nook_guard VALUES(?,CASE WHEN NOT EXISTS(SELECT 1 FROM nook_clips clip WHERE clip.attachment IN (SELECT value FROM json_each(?)) AND NOT EXISTS(SELECT 1 FROM json_each(?) picked WHERE json_extract(picked.value,'$.attachment')=clip.attachment AND json_extract(picked.value,'$.version')=clip.version)) AND NOT EXISTS(SELECT 1 FROM json_each(?) picked WHERE NOT EXISTS(SELECT 1 FROM nook_clips clip WHERE clip.attachment=json_extract(picked.value,'$.attachment') AND clip.version=json_extract(picked.value,'$.version'))) THEN 1 ELSE 0 END)`,params:[guard,ids,snapshots,snapshots]},after:{sql:'DELETE FROM nook_guard WHERE id=?',params:[guard]}}
}
/** Parent identity erasure must prepend f.checkpoint() when this is true, then
 * UPDATE nook_clip_transcripts SET actor=NULL WHERE actor=? in that batch.
 * The deletion trigger is only a final integrity guard for native actor removal. */
export async function hasClipAttribution(c:Context,actor:string){return !!await c.one('SELECT 1 FROM nook_clip_transcripts WHERE actor=? LIMIT 1',[actor])}
