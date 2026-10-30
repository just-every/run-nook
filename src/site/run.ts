import type { RunData } from '../base/run-site'
import { runPricing } from '../base/run-pricing'

export const run: RunData = {
  name: 'Nook',
  repository: 'https://github.com/just-every/run-nook',
  clone: 'npx -y @runeditrun/rer dev just-every/run-nook',
  paths: { product: null },
  pricing: runPricing,
  licence: 'MIT',
  docs: true,
}
