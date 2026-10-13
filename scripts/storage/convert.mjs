import {getPlatformProxy} from 'wrangler';
import {convertLegacy} from './legacy-conversion.mjs';
const args=process.argv.slice(2),value=name=>args.find(a=>a.startsWith(name+'='))?.slice(name.length+1);
if(!args.includes('--paused'))throw Error('Stop the Worker and explicitly pass --paused; conversion never runs against an active app');
const persist=value('--persist');if(!persist)throw Error('--persist=PATH is required');
const platform=await getPlatformProxy({configPath:'wrangler.jsonc',persist:{path:persist}});
try{console.log(JSON.stringify(await convertLegacy({db:platform.env.DB,bucket:platform.env.FILES,stopAfter:value('--stop-after')}),null,2))}finally{await platform.dispose()}
