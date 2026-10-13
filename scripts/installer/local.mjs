import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {operatorInstaller,developmentTarget,previewTarget} from '../base-onboarding/operator-installer.mjs';
import {commandAdapter as createCommandAdapter} from '../base-cli/cli/adapter.mjs';
import {deployment} from '../deployment/command.mjs';
import {readSettings} from '../base-onboarding/adapter-settings.mjs';
import {refuse} from '../base-cli/cli/errors.mjs';
import {assertBuildStateSafe} from '../persistence.mjs';
import {features} from './ui/seed.mjs';
import {localPrerequisites,existingIdentity} from '../local/prerequisites.mjs';
import {portability} from '../local/portability.mjs';
import {brandAccent,migrateAccent} from '../../src/brand/accent-colour.mjs';
export const lifecycle=operatorInstaller({database:'DB',features,async prepare({root,input,store}){
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
lifecycle.localPrerequisites=localPrerequisites;
export const {install}=lifecycle;
export const commandAdapter=createCommandAdapter(lifecycle,{
 product:'Nook',browserModule:'scripts/installer/ui/seed.mjs',setup:{manifestFile:'rer-setup.json'},
 input:{names:{email:'OWNER_EMAIL',name:'displayName'}},
 dev:developmentTarget,preview:previewTarget,verify:['pnpm',['run','verify:app']],
 deploy:deployment(lifecycle),portability,
 // rer verify's hosted-output check reads the declaration Nook's own deploy uses.
 deployDeclaration:'owner-deployment.json',
 // Local dev identity: the local-only Worker entry, the build output rer build scans for the dev layer,
 // and the kept end-to-end email-link test.
 devIdentity:{entry:'src/server.dev.ts',output:['dist'],emailLinkTest:'tests/readme-journey.mjs'},
 localOnlyKeys:['RER_DEV_ORIGIN','RER_DEV_IDENTITY'],
});
