import {createBusinessSettings} from '../base/modules/business-settings/index.ts'
// @ts-ignore Nook's existing portable auth factory owns configuration and mail.
import {createConfiguredAuth} from '../platform/operator-auth-runtime.mjs'
import branding from '../branding.json'
import type {StorageBindings} from '../platform/storage/context'
export const businessManifest={settings:1 as const,values:['display_name'] as const,team:{roles:{admin:'admin',member:'member'}}}
export function businessSettings(env:StorageBindings){
 const auth=createConfiguredAuth(env,branding)
 return createBusinessSettings({db:env.DB,trust:env.RER_BUSINESS_TRUST,business:businessManifest,team:auth.businessTeam})
}
