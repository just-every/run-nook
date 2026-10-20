type Statement={bind(...values:unknown[]):Statement}
type Database={prepare(sql:string):Statement}
export type AuditOutcome='confirmed'|'failed'|'uncertain'
export type AuditRow={id?:string;actor?:string|null;service?:string|null;kind:string;scope?:'workspace'|'person';conversation?:string;person?:string;version?:number|null;reason:string;outcome?:AuditOutcome;subject?:string|null;detail?:Record<string,string|number|boolean|null>;settles?:string|null;at?:number}
export function auditStatement<D extends Database>(db:D,row:AuditRow):ReturnType<D['prepare']>
export function settleStatement<D extends Database>(db:D,settles:string,row:{actor?:string|null;service?:string|null;kind:string;outcome:AuditOutcome;reason:string;detail?:Record<string,string|number|boolean|null>}):ReturnType<D['prepare']>
