import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,symlinkSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,dirname} from 'node:path'
import {DatabaseSync} from 'node:sqlite'
import {assertBuildStateSafe,persistencePath} from '../scripts/persistence.mjs'
import {lifecycle} from '../scripts/installer/local.mjs'

test('build/install refuse populated or ambiguous dist state and physical aliases before effects',async()=>{
 const root=mkdtempSync(join(tmpdir(),'nook-preserve-'))
 try{
  mkdirSync(join(root,'src'));writeFileSync(join(root,'src/branding.json'),'preserve branding')
  const legacy=join(root,'dist/server/.wrangler/state/v3/d1/private.sqlite');mkdirSync(dirname(legacy),{recursive:true});const db=new DatabaseSync(legacy);db.exec("CREATE TABLE private_state(body TEXT); INSERT INTO private_state VALUES('must survive refusal')");db.close();const bytes=readFileSync(legacy)
  const canonical=join(root,'.wrangler/state');mkdirSync(canonical,{recursive:true});writeFileSync(join(canonical,'sentinel'),'second store')
  assert.throws(()=>assertBuildStateSafe(root),/Build-local/)
  const state={},steps=[];await assert.rejects(()=>lifecycle.run(root,{WORKSPACE_NAME:'replace',PRIMARY_COLOR:'#ffffff'},{state,step:async s=>steps.push(s),phase:async phase=>state.phase=phase},()=>assert.fail('started app'),undefined),/legacy state|Build-local/)
  assert.deepEqual(steps,[]);assert.equal(readFileSync(join(root,'src/branding.json'),'utf8'),'preserve branding');assert.deepEqual(readFileSync(legacy),bytes);assert.equal(readFileSync(join(canonical,'sentinel'),'utf8'),'second store')
  rmSync(join(root,'dist'),{recursive:true});assertBuildStateSafe(root);assert.deepEqual(readFileSync(join(canonical,'sentinel')),Buffer.from('second store'))
  assert.throws(()=>persistencePath(root,'dist/custom-state'),/outside disposable/)
  rmSync(join(root,'.wrangler'),{recursive:true});mkdirSync(join(root,'.wrangler'));mkdirSync(join(root,'dist/state'),{recursive:true});symlinkSync('../dist/state',canonical);assert.throws(()=>assertBuildStateSafe(root),/outside disposable/)
  rmSync(canonical);symlinkSync(join(root,'missing'),canonical);assert.throws(()=>assertBuildStateSafe(root),/Unresolved/)
 }finally{rmSync(root,{recursive:true,force:true})}
})
