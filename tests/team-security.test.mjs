import {test} from 'node:test';
import assert from 'node:assert/strict';
import {teamFixture} from './team-sql-support.mjs';

test('actual Base invitation confirmation grants exact guest scope once; bare invite stays product-denied',async()=>{
 const f=await teamFixture();try{
  const link=await f.invite('guest@example.test',{mode:'guest',scopes:['review']});
  assert.equal((await f.call('/auth/confirm?token='+encodeURIComponent(link))).status,200);
  assert.equal(f.db.prepare("SELECT status FROM oa_operators WHERE email='guest@example.test'").get().status,'invited');
  const accepted=await f.accept(link);assert.equal(accepted.status,303);assert.equal((await f.accept(link)).status,400);
  const guest=f.db.prepare("SELECT id FROM oa_operators WHERE email='guest@example.test'").get().id;
  assert.deepEqual(f.db.prepare('SELECT conversation FROM nook_members WHERE user=?').all(guest).map(r=>r.conversation),['review']);
  assert.equal(f.db.prepare('SELECT mode FROM nook_access WHERE user=?').get(guest).mode,'guest');
  assert.throws(()=>f.db.prepare("INSERT INTO nook_members VALUES('launch',?)").run(guest),/product_scope_denied/);
  assert.throws(()=>f.db.prepare("UPDATE oa_operators SET role='admin' WHERE id=?").run(guest),/guest_role_conflict/);
  f.db.prepare("DELETE FROM nook_members WHERE conversation='review' AND user=?").run(guest);assert.equal(f.db.prepare('SELECT count(*) AS n FROM nook_guest_grants WHERE user=?').get(guest).n,0);assert.throws(()=>f.db.prepare("INSERT INTO nook_members VALUES('review',?)").run(guest),/product_scope_denied/);
  assert.equal((await f.call('/auth/invite',{email:'bare@example.test',displayName:'Bare',role:'member'},f.ownerCookie)).status,202);
  assert.equal((await f.accept(f.token())).status,303);
  assert.equal(f.db.prepare("SELECT count(*) AS n FROM nook_access WHERE user=(SELECT id FROM oa_operators WHERE email='bare@example.test')").get().n,0);
  assert.equal(f.db.prepare("SELECT active FROM nook_actors WHERE id=(SELECT id FROM oa_operators WHERE email='bare@example.test')").get().active,0);
 }finally{f.close()}
});

test('actual Base deactivate atomically revokes two sessions and all grants; reactivation cannot resurrect either',async()=>{
 const f=await teamFixture();try{
  const response=await f.accept(await f.invite('member@example.test',{scopes:['launch','review']}));
  const cookie=response.headers.get('set-cookie').split(';')[0];
  await f.call('/auth/magic-link',{email:'member@example.test'});const second=await f.accept(f.token()),cookie2=second.headers.get('set-cookie').split(';')[0];
  const member=await f.auth.getSession(f.request('/auth/session',null,cookie));
  f.db.prepare("INSERT INTO nook_conversations(id,name,kind,owner) VALUES('dm','Private DM','dm',?)").run(member.operatorId);
  f.db.prepare("INSERT INTO nook_members VALUES('dm',?),('dm',?)").run(member.operatorId,f.owner.operatorId);
  f.db.prepare('INSERT INTO nook_dm_roster SELECT conversation,user FROM nook_members WHERE conversation=?').run('dm');
  assert.equal((await f.call('/auth/operator/status',{operatorId:member.operatorId,status:'inactive'},f.ownerCookie)).status,200);
  assert.equal((await f.call('/auth/session',null,cookie)).status,401);assert.equal((await f.call('/auth/session',null,cookie2)).status,401);
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM nook_members WHERE user=?').get(member.operatorId).n,0);
  assert.equal(f.db.prepare('SELECT active FROM nook_access WHERE user=?').get(member.operatorId).active,0);
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM oa_sessions WHERE operator_id=? AND revoked_at IS NULL').get(member.operatorId).n,0);
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM nook_dm_roster WHERE user=?').get(member.operatorId).n,1);
  assert.equal(f.db.prepare('SELECT active FROM nook_actors WHERE id=?').get(member.operatorId).active,0);
  assert.throws(()=>f.db.prepare("INSERT INTO nook_members VALUES('launch',?)").run(member.operatorId),/product_scope_denied/);
  assert.equal((await f.call('/auth/operator/status',{operatorId:member.operatorId,status:'active'},f.ownerCookie)).status,200);
  assert.equal((await f.call('/auth/session',null,cookie)).status,401);assert.equal((await f.call('/auth/session',null,cookie2)).status,401);
  assert.equal(f.db.prepare('SELECT active FROM nook_access WHERE user=?').get(member.operatorId).active,0);
  await f.call('/auth/magic-link',{email:'member@example.test'});assert.equal((await f.accept(f.token())).status,303);
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM nook_members WHERE user=?').get(member.operatorId).n,0);
  f.db.prepare('UPDATE nook_access SET active=1 WHERE user=?').run(member.operatorId);f.db.prepare("INSERT INTO nook_members VALUES('review',?)").run(member.operatorId);
  f.db.prepare("UPDATE oa_operators SET status='inactive' WHERE id=?").run(member.operatorId);
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM nook_members WHERE user=?').get(member.operatorId).n,0);
  const before=f.db.prepare('SELECT count(*) AS n FROM nook_members WHERE user=?').get(f.owner.operatorId).n;
  await f.stepUp();assert.equal((await f.call('/auth/operator/status',{operatorId:f.owner.operatorId,status:'inactive'},f.ownerCookie)).status,409);
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM nook_members WHERE user=?').get(f.owner.operatorId).n,before);
 }finally{f.close()}
});

