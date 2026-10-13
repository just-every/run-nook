import type { EditionIdentity } from './base/identity'
import branding from './branding.json'
import { productIdentity } from './brand/product'

export const identity: EditionIdentity = { ...productIdentity, deployment: branding.name }
