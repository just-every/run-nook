import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const execute=promisify(execFile);

// Package-mode commands, including the guided installer, need the checkout's
// pinned dependency tree before they can start. Keep fresh installs independent.
export async function installDependencies(root,env=process.env) {
 try {
  await execute('pnpm',['install','--frozen-lockfile'],{cwd:root,env:{...env,CI:'true'},timeout:20*60_000,maxBuffer:8*1024*1024});
 } catch(error) {
  throw Error(`Locked dependency installation failed (exit ${error.code??'unknown'}); command output withheld.`);
 }
}
