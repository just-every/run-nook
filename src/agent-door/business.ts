import { createBusinessSettings } from '../base/modules/business-settings/index.ts'
import type { StorageBindings } from '../platform/storage/context'

export const business={settings:1 as const,values:['display_name'] as const}
export function nookBusiness(env:StorageBindings&{RER_BUSINESS_TRUST?:string}){
 return createBusinessSettings({db:env.DB,trust:env.RER_BUSINESS_TRUST,business})
}
