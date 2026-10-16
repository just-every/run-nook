import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {createMailSender} from '../src/base/modules/mail/index.mjs';
import {mailEdge,mailBindings} from './mail-edge.mjs';
import {createOperatorAuth,createAuthHandler} from '../src/base/modules/operator-auth/index.mjs';
export async function teamFixture({bootstrap=true,database=':memory:'}={}){
 const db=new DatabaseSync(database);
 const migrationDir=new URL('../migrations/',import.meta.url);
 const files=readdirSync(migrationDir).filter(x=>x.endsWith('.sql')).sort();
 if(database===':memory:')for(const file of files)db.exec(readFileSync(new URL(file,migrationDir),'utf8'))
 class Statement{
  constructor(sql,args=[]){this.sql=sql;this.args=args}bind(...args){return new Statement(this.sql,args)}
  execute(){const before=db.prepare('SELECT total_changes() AS n').get().n;const s=db.prepare(this.sql);const results=s.columns().length?s.all(...this.args):[];if(!s.columns().length)s.run(...this.args);return {results,success:true,meta:{changes:db.prepare('SELECT total_changes() AS n').get().n-before}}}
  async all(){return this.execute()}async run(){return this.execute()}async first(){return this.execute().results[0]??null}
 }
 const adapter={prepare:sql=>new Statement(sql),async batch(statements){db.exec('BEGIN IMMEDIATE');try{const values=statements.map(s=>s.execute());db.exec('COMMIT');return values}catch(e){db.exec('ROLLBACK');throw e}}};
 const edge=mailEdge(),mail=edge.messages;const sender=createMailSender({provider:'rer',mode:'production',apiKey:mailBindings.MAIL_API_KEY,relayUrl:mailBindings.MAIL_RELAY_URL},{fetch:(url,init)=>edge.fetch(new Request(url,init))});const origin='http://127.0.0.1:15820';
 const auth=createOperatorAuth({db:adapter,config:{origin,local:true,OWNER_EMAIL:'owner@example.test',SETUP_TOKEN:'synthetic-test-setup-token-thirty-two-characters',SESSION_SECRET:'synthetic-test-secret-at-least-thirty-two-characters',MAIL_FROM:'nook@example.test',ipLimit:1000,emailLimit:100},clientIp:()=> 'local',mailSender:sender});
 const handle=createAuthHandler(auth);
 const request=(path,body,cookie)=>new Request(origin+path,{method:body?'POST':'GET',headers:{origin,host:new URL(origin).host,...(body?{'content-type':'application/json'}:{}),...(cookie?{cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const call=(path,body,cookie)=>handle(request(path,body,cookie));
 async function signIn(email){const sent=await call('/auth/magic-link',{email});if(sent.status!==202)throw Error('Sign-in request failed');const value=new URL(mail.at(-1).text.trim().split('\n').at(-1)).searchParams.get('token');const confirmed=await call('/auth/confirm',{token:value});if(confirmed.status!==303)throw Error('Sign-in confirmation failed');return auth.getSession(request('/auth/session',null,confirmed.headers.get('set-cookie').split(';')[0]))}
 if(!bootstrap)return {db,adapter,auth,call,request,signIn,close:()=>db.close()};
 const ownerResponse=await call('/auth/bootstrap',{token:'synthetic-test-setup-token-thirty-two-characters',displayName:'Owner'});if(ownerResponse.status!==303)throw new Error('Owner setup failed '+ownerResponse.status);
 const ownerCookie=ownerResponse.headers.get('set-cookie').split(';')[0],owner=await auth.getSession(request('/auth/session',null,ownerCookie));
 db.prepare("INSERT INTO nook_conversations(id,name,kind,owner) VALUES('launch','Launch','channel',?),('review','Review','private',?)").run(owner.operatorId,owner.operatorId);
 db.prepare("INSERT INTO nook_members VALUES('launch',?),('review',?)").run(owner.operatorId,owner.operatorId);
 function plan(email,{role='member',mode='member',scopes=['launch'],issuer=owner}={}){db.prepare("INSERT INTO nook_invite_plans(id,email,role,mode,scopes,generation,issuer,issuer_version,issuer_session,state) VALUES(?,?,?,?,?,?,?,?,?,'prepared')").run(crypto.randomUUID(),email,role,mode,JSON.stringify(scopes),1,issuer.operatorId,issuer.operator.version,issuer.id)}
 const token=()=>new URL(mail.at(-1).text.trim().split('\n').at(-1)).searchParams.get('token');
 // Owner authority changes need the issuer's fresh email proof (Base step-up).
 async function stepUp(cookie=ownerCookie){if((await call('/auth/step-up',{action:'owner:transfer'},cookie)).status!==202)throw new Error('Step-up request failed');if((await call('/auth/confirm',{token:token()},cookie)).status!==303)throw new Error('Step-up confirmation failed')}
 async function invite(email,options={}){plan(email,options);if(options.role==='owner')await stepUp();const result=await call('/auth/invite',{email,displayName:email.split('@')[0],role:options.role??'member'},ownerCookie);if(result.status!==202)throw new Error('Invitation issuance failed');return token()}
 async function accept(value){return call('/auth/confirm',{token:value})}
 return {db,adapter,auth,call,request,owner,ownerCookie,plan,stepUp,invite,token,accept,close:()=>db.close()}
}
