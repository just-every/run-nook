import {Context,type StorageBindings} from '../platform/storage/context'
import type {Session} from '../base/modules/operator-auth/index.mjs'
import {productAccess,fullMember} from '../team/access'
export type DigestSchedule={user:string;enabled:number;cadence:'daily'|'weekly';local_at:string;zone:string;delivery:'app'|'email';next_due:number;version:number;operator_version:number;access_generation:number;updated:number}
// Member approval persists beyond browser sessions. This authority grants only
// that member's current reads and the existing cap-counted recap request.
export class DigestContext extends Context{
 constructor(env:StorageBindings,readonly schedule:DigestSchedule){super(env,{id:'digest:'+schedule.user,operatorId:schedule.user,operator:{version:schedule.operator_version}} as Session)}
 override get credentials(){return [this.uid,this.schedule.operator_version,this.schedule.access_generation]}
 override get fence(){return `EXISTS(SELECT 1 FROM oa_operators o JOIN nook_access a ON a.user=o.id WHERE o.id=? AND o.version=? AND a.generation=? AND o.status='active' AND ${productAccess('o.id')} AND ${fullMember('o.id')})`}
}
