import {demoSockets} from './src/base/modules/demo/vite.mjs'
import { cloudflare } from '@cloudflare/vite-plugin'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { assertBuildStateSafe, persistencePath } from './scripts/persistence.mjs'
import { docsSite } from './src/docs/build/plugin.ts'
import { archiveOutputGuard } from '@runeditrun/rer/archive-output'

// Only `vite dev` loads the local-only entry and the checkout's dev key; a build keeps src/server.ts
// and never sees either (rer build checks its output).
const local = (name: string) => process.env[name] ? { [name]: process.env[name] } : {}
const serve = { main: './src/server.dev.ts', vars: { ...local('RER_DEV_ORIGIN'), ...local('RER_DEV_KEY'), ...local('RER_DEV_IDENTITY'), ...local('RER_DEMO'), ...local('RER_DEMO_EXPIRES') } }

// `vite dev` serves files under the checkout; rer's private folders (the dev key, installer state)
// never answer. The plugin already denies .dev.vars and .wrangler.
const server = { fs: { strict: true, allow: ['src', 'public', 'node_modules', 'docs', 'rer-project.json'], deny: ['**/.rer/**', '**/.seed/**', '**/.wrangler/**', '**/.git/**', '**/.dev.vars*', '**/.env*', '**/exports/**', '**/*.rer', '**/*.rer.*.partial'] } }

export default defineConfig(({command,isPreview}) => {
 if(command === 'build') assertBuildStateSafe(process.cwd())
 return { server, plugins: [demoSockets(), cloudflare({ inspectorPort: false, persistState: {path: persistencePath(process.cwd(),process.env.RER_STATE_DIR)}, viteEnvironment: { name: 'ssr' }, ...(command === 'serve' && !isPreview ? { config: serve } : process.env.RER_DEV_ORIGIN ? { config: { vars: local('RER_DEV_ORIGIN') } } : {}) }), docsSite(), tanstackStart(), react(), archiveOutputGuard()] }
})
