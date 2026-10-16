import type { RunData } from '../base/run-site'

export const run: RunData = {
  name: 'Nook',
  repository: 'https://github.com/just-every/run-nook',
  clone: 'npx -y @runeditrun/rer dev just-every/run-nook',
  folder: 'run-nook',
  requirements: 'Needs npm and Git, on macOS, Linux or Windows with WSL2. rer installs the pinned Node and pnpm itself; no Node version or pnpm prerequisite. Local rer setup is optional. To host Nook, set OWNER_EMAIL at rer deploy; rer claims the hosted owner automatically, with no manual setup-token step. Sign in by email at the deployed address.',
  licence: 'MIT',
  docs: true,
  hosted: [],
}
