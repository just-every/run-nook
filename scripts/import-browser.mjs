import { fileURLToPath } from 'node:url';

const runtime = name => fileURLToPath(new URL(`../src/imports/browser-runtime/${name}.ts`, import.meta.url));

/** SSR/Workers retain native builtins; only the client graph gets adapters. */
export function importBrowser() {
  return {
    name: 'local-import-browser-runtime',
    enforce: 'pre',
    resolveId(id, importer, options) {
      const name = this.environment?.name;
      const client = name === 'client' || !name && options?.ssr === false;
      if (!client) return null;
      if (id === 'node:crypto') return runtime('crypto');
      if (id === 'node:zlib') return runtime('zlib');
      if (id === 'node:buffer' || id === 'buffer') return this.resolve('buffer/', importer, { skipSelf: true });
      return null;
    },
  };
}
