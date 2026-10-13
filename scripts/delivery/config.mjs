import {readFile} from 'node:fs/promises';
import {generateManagedWorkflow} from './base/generators/managed.mjs';

export async function packagingPolicy() {
 return JSON.parse(await readFile(new URL('./base/packaging.json',import.meta.url),'utf8'));
}
export async function managedPolicy() {
 const config=await packagingPolicy();
 generateManagedWorkflow(config.managed);
 return config;
}
