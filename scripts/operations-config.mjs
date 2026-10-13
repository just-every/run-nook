import {readFile,access} from 'node:fs/promises'
import {isDeepStrictEqual} from 'node:util'
import {projectDescriptor} from './delivery/project.mjs'
import {packagingPolicy} from './delivery/config.mjs'
import {deploymentSpec} from './delivery/base/spec.mjs'

export async function validateConfiguration() {
 const root=new URL('../',import.meta.url)
 const config=JSON.parse(await readFile(new URL('wrangler.jsonc',root),'utf8'))
 if(!/^[a-z][a-z0-9-]*$/.test(config.name)||config.main!=='src/server.ts')throw Error('Invalid Worker configuration')
 if(config.d1_databases?.length!==1||config.d1_databases[0].binding!=='DB'||config.d1_databases[0].migrations_dir!=='migrations')throw Error('Expected product D1 binding and migrations')
 if(config.r2_buckets?.length!==1||config.r2_buckets[0].binding!=='FILES'||config.durable_objects?.bindings?.length!==1||config.durable_objects.bindings[0].name!=='CHAT_HUB'||config.durable_objects.bindings[0].class_name!=='ChatHub')throw Error('Expected product media and live bindings')
 const policy=await packagingPolicy()
 // Inspect actual source resources and every additive migration without requiring
 // a build or fabricating emitted artifacts. The native producer checks the build.
 await deploymentSpec(root.pathname,{...policy.artifact.specInputs,wranglerFile:'wrangler.jsonc'})
 const descriptor=JSON.parse(await readFile(new URL('rer-project.json',root),'utf8'))
 if(!isDeepStrictEqual(descriptor,await projectDescriptor(root.pathname)))throw Error('Project/setup identity differs from packaging source')
 for(const path of ['src/server.ts','src/platform/owner-claim.server.ts','src/platform/editor.server.ts','src/editor/OwnerShell.tsx'])await access(new URL(path,root))
}
