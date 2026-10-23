import type {Context} from '../platform/storage/context'
import {fail,text} from '../family/team-chat/domain'
import {owner} from '../ai-search/settings'
import {seal} from './secret'
export const defaults={enabled:0,base_url:'https://api.openai.com',model:'gpt-4o-mini-transcribe',daily_cap:20,version:0}
export async function configuration(c:Context){return await c.one<typeof defaults>('SELECT enabled,base_url,model,daily_cap,version FROM nook_transcript_settings WHERE id=1')??defaults}
export const today=()=>new Date().toISOString().slice(0,10)
/** What the owner sees: whether a key is held (never the key), the provider named as the subprocessor, and today's call count against the cap. */
export async function state(c:Context){
 const cfg=await configuration(c),key=!!await c.one('SELECT 1 FROM nook_transcript_secrets WHERE id=1'),calls=(await c.one<{calls:number}>('SELECT calls FROM nook_transcript_calls WHERE day=?',[today()]))?.calls??0
 return {...cfg,hasKey:key,calls,state:!cfg.enabled||!key?'off':calls>=cfg.daily_cap?'capped':'ready',provider:new URL(cfg.base_url).hostname}
}
/** Owner only. POST {enabled,baseUrl,model,dailyCap,version,key?}: `key` absent keeps the sealed key, a string replaces it, null removes it. */
export async function settings(c:Context,method:string,input:Record<string,unknown>){
 if(!await c.one(`SELECT 1 WHERE ${owner}`,[c.uid]))fail(403,'Only owners manage provider transcripts')
 if(method==='GET')return state(c)
 if(method!=='POST')fail(404,'Not found')
 if(Object.keys(input).some(k=>!['enabled','model','baseUrl','dailyCap','key','version'].includes(k))||typeof input.enabled!=='boolean'||!Number.isSafeInteger(input.dailyCap)||Number(input.dailyCap)<1||Number(input.dailyCap)>1000)fail(400,'Invalid provider transcript settings')
 const cfg=await configuration(c);if(input.version!==cfg.version)fail(409,'Settings changed; reload')
 const model=text(input.model,120).trim(),base=text(input.baseUrl,2048).trim();let url!:URL;try{url=new URL(base)}catch{fail(400,'Invalid provider URL')}
 const local=(c.env as any).AUTH_LOCAL==='true'&&url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)
 if(!model||url.username||url.password||url.search||url.hash||!['','/'].includes(url.pathname)||url.protocol!=='https:'&&!local)fail(400,'Use an HTTPS provider origin')
 if(input.key!==undefined&&input.key!==null&&typeof input.key!=='string')fail(400,'Invalid provider key')
 const key=typeof input.key==='string'?input.key.trim():'';if(key&&(/[\r\n]/.test(key)||key.length>4096))fail(400,'Invalid provider key')
 const removing=input.key===null,held=!!await c.one('SELECT 1 FROM nook_transcript_secrets WHERE id=1')
 if(input.enabled&&(removing||!key&&!held))fail(400,'Supply a provider key before enabling')
 const statements=[c.sql('INSERT INTO nook_transcript_settings VALUES(1,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET enabled=excluded.enabled,base_url=excluded.base_url,model=excluded.model,daily_cap=excluded.daily_cap,version=excluded.version',Number(input.enabled),url.origin,model,Number(input.dailyCap),cfg.version+1)]
 if(key)statements.push(c.sql('INSERT OR REPLACE INTO nook_transcript_secrets VALUES(1,?)',await seal(key,c.env.SESSION_SECRET)))
 if(removing)statements.push(c.sql('DELETE FROM nook_transcript_secrets WHERE id=1'))
 statements.push(c.sql('INSERT INTO nook_audit VALUES(?,?,?,?,?,?,?,?,?,?)',crypto.randomUUID(),c.uid,'transcripts',Date.now(),'transcripts.settings','workspace',cfg.version+1,removing?'Provider key removed':key?'Provider key supplied or rotated':input.enabled?'Provider transcripts enabled':'Provider transcripts disabled','confirmed',1))
 await c.batch(statements,undefined,`${owner} AND COALESCE((SELECT version FROM nook_transcript_settings WHERE id=1),0)=?`,[c.uid,cfg.version])
 return state(c)
}
