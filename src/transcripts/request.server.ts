import type {Context} from '../platform/storage/context'
import {fail,Fault} from '../family/team-chat/domain'
import {fullMember} from '../team/access'
import {canPost} from '../team/posting-policy'
import {validateCues} from '../clips/cues.mjs'
import {source,liveSource} from '../clips/source.server'
import {readClip} from '../clips/server'
import {configuration,today} from './settings.server'
import {unseal} from './secret'

export type Reason='cap-spent'|'provider-error'|'timeout'|'malformed'|'changed'|'unavailable'
const MAX_RESPONSE=262144
const failed=(reason:Reason)=>({state:'failed' as const,reason})
async function boundedJson(response:Response){const reader=response.body?.getReader();let bytes=0,body='';const decoder=new TextDecoder();if(reader)for(;;){const {value,done}=await reader.read();if(done)break;bytes+=value.length;if(bytes>MAX_RESPONSE){await reader.cancel();throw Error('oversize')}body+=decoder.decode(value,{stream:true})}return JSON.parse(body+decoder.decode())}
const ms=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?Math.round(value*1000)/1000:NaN
/** Provider segments become the clip's own cue format. Nothing else the provider returns is kept. */
export function providerCues(body:any){
 if(!body||typeof body!=='object'||!Array.isArray(body.segments))throw Error('malformed')
 const cues=body.segments.map((s:any)=>({start:ms(s?.start),end:ms(s?.end),text:typeof s?.text==='string'?s.text.trim():''})).filter((cue:any)=>cue.text)
 if(!cues.length)throw Error('malformed')
 return {cues:validateCues(cues),language:typeof body.language==='string'&&/^[a-z]{2,3}$/.test(body.language)?body.language:'en'}
}
/** POST /api/clips/:attachment/provider-transcript {disclosed:true}. The audio leaves Nook only here, after the explicit request,
 * to the one provider the owner configured, as data. A failure shows its class and creates no revision, no retry and no queued work. */
export async function providerTranscript(c:Context,attachment:string,input:Record<string,unknown>){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['disclosed','providerVersion'].includes(k))||input.disclosed!==true)fail(400,'Confirm the disclosure before the clip audio is sent')
 const file=await source(c,attachment)
 if(file.author!==c.uid&&!['owner','admin'].includes(c.session.operator.role))fail(403,'Only the clip’s author or an owner or admin can request a provider transcript')
 const posting=canPost('?','?','?'),postValues=[file.conversation,file.parent,c.uid]
 if(!await c.one(`SELECT 1 WHERE ${posting}`,postValues,file.conversation))fail(403,'Posting is restricted in this channel; ask a channel manager')
 const cfg=await configuration(c),credential=await c.one<{sealed:string}>('SELECT sealed FROM nook_transcript_secrets WHERE id=1')
 if(!cfg.enabled||!credential)fail(409,'Provider transcripts are off for this workspace')
 if(input.providerVersion!==cfg.version)fail(409,'The provider changed; reload the clip and review its disclosure before sending audio')
 const stored=await c.one<{object_key:string;name:string}>('SELECT object_key,name FROM nook_attachments WHERE id=?',[attachment],file.conversation),bytes=stored?.object_key?await c.env.FILES.get(stored.object_key):null
 if(!stored||!bytes)return failed('unavailable')
 const version=(await c.one<{version:number}>('SELECT COALESCE((SELECT version FROM nook_clips WHERE attachment=?),0) AS version',[attachment],file.conversation))!.version
 // Reserve the call atomically; a spent cap sends nothing. A failed provider attempt consumes its reservation.
 const day=today()
 try{await c.batch([c.sql('INSERT INTO nook_transcript_calls VALUES(?,1) ON CONFLICT(day) DO UPDATE SET calls=calls+1',day)],undefined,`${fullMember('?')} AND EXISTS(SELECT 1 FROM nook_transcript_settings WHERE id=1 AND enabled=1 AND version=?) AND COALESCE((SELECT calls FROM nook_transcript_calls WHERE day=?),0)<?`,[c.uid,cfg.version,day,cfg.daily_cap])}
 catch(error){if(error instanceof Fault&&[401,403,503].includes(error.status))throw error;return failed('cap-spent')}
 let parsed:{cues:any[];language:string}
 try{
  const form=new FormData();form.set('file',new File([await bytes.arrayBuffer()],stored.name,{type:file.mime}));form.set('model',cfg.model);form.set('response_format','verbose_json')
  const providerKey=await unseal(credential!.sealed,c.env.SESSION_SECRET)
  const authorized=await c.one(`SELECT 1 WHERE EXISTS(SELECT 1 FROM nook_transcript_settings WHERE id=1 AND enabled=1 AND version=?) AND ${liveSource} AND ${posting} AND EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND (id=? OR role IN ('owner','admin')))`,[cfg.version,attachment,file.message,file.conversation,file.mime,...postValues,c.uid,file.author],file.conversation)
  if(!authorized)fail(409,'Clip access or provider consent changed; no audio was sent')
  const response=await fetch(cfg.base_url+'/v1/audio/transcriptions',{method:'POST',redirect:'manual',signal:AbortSignal.timeout(60000),headers:{authorization:'Bearer '+providerKey},body:form})
  if(!response.ok)return failed('provider-error')
  try{parsed=providerCues(await boundedJson(response))}catch{return failed('malformed')}
 }catch(error){if(error instanceof Fault)throw error;return failed(error instanceof Error&&['TimeoutError','AbortError'].includes(error.name)?'timeout':'provider-error')}
 const now=new Date().toISOString(),current=`COALESCE((SELECT version FROM nook_clips WHERE attachment=?),0)=?`
 try{
  await c.writeBatch([
   c.sql('INSERT INTO nook_clips(attachment,message,conversation,version,created) VALUES(?,?,?,1,?) ON CONFLICT(attachment) DO UPDATE SET version=nook_clips.version+1',attachment,file.message,file.conversation,now),
   c.sql("INSERT INTO nook_clip_transcripts(attachment,message,conversation,version,actor,created,format,language,cues_json,source) VALUES(?,?,?,?,?,?,'typed',?,?,'provider')",attachment,file.message,file.conversation,version+1,c.uid,now,parsed.language,JSON.stringify(parsed.cues)),
   ...c.event(file.conversation,'clip',file.message),
   c.sql('INSERT INTO nook_audit VALUES(?,?,?,?,?,?,?,?,?,?)',crypto.randomUUID(),c.uid,'transcripts',Date.now(),'transcripts.provider',file.conversation,version+1,'Provider transcript added as a new revision','confirmed',1),
  ],file.conversation,`${posting} AND ${liveSource} AND ${current}`,[...postValues,attachment,file.message,file.conversation,file.mime,attachment,version])
 }catch(error){if(error instanceof Fault&&error.status===409)return failed('changed');throw error}
 await c.hint()
 return {state:'created' as const,transcript:await readClip(c,attachment)}
}
