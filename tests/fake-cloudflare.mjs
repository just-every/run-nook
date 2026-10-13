// Test-only network edge: replace Cloudflare's API with the account fake
// fixture inside the rer process, and report what the account received.
import {writeFileSync} from 'node:fs';
import {providerFixture} from './cloudflare-account.mjs';
const provider=providerFixture();
globalThis.fetch=provider.fetch;
process.env.CLOUDFLARE_ACCOUNT_ID=provider.accountId;
process.env.CLOUDFLARE_API_TOKEN=provider.token;
process.on('exit',()=>{
 const {state}=provider;
 const tables=state.databases.map(item=>item.db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(row=>row.name));
 writeFileSync(process.env.NOOK_FAKE_CLOUDFLARE_REPORT,JSON.stringify({databases:state.databases.map(item=>item.name),tables,secrets:state.secrets.map(item=>item.name),writes:state.writes.length,deployed:Boolean(state.version)}));
});
