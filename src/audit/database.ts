/** Supply the initiating identity to SQL audit triggers inside the same D1
 * transaction as the write. This adapter belongs to Nook; Base stays byte-exact. */
export function auditDatabase(db:D1Database,actor:string|null):D1Database {
 const statements=new WeakMap<object,D1PreparedStatement>()
 const unwrap=(value:D1PreparedStatement)=>statements.get(value)??value
 const wrap=(statement:D1PreparedStatement,sql:string):D1PreparedStatement=>{
  const proxy=new Proxy(statement,{get(target,key){
   if(key==='bind')return (...values:any[])=>wrap(target.bind(...values),sql)
   if(key==='run'&&/^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/i.test(sql))return async()=>{
    const results=await batch([target]);return results[0]
   }
   const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value
  }});statements.set(proxy,statement);return proxy
 }
 const batch=async<T=unknown>(queries:D1PreparedStatement[]):Promise<D1Result<T>[]>=>{
  const result=await db.batch<T>([db.prepare('INSERT OR REPLACE INTO nook_audit_context VALUES(1,?)').bind(actor),...queries.map(unwrap),db.prepare('DELETE FROM nook_audit_context WHERE id=1')]);return result.slice(1,-1)
 }
 return new Proxy(db,{get(target,key){
  if(key==='prepare')return (sql:string)=>wrap(target.prepare(sql),sql)
  if(key==='batch')return batch
  const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value
 }})
}
