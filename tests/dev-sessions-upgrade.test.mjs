import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readdirSync,readFileSync} from 'node:fs'
import {DatabaseSync} from 'node:sqlite'

// An installation made before dev identity upgrades in place: the dev-sessions migration rebuilds
// oa_sessions around Nook's four triggers that read it, and nothing a person already has changes.
const migrations=readdirSync(new URL('../migrations/',import.meta.url)).filter(name=>name.endsWith('.sql')).sort()
const apply=(db,files)=>{for(const file of files)db.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'))}
const objects=db=>Object.fromEntries(db.prepare("SELECT name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'").all().map(row=>[row.name,row.sql]))

test('the dev-sessions migration keeps every session, message, attachment and admission rule of a populated store',()=>{
 const db=new DatabaseSync(':memory:')
 apply(db,migrations.filter(name=>name<'0015'))
 const now=Date.now(),far=now+86_400_000
 db.exec(`INSERT INTO oa_operators(id,email,display_name,role,status,created_at) VALUES('owner','owner@example.test','Owner','owner','active',${now}),('member','member@example.test','Member','member','active',${now});
  INSERT INTO nook_access(user,mode,active,generation) VALUES('owner','member',1,1),('member','member',1,1);
  INSERT INTO nook_conversations(id,name,kind,owner,seq,message_count) VALUES('c1','Launch','channel','owner',1,1);
  INSERT INTO nook_members(conversation,user) VALUES('c1','owner'),('c1','member');
  INSERT INTO nook_messages(id,conversation,author,body,body_lower,version,deleted,created,intent,payload,sequence,ordinal,author_ordinal) VALUES('m1','c1','member','Ship it','ship it',1,0,'2026-10-01T00:00:00Z','i1','{}',1,1,1);
  INSERT INTO nook_attachments(id,conversation,author,message,name,mime,size,sha256,expires,state,created,object_key,intent,position) VALUES('a1','c1','member','m1','plan.png','image/png',68,'${'0'.repeat(64)}',${far},'attached','2026-10-01T00:00:00Z','objects/a1','i2',0);
  INSERT INTO oa_sessions(id,token_hash,operator_id,operator_version,kind,created_at,expires_at) VALUES('s-native','h1','owner',1,'native',${now},${far}),('s-review','h2','member',1,'review',${now},${far}),('s-oidc','h3','member',1,'oidc',${now},${far}),('s-password','h4','member',1,'password',${now},${far})`)
 const sessions=()=>db.prepare('SELECT id,token_hash,operator_id,operator_version,kind,created_at,expires_at,revoked_at FROM oa_sessions ORDER BY id').all()
 const triggers=()=>db.prepare("SELECT name,sql FROM sqlite_master WHERE type='trigger' ORDER BY name").all()
 const before={sessions:sessions(),triggers:triggers(),rows:db.prepare('SELECT (SELECT count(*) FROM nook_messages) messages,(SELECT count(*) FROM nook_attachments) attachments,(SELECT count(*) FROM nook_members) members').get()}
 apply(db,['0015_dev_sessions.sql'])
 assert.deepEqual(sessions(),before.sessions,'every session keeps its id, token, operator, kind and expiry')
 assert.deepEqual(triggers(),before.triggers,'every trigger, including the four that read oa_sessions, is restored unchanged')
 assert.deepEqual(db.prepare('SELECT (SELECT count(*) FROM nook_messages) messages,(SELECT count(*) FROM nook_attachments) attachments,(SELECT count(*) FROM nook_members) members').get(),before.rows)
 db.exec(`INSERT INTO oa_sessions(id,token_hash,operator_id,operator_version,kind,created_at,expires_at) VALUES('s-dev','h5','owner',1,'dev',${now},${far})`)
 assert.throws(()=>db.exec(`INSERT INTO oa_sessions(id,token_hash,operator_id,operator_version,kind,created_at,expires_at) VALUES('s-bad','h6','owner',1,'other',${now},${far})`),/CHECK/)
 db.exec("INSERT INTO oa_dev_credentials(credential,id,created_at) VALUES('oa_tokens','t1',1)")
 // Nook's admission rule still reads the rebuilt table: deactivating an operator revokes their sessions.
 db.exec("UPDATE oa_operators SET status='inactive' WHERE id='member'")
 assert.equal(db.prepare("SELECT count(*) n FROM oa_sessions WHERE operator_id='member' AND revoked_at IS NULL").get().n,0)
 assert.equal(db.prepare("SELECT count(*) n FROM nook_members WHERE user='member'").get().n,0,'deactivation still removes memberships')
 // A fresh store takes the same files in order and ends with the same schema.
 const fresh=new DatabaseSync(':memory:');apply(fresh,migrations)
 assert.equal(objects(fresh).oa_sessions,objects(db).oa_sessions)
})
