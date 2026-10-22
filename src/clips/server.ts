import type {Context} from '../platform/storage/context'
import {message} from '../platform/storage/read'
import {fail,Fault} from '../family/team-chat/domain'
import {canPost} from '../team/posting-policy'
import {isClipMime} from './media'
import {parseWebVTT,validateCues} from './cues.mjs'
import type {ClipPolicy} from './types'

const policy:ClipPolicy={audience:'source-message',retention:'source-inherited',export:'source-inherited',erasure:'source-inherited',hold:'none'}
function exact(input:Record<string,unknown>,keys:string[]){if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!keys.includes(key)))fail(400,'Unexpected clip fields')}
function id(value:unknown):string{if(typeof value!=='string'||!value.length||value.length>128||value.trim()!==value||/[\u0000-\u001f\u007f]/.test(value))fail(400,'Invalid clip ID');return value as string}
function project(row:Record<string,any>){const {cues_json,...rest}=row;return {...rest,cues:JSON.parse(cues_json)}}
/** First identify the source through a no-scope query, then authorize with the
 * ordinary message door. Unrelated admins receive the same 404 as missing. */
async function source(c:Context,attachment:string){
 const file=await c.one("SELECT a.id,a.message,a.conversation,a.mime FROM nook_attachments a JOIN nook_messages m ON m.id=a.message AND m.conversation=a.conversation AND m.deleted=0 WHERE a.id=? AND a.state='attached' AND NOT EXISTS(SELECT 1 FROM nook_import_files f WHERE f.attachment=a.id)",[attachment])
 if(!file||!isClipMime(file.mime))fail(404,'Clip unavailable')
 const parent=await message(c,file.message).catch(error=>{if(error instanceof Fault&&[403,404].includes(error.status))fail(404,'Clip unavailable');throw error})
 if(parent.deleted||parent.immutable||parent.conversation!==file.conversation)fail(404,'Clip unavailable')
 return {...file,parent:parent.parent}
}
const liveSource=`EXISTS(SELECT 1 FROM nook_attachments a JOIN nook_messages m ON m.id=a.message AND m.conversation=a.conversation AND m.deleted=0 WHERE a.id=? AND a.message=? AND a.conversation=? AND a.state='attached' AND a.mime=? AND NOT EXISTS(SELECT 1 FROM nook_import_files f WHERE f.attachment=a.id))`
async function readClip(c:Context,attachment:string){
 const file=await source(c,attachment)
 const row=await c.one(`SELECT h.*,a.name AS actorName FROM nook_attachments source LEFT JOIN nook_clips clip ON clip.attachment=source.id LEFT JOIN nook_clip_transcripts h ON h.attachment=clip.attachment AND h.version=clip.version LEFT JOIN nook_actor_history a ON a.id=h.actor WHERE source.id=? AND ${liveSource}`,[attachment,attachment,file.message,file.conversation,file.mime],file.conversation)
 if(!row)fail(404,'Clip unavailable')
 return {...(row.version?project(row):{version:0,created:null,actor:null,actorName:null,format:'typed',language:'en',cues:[]}),attachment,message:file.message,conversation:file.conversation,mime:file.mime,policy}
}
async function history(c:Context,attachment:string,input:Record<string,unknown>){
 exact(input,['before']);const before=input.before===undefined?Number.MAX_SAFE_INTEGER:Number(input.before)
 if(!Number.isSafeInteger(before)||before<1)fail(400,'Invalid transcript history cursor')
 const file=await source(c,attachment)
 const rows=await c.rows(`SELECT h.*,a.name AS actorName FROM nook_clip_transcripts h LEFT JOIN nook_actor_history a ON a.id=h.actor WHERE h.attachment=? AND h.version<? AND ${liveSource} ORDER BY h.version DESC LIMIT 21`,[attachment,before,attachment,file.message,file.conversation,file.mime],file.conversation)
 return {items:rows.slice(0,20).map(project),cursor:rows.length>20?rows[19].version:null}
}
async function save(c:Context,attachment:string,input:Record<string,unknown>){
 exact(input,['version','cues','vtt','language'])
 if(!Number.isSafeInteger(input.version)||Number(input.version)<0||Number(input.version)>=Number.MAX_SAFE_INTEGER)fail(400,'Current transcript version required')
 if((input.cues===undefined)===(input.vtt===undefined))fail(400,'Provide typed cues or one WebVTT track')
 const language=input.language===undefined?'en':input.language
 if(typeof language!=='string'||!/^[a-zA-Z]{2,8}(?:-[a-zA-Z0-9]{1,8})*$/.test(language)||language.length>35)fail(400,'Invalid caption language tag')
 let cues;try{cues=input.vtt===undefined?validateCues(input.cues):parseWebVTT(input.vtt)}catch(error){fail(400,error instanceof Error?error.message:'Invalid transcript')}
 const file=await source(c,attachment),posting=canPost('?','?','?'),postValues=[file.conversation,file.parent,c.uid]
 if(!await c.one(`SELECT 1 WHERE ${posting}`,postValues,file.conversation))fail(403,'Posting is restricted in this channel; ask a channel manager')
 const expected=Number(input.version),now=new Date().toISOString()
 const current=`COALESCE((SELECT version FROM nook_clips WHERE attachment=?),0)=?`
 await c.writeBatch([
  c.sql('INSERT INTO nook_clips(attachment,message,conversation,version,created) VALUES(?,?,?,1,?) ON CONFLICT(attachment) DO UPDATE SET version=nook_clips.version+1',attachment,file.message,file.conversation,now),
  c.sql('INSERT INTO nook_clip_transcripts(attachment,message,conversation,version,actor,created,format,language,cues_json) VALUES(?,?,?,?,?,?,?,?,?)',attachment,file.message,file.conversation,expected+1,c.uid,now,input.vtt===undefined?'typed':'webvtt',language,JSON.stringify(cues!)),
  ...c.event(file.conversation,'clip',file.message),
 ],file.conversation,`${posting} AND ${liveSource} AND ${current}`,[...postValues,attachment,file.message,file.conversation,file.mime,attachment,expected])
 await c.hint();return readClip(c,attachment)
}
/** Paths: /api/clips/:nativeAttachment and /api/clips/:id/history.
 * For GET history, pass Object.fromEntries(url.searchParams) as input. */
export async function clipRoute(c:Context,method:string,p:string[],input:Record<string,unknown>){
 if(p[1]!=='clips')return null
 if(!p[2])fail(404,'Clip unavailable');const attachment=id(p[2])
 try{
  if(p.length===3&&method==='GET')return await readClip(c,attachment)
  if(p.length===3&&method==='PATCH')return await save(c,attachment,input)
  if(p.length===4&&p[3]==='history'&&method==='GET')return await history(c,attachment,input)
  fail(404,'Clip unavailable')
 }catch(error){if(error instanceof Fault&&error.status===403&&error.message==='Conversation access denied')fail(404,'Clip unavailable');throw error}
}
