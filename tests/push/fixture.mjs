import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readdir,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from 'node:net';
const require=createRequire(import.meta.url),{Miniflare,Log,LogLevel,convertV4MiniflareOptions}=createRequire(require.resolve('wrangler'))('miniflare');
// Run the emitted application and actual Durable Object alarms. The sole fake is
// the outbound HTTPS edge: no provider account or vendor request is used.
export async function installation(edge){
 const port=await new Promise((resolve,reject)=>{const server=createServer();server.once('error',reject);server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(()=>resolve(port))})});
 const origin='http://127.0.0.1:'+port,secret=crypto.randomUUID()+crypto.randomUUID(),token=crypto.randomUUID()+crypto.randomUUID();
 const modules=[{type:'ESModule',path:resolve('dist/server/index.js')},...(await readdir('dist/server/assets')).filter(name=>name.endsWith('.js')).map(name=>({type:'ESModule',path:resolve('dist/server/assets',name)}))];
 const mf=new Miniflare(convertV4MiniflareOptions({port,host:'127.0.0.1',name:'nook-push-test',routes:['*/*'],modules,modulesRoot:resolve('dist/server'),compatibilityDate:'2026-09-08',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['FILES'],durableObjects:{CHAT_HUB:{className:'ChatHub',useSQLite:true}},bindings:{AUTH_ORIGIN:origin,AUTH_LOCAL:'true',OWNER_EMAIL:'owner@example.test',SESSION_SECRET:secret,SETUP_TOKEN:token,MAIL_PROVIDER:'development',MAIL_FROM:'nook@example.test'},outboundService:edge,log:new Log(LogLevel.ERROR)}));
 try{
 const db=await mf.getD1Database('DB');
 // Miniflare's SQL exec splits multiline triggers incorrectly; use Wrangler's
 // public migration reader to preserve complete SQLite statements.
 const {unstable_splitSqlQuery}=require('wrangler');
 for(const name of (await readdir('migrations')).filter(n=>n.endsWith('.sql')).sort())await db.batch(unstable_splitSqlQuery(await readFile(resolve('migrations',name),'utf8')).map(query=>db.prepare(query)));
 const raw=(path,method='GET',body,cookie='',extra={})=>mf.dispatchFetch(origin+path,{method,redirect:'manual',headers:{origin,host:new URL(origin).host,...(cookie?{cookie}:{}),...(body===undefined?{}:{'Content-Type':'application/json'}),...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const call=async(path,method='GET',body,cookie='',status=200,extra={})=>{const response=await raw(path,method,body,cookie,extra);assert.equal(response.status,status,method+' '+path);return response.status===204?null:response.json()};
 const initial=await raw('/auth/bootstrap','POST',{token,displayName:'Owner'});assert.equal(initial.status,303);const ownerCookie=initial.headers.get('set-cookie').split(';')[0];
 const owner=await call('/api/me','GET',undefined,ownerCookie);
 const invite=async(name,conversation)=>{const email=name+'@example.test';await call('/api/team/invitations','POST',{email,role:'member',mode:'member',scopes:[conversation]},ownerCookie);await call('/auth/invite','POST',{email,displayName:name,role:'member'},ownerCookie,202);const row=await db.prepare('SELECT message FROM rer_mail_development_outbox ORDER BY sequence DESC LIMIT 1').first(),mail=JSON.parse(row.message),link=new URL(mail.text.trim().split('\n').at(-1));const accepted=await raw('/auth/confirm','POST',{token:link.searchParams.get('token')});assert.equal(accepted.status,303);const cookie=accepted.headers.get('set-cookie').split(';')[0];return {cookie,user:await call('/api/me','GET',undefined,cookie)}};
 return {mf,db,raw,call,owner,ownerCookie,invite,origin,close:()=>mf.dispose()};
 }catch(error){await mf.dispose();throw error}
}
export async function until(check,label,timeout=25_000){const end=Date.now()+timeout;while(Date.now()<end){const value=await check();if(value)return value;await new Promise(resolve=>setTimeout(resolve,100))}throw Error('Timed out: '+label)}
