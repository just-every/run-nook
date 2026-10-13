import {createPortability,type Cell} from '../../base/modules/portability/index.mjs'
import type {Context} from '../../platform/storage/context'
// @ts-ignore Nook's offline policy is also consumed by the local CLI.
import {portabilityPolicy} from '../../platform/portability-policy.mjs'
export type Sql={sql:string;params:any[]}
const services=new WeakMap<D1Database,Promise<{row:(table:string,key:Record<string,Cell>)=>Promise<Sql[]>;invalidate:()=>Promise<Sql[]>;checkpoint:()=>Promise<Sql[]>}>>()
/** Capture the public D1 prepare/bind boundary. No Base statement internals are read. */
export async function fenceService(c:Context){
 let service=services.get(c.db);if(!service){service=createFence(c);services.set(c.db,service)}return service
}
async function createFence(c:Context){
 const captured=new WeakMap<object,Sql>()
 function prepare(sql:string){
  function bound(params:any[]){const actual=c.db.prepare(sql).bind(...params);const wrapped={bind:(...next:any[])=>bound(next),first:(...args:any[])=>(actual.first as any)(...args),all:()=>actual.all(),run:()=>actual.run(),raw:()=>actual.raw()};captured.set(wrapped,{sql,params});return wrapped}
  return bound([])
 }
 const db={prepare,batch:async(rows:any[])=>c.db.batch(rows.map(row=>{const s=captured.get(row);if(!s)throw Error('Uncaptured portability statement');return c.sql(s.sql,...s.params)}))} as unknown as D1Database
 const service=await createPortability({db,buckets:{FILES:c.env.FILES},policy:portabilityPolicy})
 const decode=(rows:unknown[])=>rows.map(row=>{const s=captured.get(row as object);if(!s)throw Error('Uncaptured portability statement');return s})
 // checkpoint: the redaction checkpoint that refuses every archive older than this erasure.
 return {row:async(table:string,key:Record<string,Cell>)=>decode(await service.erasureStatements(table,key)),invalidate:async()=>decode(await service.invalidateTransfersStatements()),checkpoint:async()=>decode(await service.redactionStatements())}
}
