import assert from 'node:assert/strict';
import {platformSource} from './ts-source.mjs';

/** Use the current consumer's public setup/deployment boundary over produced bytes. */
export async function setupProjectionProof(platformRoot,setup,spec) {
 const source=platformSource(platformRoot);
 try {
  const {parseSetupManifestBytes}=await source.load('src/editions/setup-manifest.ts');
  const {validateManifestDeployment,validateManifestConfig}=await source.load('src/editions/setup-manifest-input.ts');
  const selected=parseSetupManifestBytes(setup.bytes.toString('utf8'));
  validateManifestDeployment(selected,spec);
  const publicValues=Object.fromEntries(selected.fields.filter(field=>field.kind!=='secret'&&field.default!==undefined).map(field=>[field.name,field.default]));
  publicValues.OWNER_EMAIL='projection-owner@example.test';
  assert.deepEqual(validateManifestConfig(selected,publicValues,spec),publicValues);
  assert.throws(()=>validateManifestConfig(selected,{...publicValues,SESSION_SECRET:'test-value'},spec),/public field/);
  console.log('PASS actual platform setup bytes/deployment projection and public-secret separation; no service admission claimed');
 }finally{source.close()}
}
