import {createAgentDoor,type Trust} from '../base/modules/agent-door/index.ts'
import {authBindings} from '../platform/operator-auth.server'
import type {StorageBindings} from '../platform/storage/context'
import {nativePeople} from './people.server'
import {nookTools} from './registry.server'
import {nookResources} from './resources.server'
export const capabilities=['tools','policy','pause','audit','idempotency'] as const
export const notTools=[
 {clauses:['NOOK-006', 'NOOK-041', 'NOOK-042', 'NOOK-043', 'NOOK-044', 'NOOK-045', 'NOOK-046', 'NOOK-077', 'NOOK-103', 'NOOK-076', 'NOOK-131'],reason:'import-door' as const},
 {clauses:['NOOK-021', 'NOOK-074', 'NOOK-078', 'NOOK-097', 'NOOK-136', 'NOOK-138', 'NOOK-133'],reason:'device' as const},
 {clauses:['NOOK-104', 'NOOK-127', 'NOOK-128', 'NOOK-129', 'DOCS-001', 'NOOK-107', 'NOOK-052'],reason:'screen' as const},
 {clauses:['NOOK-088', 'NOOK-090', 'NOOK-106'],reason:'connector' as const},
 {clauses:['NOOK-008', 'NOOK-050', 'NOOK-098', 'NOOK-109', 'NOOK-126', 'NOOK-132', 'NOOK-134'],reason:'installation' as const},
]

function trust(env:StorageBindings):Trust|null{
 const {RER_OWNER_CLAIM_ISSUER:issuer,RER_OWNER_CLAIM_INSTALLATION_ID:installationId,RER_OWNER_CLAIM_PUBLIC_KEYS:publicKeys}=env
 if(!issuer&&!installationId&&!publicKeys)return null
 if(!issuer||!installationId||!publicKeys)throw new Error('Incomplete agent door trust')
 return {issuer,installationId,appOrigin:env.AUTH_ORIGIN,publicKeys:JSON.parse(publicKeys)}
}
export function nookAgentDoor(bindings:StorageBindings){
 const env={...bindings,...authBindings(bindings)}
 return createAgentDoor({seed:'nook',name:'Nook',specialist:'conversation-clerk',db:env.DB,origin:env.AUTH_ORIGIN,trust:trust(env),capabilities,people:nativePeople(env),tools:nookTools(env),resources:nookResources(env),notTools})
}
