import type {Context} from '../platform/storage/context'
import {fail,text} from '../family/team-chat/domain'
import {fullMember} from '../team/access'
import {seal} from './secret'
export const owner=`EXISTS(SELECT 1 FROM oa_operators o WHERE o.id=? AND o.role='owner' AND o.status='active' AND ${fullMember('o.id')})`
export const defaults={enabled:0,model:'claude-haiku-4-5',base_url:'https://api.anthropic.com',daily_cap:20,version:0}
export async function configuration(c:Context){return await c.one<typeof defaults>('SELECT enabled,model,base_url,daily_cap,version FROM nook_ai_settings WHERE id=1')??defaults}
export async function state(c:Context){const cfg=await configuration(c),key=!!await c.one('SELECT 1 FROM nook_ai_secrets WHERE id=1'),calls=(await c.one<{calls:number}>('SELECT calls FROM nook_ai_calls WHERE day=?',[new Date().toISOString().slice(0,10)]))?.calls??0;return {...cfg,hasKey:key,calls,state:!cfg.enabled||!key?'off':calls>=cfg.daily_cap?'capped':'ready',provider:new URL(cfg.base_url).hostname}}
export async function settings(c:Context,method:string,input:Record<string,unknown>){
 if(!await c.one(`SELECT 1 WHERE ${owner}`,[c.uid]))fail(403,'Only owners manage AI search')
 if(method==='GET')return state(c)
 if(method!=='POST')fail(404,'Not found')
 if(Object.keys(input).some(k=>!['enabled','model','baseUrl','dailyCap','key','version'].includes(k))||typeof input.enabled!=='boolean'||!Number.isSafeInteger(input.dailyCap)||Number(input.dailyCap)<1||Number(input.dailyCap)>1000)fail(400,'Invalid AI search settings')
 const cfg=await configuration(c);if(input.version!==cfg.version)fail(409,'Settings changed; reload')
 const model=text(input.model,120).trim(),base=text(input.baseUrl,2048).trim();let url!:URL;try{url=new URL(base)}catch{fail(400,'Invalid provider URL')}
 const local=(c.env as any).AUTH_LOCAL==='true'&&url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)
 if(!model||url.username||url.password||url.search||url.hash||!['','/'].includes(url.pathname)||url.protocol!=='https:'&&!local)fail(400,'Use an HTTPS provider origin')
 const key=input.key===undefined?'':text(input.key,4096).trim();if(key&&/[\r\n]/.test(key))fail(400,'Invalid provider key')
 if(input.enabled&&!key&&!await c.one('SELECT 1 FROM nook_ai_secrets WHERE id=1'))fail(400,'Supply a provider key before enabling')
 const statements=[c.sql('INSERT INTO nook_ai_settings VALUES(1,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET enabled=excluded.enabled,model=excluded.model,base_url=excluded.base_url,daily_cap=excluded.daily_cap,version=excluded.version',Number(input.enabled),model,url.origin,Number(input.dailyCap),cfg.version+1)]
 if(key)statements.push(c.sql('INSERT OR REPLACE INTO nook_ai_secrets VALUES(1,?)',await seal(key,c.env.SESSION_SECRET)))
 statements.push(c.sql('INSERT INTO nook_audit VALUES(?,?,?,?,?,?,?,?,?,?)',crypto.randomUUID(),c.uid,'ai-search',Date.now(),'ai-search.settings','workspace',cfg.version+1,key?'Provider key supplied or rotated':input.enabled?'AI search enabled':'AI search disabled','confirmed',1))
 await c.batch(statements,undefined,`${owner} AND COALESCE((SELECT version FROM nook_ai_settings WHERE id=1),0)=?`,[c.uid,cfg.version]);return state(c)
}
