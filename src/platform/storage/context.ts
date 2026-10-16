import {publishedImport} from '../../imports/projection'
import {productAccess,allowedGrant} from '../../team/access'
import {fail} from '../../family/team-chat/domain'
import {operatorAuth,authBindings,type Bindings as AuthBindings} from '../operator-auth.server'
import type {Session} from '../../base/modules/operator-auth/index.mjs'
export type StorageBindings=AuthBindings & {FILES:R2Bucket;CHAT_HUB:DurableObjectNamespace;ASSETS?:Fetcher;RER_DEPLOY_SOURCE?:string;RER_DEPLOY_FINGERPRINT?:string;RER_VERSION?:{id:string}}
export const authority=`(SELECT authority FROM nook_storage WHERE id=1)='normalized'`
export const authFence=`EXISTS(SELECT 1 FROM oa_sessions s JOIN oa_operators o ON o.id=s.operator_id WHERE s.id=? AND s.operator_id=? AND s.operator_version=? AND o.version=s.operator_version AND o.status='active' AND ${productAccess('o.id')} AND s.revoked_at IS NULL AND s.expires_at>CAST(unixepoch('subsec')*1000 AS INTEGER))`
// Unpublished imported history stays hidden, except a source import from the owner applying it.
export const memberFence=`EXISTS(SELECT 1 FROM nook_members mf WHERE mf.conversation=? AND mf.user=? AND ${allowedGrant('mf.user','mf.conversation')} AND NOT EXISTS(SELECT 1 FROM nook_import_channels ch JOIN nook_imports j ON j.id=ch.job WHERE ch.conversation=mf.conversation AND NOT (j.owner=mf.user AND substr(j.id,1,6)<>'slack-') AND (j.state<>'complete' OR NOT (${publishedImport}))))`
export class Context {
 constructor(readonly env:StorageBindings,readonly session:Session){}
 get db(){return this.env.DB}
 get uid(){return this.session.operatorId}
 get credentials(){return [this.session.id,this.uid,this.session.operator.version]}
 sql(sql:string,...values:any[]){return this.db.prepare(sql).bind(...values)}
 async check(conversation?:string){const row=await this.sql(`SELECT 1 AS ok WHERE ${authority} AND ${authFence}${conversation?' AND '+memberFence:''}`,...this.credentials,...(conversation?[conversation,this.uid]:[])).first();if(!row){const state=await this.db.prepare('SELECT authority FROM nook_storage WHERE id=1').first<{authority:string}>();if(state?.authority!=='normalized')fail(503,'Offline normalized storage conversion required');const active=await this.sql(`SELECT 1 WHERE ${authFence}`,...this.credentials).first();fail(active?403:401,active?'Conversation access denied':'Sign in required')}}
 async rows<T=any>(sql:string,values:any[]=[],conversation?:string):Promise<T[]>{
  // Authorization is in the same SQL snapshot as the data, including empty reads.
  const fence=`${authority} AND ${authFence}${conversation?' AND '+memberFence:''}`,credentials=[...this.credentials,...(conversation?[conversation,this.uid]:[])]
  const [result,guard]=await this.db.batch<T>([
   this.sql(`SELECT * FROM (${sql}) WHERE ${fence}`,...values,...credentials),
   this.sql(`SELECT 1 AS ok WHERE ${fence}`,...credentials),
  ])
  // D1 batches share a transaction, so empty reads and their authorization
  // check use the same snapshot without another database round trip.
  if(!guard.results.length)await this.check(conversation)
  return result.results
 }
 async one<T=any>(sql:string,values:any[]=[],conversation?:string):Promise<T|null>{return (await this.rows<T>(sql,values,conversation))[0]??null}
 async batch(statements:D1PreparedStatement[],conversation?:string,condition='1',values:any[]=[]){
  const key=crypto.randomUUID();
  try{await this.db.batch([this.sql(`INSERT INTO nook_guard VALUES(?,CASE WHEN ${authority} AND ${authFence}${conversation?' AND '+memberFence:''} AND (${condition}) THEN 1 ELSE 0 END)`,key,...this.credentials,...(conversation?[conversation,this.uid]:[]),...values),...statements,this.sql('DELETE FROM nook_guard WHERE id=?',key)])}catch(error){await this.check(conversation);if(String(error).includes('CHECK constraint')||String(error).includes('UNIQUE constraint'))fail(409,'Concurrent change or invalid command; reload and retry the same intent');throw error}
 }
 event(conversation:string,kind:string,object:string){return [this.sql('UPDATE nook_conversations SET seq=seq+1 WHERE id=?',conversation),this.sql('INSERT INTO nook_events SELECT id,seq,?,?,? FROM nook_conversations WHERE id=?',kind,object,this.uid,conversation)]}
 async hint(){await this.env.CHAT_HUB.get(this.env.CHAT_HUB.idFromName('workspace')).fetch('https://hub/hint',{method:'POST'}).catch(()=>undefined)}
}
export async function context(bindings:StorageBindings,headers:Headers){const env={...bindings,...authBindings(bindings)};const session=await operatorAuth(env).getSession(new Request(env.AUTH_ORIGIN+'/app',{headers}))??fail(401,'Sign in required');const c=new Context(env,session);await c.check();return c}
export function indexMessage(c:Context,id:string,conversation:string,body:string,source='native'){return c.sql('INSERT INTO nook_search(message,conversation,source,scope,body_lower) VALUES(?,?,?,?,?)',id,conversation,source,'|'+conversation+'|',body.toLowerCase())}
