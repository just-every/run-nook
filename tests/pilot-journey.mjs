import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {chromium} from '@playwright/test';
import {pilotInstallation,roundTrip} from './pilot/runtime.mjs';
import {pilotBrowser} from './pilot/browser.mjs';

const root=resolve(import.meta.dirname,'..');
const destination=resolve(process.env.NOOK_PILOT_EVIDENCE??join(root,'evidence/nook-1/pilot'));
await mkdir(destination,{recursive:true});
// Each width moves in on its own fresh installation, side by side: the full
// realistic apply dominates the journey, and the widths share no state. CI runs
// one width per job (`--width 1440`, `--width 390`); the restore runs with 1440.
const requested=process.argv.flatMap((arg,i,all)=>arg==='--width'?[Number(all[i+1])]:[]);
const widths=requested.length?requested:[1440,390];
if(widths.some(width=>![1440,390].includes(width)))throw Error('Pilot widths are 1440 and 390');
async function journey(browser,width){
 const installation=await pilotInstallation(root);
 try{
  console.log(`PILOT two-session browser journey at ${width}`);
  const check=await pilotBrowser({browser,installation,width,destination});
  if(width!==1440)return {check};
  console.log('PILOT stopped export/reset/import/reexport');
  return {check,recovery:await roundTrip(installation)};
 }finally{await installation.close();}
}
const browser=await chromium.launch({headless:true});
try{
 const outcomes=await Promise.allSettled(widths.map(width=>journey(browser,width)));
 const failed=outcomes.find(outcome=>outcome.status==='rejected');if(failed)throw failed.reason;
 const results=outcomes.map(outcome=>outcome.value),recovery=results.find(result=>result.recovery)?.recovery;
 await writeFile(join(destination,`pilot-results-${widths.join('-')}.json`),JSON.stringify({status:'passed',fixture:'Realistic synthetic fixture shaped from Slack’s documentation; no real Slack export or account used',parityClaim:false,runtime:'Ordinary rer dev --login with actual local Worker, D1 and R2',checks:results.map(result=>result.check),recovery,credentialsCaptured:false,resourcesClosed:true},null,2)+'\n');
 console.log(`PILOT-JOURNEY passed at ${widths.join(' and ')}: two real outbox sessions, private files, reviewed Slack history, audience revocation, no imported activity, guarded undo${recovery?' and identical rer restore':''}.`);
}finally{await browser.close();}
