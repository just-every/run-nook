import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {operatorInstaller,developmentTarget,previewTarget} from '@runeditrun/rer/operator-installer';
import {localInstaller} from '@runeditrun/rer/local-installer';
import {commandAdapter as createCommandAdapter} from '@runeditrun/rer/adapter';
import {deployment} from '../deployment/command.mjs';
import {readSettings} from '@runeditrun/rer/adapter-settings';
import {refuse} from '@runeditrun/rer/errors';
import {assertBuildStateSafe} from '../persistence.mjs';
import {features} from './ui/seed.mjs';
import {localPrerequisites,existingIdentity} from '../local/prerequisites.mjs';
import {portability} from '../local/portability.mjs';
import {brandAccent,migrateAccent} from '../../src/brand/accent-colour.mjs';
const operator=operatorInstaller({database:'DB',features,async prepare({root,input,store}){
 try{assertBuildStateSafe(root)}catch{throw refuse('Preserve the existing local state and resolve its placement before setup.')}
 let owner;try{owner=await existingIdentity(root)}catch{store.report('Preserve the stopped identity store and follow OPERATIONS.md offline recovery before setup.');throw refuse('Preserve the stopped identity store and follow the documented explicit recovery before setup.')}
 const saved=(await readSettings(root,{file:'.dev.vars'})).values;
 if(owner?.length&&!owner.includes((input.OWNER_EMAIL??saved.OWNER_EMAIL??'').toLowerCase())){store.report('Use the retained owner mailbox; setup cannot replace the existing identity authority.');throw refuse('Preserve the stopped identity store and follow the documented explicit recovery before setup.')}
 if(saved.OWNER_EMAIL&&input.OWNER_EMAIL&&saved.OWNER_EMAIL.toLowerCase()!==input.OWNER_EMAIL.toLowerCase()){
  store.report('The existing owner must be kept. Use the existing mailbox, or follow OPERATIONS.md offline identity recovery.');throw refuse('Preserve the stopped identity store and follow the documented explicit recovery before setup.');
 }
 // Export and import call prepare without branding answers; preserve the saved source bytes.
 if(input.WORKSPACE_NAME===undefined&&input.PRIMARY_COLOR===undefined)return;
 await writeFile(join(root,'src/branding.json'),JSON.stringify({name:saved.WORKSPACE_NAME??input.WORKSPACE_NAME??'Nook',primaryColor:migrateAccent(saved.PRIMARY_COLOR??input.PRIMARY_COLOR??brandAccent)},null,2)+'\n');
}});
// Nook keeps its migrations in migrations/, rather than Base's migrations/core/.
// Read the source config so a dev restart applies newly acquired migrations too.
export const lifecycle={...operator,...localInstaller({...operator.hooks,
 migrate:({demo})=>['pnpm',['exec','wrangler','d1','migrations','apply','DB','--local','--persist-to',demo?.state??'.wrangler/state','--config','wrangler.jsonc']],
}),install:operator.install};
lifecycle.localPrerequisites=localPrerequisites;
export const {install}=lifecycle;
export const commandAdapter=createCommandAdapter(lifecycle,{
 product:'Nook',browserModule:'scripts/installer/ui/seed.mjs',setup:{manifestFile:'scripts/installer/local-setup.json'},
 input:{names:{email:'OWNER_EMAIL',name:'displayName'}},
 dev:developmentTarget,preview:previewTarget,verify:['pnpm',['run','verify:app']],
 deploy:Object.assign(deployment(lifecycle),{declaration:'owner-deployment.json'}),portability,
 // rer verify's hosted-output check reads the declaration Nook's own deploy uses.
 deployDeclaration:'owner-deployment.json',
 site:{entry:'src/site/pages.tsx',output:'dist/site',declaration:'deploy-site.json',config:'vite.site.config.ts'},
 publicPages:['/','/signin','/docs','/docs/install'],
 // Local dev identity: the local-only Worker entry, the build output rer build scans for the dev layer,
 // and the kept end-to-end email-link test.
 devIdentity:{entry:'src/server.dev.ts',output:['dist'],emailLinkTest:'tests/readme-journey.mjs'},
 localOnlyKeys:['RER_DEV_ORIGIN','RER_DEV_IDENTITY'],
});
