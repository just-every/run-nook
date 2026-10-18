import {readFileSync,readdirSync} from 'node:fs';
import {migrationReplay} from '../src/base/modules/portability/migration-history.mjs';

// The local restore runner supplies a replay so exact migration seed rows can be replaced.
export const migrationHistory=policy=>async()=>migrationReplay(readdirSync(new URL('../migrations/',import.meta.url)).filter(name=>name.endsWith('.sql')).sort().map(name=>({name,statements:[readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8')]})),policy);
