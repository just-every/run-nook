import {readFile} from 'node:fs/promises';
import {generateManagedWorkflow} from './base/generators/managed.mjs';
import {managedBuild} from './managed-build.mjs';

export async function packagingPolicy() {
 return managedBuild(JSON.parse(await readFile(new URL('./base/packaging.json',import.meta.url),'utf8')));
}
export async function managedPolicy() {
 const config=await packagingPolicy();
 generateManagedWorkflow(config.managed);
 return config;
}