test('pending scope is immutable; cancel invalidates old confirmation and scope loss blocks acceptance atomically',async()=>{
 const f=await teamFixture();try{
  const old=await f.invite('waiting@example.test',{mode:'guest',scopes:['review']});
  const target=f.db.prepare("SELECT id FROM oa_operators WHERE email='waiting@example.test'").get().id;
  assert.throws(()=>f.db.prepare("UPDATE nook_invite_plans SET scopes='[\"launch\"]' WHERE email='waiting@example.test'").run(),/immutable/);
  assert.equal((await f.call('/auth/invite/cancel',{operatorId:target},f.ownerCookie)).status,200);assert.equal((await f.accept(old)).status,400);
  f.plan('waiting@example.test',{mode:'guest',scopes:['launch']});
  assert.equal((await f.call('/auth/invite',{email:'waiting@example.test',displayName:'Waiting',role:'member'},f.ownerCookie)).status,202);
  const fresh=f.token();assert.equal((await f.accept(old)).status,400);assert.equal((await f.accept(fresh)).status,303);
  const pending=await f.invite('raced@example.test',{mode:'guest',scopes:['review']});
  f.db.prepare("DELETE FROM nook_members WHERE conversation='review' AND user=?").run(f.owner.operatorId);
  assert.equal((await f.accept(pending)).status,503);
  assert.equal(f.db.prepare("SELECT status FROM oa_operators WHERE email='raced@example.test'").get().status,'invited');
  assert.equal(f.db.prepare("SELECT count(*) AS n FROM oa_sessions WHERE operator_id=(SELECT id FROM oa_operators WHERE email='raced@example.test')").get().n,0);
  assert.throws(()=>f.plan('duplicate@example.test',{scopes:['launch','launch']}),/invalid_invitation_scope/);
  assert.throws(()=>f.plan('foreign@example.test',{scopes:['missing']}),/invalid_invitation_scope/);
 }finally{f.close()}
});

test('Base default administration roles constrain actual invite and lifecycle routes',async()=>{
 const f=await teamFixture();try{
  const joined=await f.accept(await f.invite('admin@example.test',{role:'admin'})),cookie=joined.headers.get('set-cookie').split(';')[0];
  const admin=await f.auth.getSession(f.request('/auth/session',null,cookie));
  assert.equal((await f.call('/auth/invite',{email:'forbidden@example.test',displayName:'Forbidden',role:'owner'},cookie)).status,403);
  assert.equal((await f.call('/auth/operator/status',{operatorId:f.owner.operatorId,status:'inactive'},cookie)).status,403);
  f.plan('admin-guest@example.test',{mode:'guest',issuer:admin});
  assert.equal((await f.call('/auth/invite',{email:'admin-guest@example.test',displayName:'Guest',role:'member'},cookie)).status,202);
  const guestResponse=await f.accept(f.token());assert.equal(guestResponse.status,303);const guestCookie=guestResponse.headers.get('set-cookie').split(';')[0];
  assert.equal((await f.call('/auth/operators',null,guestCookie)).status,403);
  assert.equal((await f.call('/auth/invite',{email:'escape@example.test',displayName:'Escape',role:'member'},guestCookie)).status,403);
  assert.throws(()=>f.plan('bad-mode@example.test',{mode:'guest',role:'admin'}),/CHECK constraint/);
 }finally{f.close()}
});
