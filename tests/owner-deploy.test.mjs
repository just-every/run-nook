import test from 'node:test'
import assert from 'node:assert/strict'
import {execFileSync,spawnSync} from 'node:child_process'
import {readFileSync} from 'node:fs'
import {mkdtemp,rm,symlink} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {pathToFileURL} from 'node:url'

const root=resolve(import.meta.dirname,'..')
// The clone is a different checkout: it takes its own local operation, not verify's.
const {RER_LOCAL_OPERATION:_,...cloneEnvironment}={...process.env,CI:'true'}
const owner={OWNER_EMAIL:'owner@example.test',MAIL_FROM:'nook@example.test',SENDGRID_API_KEY:'test-only-sendgrid-key'}

test('rer deploy builds the committed source, applies every migration to a new D1 and checks health on the owner account',{timeout:20*60_000},async t=>{
 const clone=await mkdtemp(join(tmpdir(),'nook-owner-deploy-'));t.after(()=>rm(clone,{recursive:true,force:true}))
 execFileSync('git',['clone','--quiet','--no-hardlinks',root,clone])
 await symlink(join(root,'node_modules'),join(clone,'node_modules'),'dir')
 const report=join(clone,'.rer-test-provider.json')
 const deploy=(env)=>{
  const result=spawnSync(process.execPath,['--import',pathToFileURL(join(root,'tests/fake-cloudflare.mjs')).href,'node_modules/@runeditrun/rer/bin/rer.mjs','deploy','--owner-name','Nook Owner','--json','--non-interactive'],{cwd:clone,encoding:'utf8',timeout:15*60_000,env:{...cloneEnvironment,NOOK_FAKE_CLOUDFLARE_REPORT:report,...env}})
  const events=result.stdout.trim().split('\n').filter(Boolean).map(line=>JSON.parse(line))
  return {status:result.status,result:events.find(event=>event.event==='result'),error:events.find(event=>event.event==='error'),output:result.stdout+result.stderr,provider:JSON.parse(readFileSync(report,'utf8'))}
 }

 const noMail=deploy({})
 assert.equal(noMail.status,4,noMail.output)
 assert.equal(noMail.error.code,'safety_refusal')
 assert.equal(noMail.provider.writes,0,'unconfigured production mail refuses before any provider write')

 const absent=deploy({MAIL_FROM:owner.MAIL_FROM,SENDGRID_API_KEY:owner.SENDGRID_API_KEY})
 assert.equal(absent.status,3,absent.output)
 assert.equal(absent.provider.writes,0,'missing owner refuses before any provider write')

 const first=deploy(owner)
 assert.equal(first.status,0,first.output)
 assert.equal(first.result.ok,true)
 assert.equal(first.provider.deployed,true,JSON.stringify(first.result))
 assert.deepEqual(first.provider.databases,[JSON.parse(readFileSync(join(root,'owner-deployment.json'),'utf8')).project.split('/')[1]+'-production-db'])
 for(const table of ['oa_operators','workspace'])assert.ok(first.provider.tables[0].includes(table),table)
 assert.equal(first.provider.claims,1,'rer deploy claims the hosted owner once')
 assert.equal(first.provider.secrets.includes('SETUP_TOKEN'),false,'the spent setup token is retired from the Worker')
 for(const value of Object.values(owner))assert.ok(!first.output.includes(value),'deploy output never prints a secret')
})
