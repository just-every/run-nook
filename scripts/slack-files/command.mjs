import { ZIP_LIMITS } from '../../src/imports/zip.mjs';
import { references, fetchPlan, filePath, sourceIdentity, listing } from './archive.mjs';
import { outputStore } from './storage.mjs';
import { admittedUrl, download } from './network.mjs';
import { fail, FileError } from './errors.mjs';

export const usage = 'Usage: node scripts/slack-files.mjs <export.zip> <out-dir> [--fetch --token-env ENV_NAME]';
function argumentsFor(argv) {
    if (argv.length === 1 && ['--help', '-h'].includes(argv[0])) return { help: true };
    if (argv.length < 2 || argv[0].startsWith('--') || argv[1].startsWith('--')) fail('usage');
    const [input, output, ...flags] = argv;
    let fetchFiles = false, tokenEnv;
    for (let i = 0; i < flags.length; i++) {
        if (flags[i] === '--fetch' && !fetchFiles) fetchFiles = true;
        else if (flags[i] === '--token-env' && !tokenEnv && /^[A-Za-z_][A-Za-z0-9_]*$/.test(flags[i + 1] ?? '')) tokenEnv = flags[++i];
        else fail('usage');
    }
    if (fetchFiles !== !!tokenEnv) fail('fetch-requires-token-env');
    return { input, output, fetchFiles, tokenEnv };
}

/** Public command implementation. The only injection is the network edge;
 * production URL admission cannot be replaced by a flag or environment value. */
export async function runSlackFiles(argv, { env = process.env, stdout = text => process.stdout.write(text), stderr = text => process.stderr.write(text), transport = fetch } = {}) {
    let token;
    try {
        const args = argumentsFor(argv);
        if (args.help) { stdout(usage + '\n'); return 0; }
        if (args.fetchFiles) {
            token = env[args.tokenEnv];
            if (typeof token !== 'string' || !/^[A-Za-z0-9._~+\/-]+=*$/.test(token)) fail('token-environment-unavailable');
        }
        const source = references(args.input);
        const pending = args.fetchFiles ? fetchPlan(source) : [];
        const supplied = source.items.filter(item => item.suppliedPath).length;
        const print = value => {
            const text = JSON.stringify(value);
            stdout((token ? text.replaceAll(token, '[redacted]') : text) + '\n');
        };
        if (!args.fetchFiles) {
            for (const item of source.items) print({ file: listing(item), ...(item.suppliedPath ? { status: 'supplied' } : {}) });
            print({ mode: 'list', files: source.items.length, fetched: 0, supplied }); return 0;
        }
        for (const item of pending) {
            if (item.id.includes(token) || item.name.includes(token)) fail('credential-in-metadata');
            admittedUrl(item.url);
        }
        const store = pending.length ? outputStore(args.output) : null, budget = { used: source.archive.inflatedBytes };
        let fetched = 0, existing = 0;
        try {
            for (const item of source.items) {
                print({ file: listing(item) });
                if (item.suppliedPath) {
                    print({ id: item.id, status: 'supplied', size: source.archive.files.get(item.suppliedPath).length }); continue;
                }
                const path = filePath(item), identity = sourceIdentity(source.archive, item);
                const existingSize = store.existing(path, identity, item);
                if (existingSize !== false) {
                    budget.used += existingSize;
                    if (budget.used > ZIP_LIMITS.total) fail('total-byte-limit');
                    existing++; print({ id: item.id, status: 'verified-existing' }); continue;
                }
                const bytes = await download(item, token, budget, transport);
                store.save(path, identity, bytes);
                fetched++; print({ id: item.id, status: 'saved', size: bytes.length });
            }
        } finally { store?.close(); }
        print({ mode: 'fetch', files: source.items.length, fetched, existing, supplied });
        return 0;
    } catch (error) {
        // Never include exception text, URL, response body, input path or token.
        const code = error instanceof FileError ? error.code : 'invalid-source-or-local-io';
        const message = `SLACK_FILES_ERROR ${code}\n${code === 'usage' ? usage + '\n' : ''}`;
        stderr(token ? message.replaceAll(token, '[redacted]') : message);
        return 1;
    }
}
