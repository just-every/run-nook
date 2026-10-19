import type {Context} from '../platform/storage/context'
import {fail,text} from '../family/team-chat/domain'
import {allowedGrant} from '../team/access'
import {newSecret,sealToken} from './secret'
// NOOK-079: only an owner's own signed-in session manages integration tokens.
const ownerOnly=`EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner' AND status='active')`
async function requireOwner(c:Context){if(!await c.one(`SELECT 1 WHERE ${ownerOnly}`,[c.uid]))fail(403,'Only owners manage integration tokens')}
const audit=(c:Context,row:{family:string;token:string;name:string;action:string;conversation?:string|null;message?:string|null;code?:string|null;route?:string|null;actor?:string|null})=>
 c.sql('INSERT INTO nook_integration_audit VALUES(?,?,?,?,?,?,?,?,?,?,?)',crypto.randomUUID(),row.family,row.token,row.name,Date.now(),row.action,row.actor===undefined?c.uid:row.actor,row.conversation??null,row.message??null,row.code??null,row.route??null)
export async function listTokens(c:Context){
 await requireOwner(c)
 const [tokens,bindings,events]=await Promise.all([
  c.rows(`SELECT t.family AS id,t.id AS token,t.name,t.state,t.created,t.ended,o.name AS creatorName,(SELECT MAX(at) FROM nook_integration_audit a WHERE a.family=t.family AND a.action IN ('post','replay')) AS lastUsed FROM nook_integration_tokens t JOIN nook_actors o ON o.id=t.creator WHERE t.id=(SELECT id FROM nook_integration_tokens x WHERE x.family=t.family ORDER BY (x.state='active') DESC,x.created DESC LIMIT 1) ORDER BY t.created DESC`),
  c.rows('SELECT b.family,b.conversation AS id,c.name FROM nook_integration_bindings b JOIN nook_conversations c ON c.id=b.conversation ORDER BY c.name'),
  c.rows('SELECT a.id,a.family,a.name,a.at,a.action,a.code,a.route,a.message,c.name AS conversationName,o.name AS actorName FROM nook_integration_audit a LEFT JOIN nook_conversations c ON c.id=a.conversation LEFT JOIN nook_actors o ON o.id=a.actor ORDER BY a.at DESC,a.id LIMIT 100'),
 ])
 return {tokens:tokens.map(t=>({...t,conversations:bindings.filter(b=>b.family===t.id).map(({id,name})=>({id,name}))})),audit:events}
}
export async function createToken(c:Context,input:Record<string,unknown>){
 await requireOwner(c)
 if(Object.keys(input).some(key=>!['name','conversations'].includes(key)))fail(400,'Unsupported token setting')
 const name=text(input.name,80).trim()||fail(400,'Name the integration')
 const conversations=input.conversations
 if(!Array.isArray(conversations)||!conversations.length||conversations.length>20||conversations.some(id=>typeof id!=='string')||new Set(conversations).size!==conversations.length)fail(400,'Choose between 1 and 20 conversations')
 for(const id of conversations as string[])
  if(!await c.one(`SELECT 1 FROM nook_conversations k JOIN nook_members m ON m.conversation=k.id AND m.user=? WHERE k.id=? AND k.kind IN ('channel','private') AND ${allowedGrant('m.user','m.conversation')}`,[c.uid,id]))fail(400,'Choose channels you belong to; a token never posts into a direct message')
 const family=crypto.randomUUID(),id=crypto.randomUUID(),secret=newSecret(id)
 await c.batch([
  c.sql("INSERT INTO nook_integration_tokens VALUES(?,?,?,?,?,?,'active',NULL)",id,family,name,c.uid,await sealToken(secret,c.env.SESSION_SECRET),Date.now()),
  ...(conversations as string[]).map(conversation=>c.sql('INSERT INTO nook_integration_bindings VALUES(?,?)',family,conversation)),
  audit(c,{family,token:id,name,action:'create'}),
 ],undefined,ownerOnly,[c.uid])
 return {secret,...await listTokens(c)}
}
async function activeToken(c:Context,family:string){
 return await c.one<{id:string;name:string}>("SELECT id,name FROM nook_integration_tokens WHERE family=? AND state='active'",[family])??fail(404,'No active token for this integration')
}
// Rotation ends the old secret at once; the family, its conversations and its idempotency keys stay.
export async function rotateToken(c:Context,family:string){
 await requireOwner(c);const old=await activeToken(c,family),id=crypto.randomUUID(),secret=newSecret(id),now=Date.now()
 await c.batch([
  c.sql("UPDATE nook_integration_tokens SET state='rotated',ended=? WHERE id=? AND state='active'",now,old.id),
  c.sql("INSERT INTO nook_integration_tokens SELECT ?,family,name,creator,?,?,'active',NULL FROM nook_integration_tokens WHERE id=?",id,await sealToken(secret,c.env.SESSION_SECRET),now,old.id),
  audit(c,{family,token:id,name:old.name,action:'rotate'}),
 ],undefined,`${ownerOnly} AND EXISTS(SELECT 1 FROM nook_integration_tokens WHERE id=? AND state='active')`,[c.uid,old.id])
 return {secret,...await listTokens(c)}
}
export async function revokeToken(c:Context,family:string){
 await requireOwner(c);const old=await activeToken(c,family)
 await c.batch([
  c.sql("UPDATE nook_integration_tokens SET state='revoked',ended=? WHERE id=? AND state='active'",Date.now(),old.id),
  audit(c,{family,token:old.id,name:old.name,action:'revoke'}),
 ],undefined,ownerOnly,[c.uid])
 return listTokens(c)
}
export async function tokenRoute(c:Context,method:string,parts:string[],input:Record<string,unknown>){
 if(parts[1]!=='integrations'||parts[2]!=='tokens')return null
 if(parts.length===3&&method==='GET')return listTokens(c)
 if(parts.length===3&&method==='POST')return createToken(c,input)
 if(parts.length===5&&method==='POST'&&parts[4]==='rotate')return rotateToken(c,parts[3])
 if(parts.length===5&&method==='POST'&&parts[4]==='revoke')return revokeToken(c,parts[3])
 return fail(404,'Not found')
}
