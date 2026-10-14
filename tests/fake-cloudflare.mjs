// Test-only network edge: replace Cloudflare's API and the deployed app with the
// account fake inside the rer process, and report what the account received.
import {writeFileSync} from 'node:fs';
import {fakeAccount} from './fake-account.mjs';
const account=fakeAccount();
globalThis.fetch=account.fetch;
process.env.CLOUDFLARE_ACCOUNT_ID=account.accountId;
process.env.CLOUDFLARE_API_TOKEN=account.token;
process.on('exit',()=>writeFileSync(process.env.NOOK_FAKE_CLOUDFLARE_REPORT,JSON.stringify(account.report())));
