// Test-only stand-in for the owner's Cloudflare account and the deployed Nook:
// the account fake fixture plus the owner claim a deployed Nook answers with
// its setup token (303 once, then 409 already_initialized).
import {providerFixture} from './cloudflare-account.mjs';
export function fakeAccount(){
 const provider=providerFixture(),claims=[];
 const fetch=async(input,init={})=>{
  const url=new URL(input);
  if(!url.hostname.endsWith('.workers.dev')||url.pathname!=='/auth/bootstrap')return provider.fetch(input,init);
  const live=provider.state.secrets.find(item=>item.name==='SETUP_TOKEN');
  if(!live||JSON.parse(init.body).token!==live.value)return Response.json({error:'invalid_setup_token'},{status:403});
  claims.push(url.origin);
  return claims.length>1?Response.json({error:'already_initialized'},{status:409}):new Response(null,{status:303});
 };
 const report=()=>{
  const {state}=provider;
  return {databases:state.databases.map(item=>item.name),tables:state.databases.map(item=>item.db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(row=>row.name)),secrets:state.secrets.map(item=>item.name),claims:claims.length,requests:state.calls.length,writes:state.writes.length,deployed:Boolean(state.version)};
 };
 return {accountId:provider.accountId,token:provider.token,fetch,report};
}
