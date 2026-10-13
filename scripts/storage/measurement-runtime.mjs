// The built Worker on local D1/R2/DO, started and stopped the same way the
// runtime tests do. Measurement bindings are synthetic and stay stable.
import {spawn} from 'node:child_process';
import {createWriteStream} from 'node:fs';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const wrangler = 'node_modules/wrangler/bin/wrangler.js';
const config = 'dist/server/wrangler.json';

export function measurementBindings(origin) {
 return {AUTH_ORIGIN:origin,RER_DEV_ORIGIN:origin,AUTH_LOCAL:'true',OWNER_EMAIL:'scale-owner@example.test',SETUP_TOKEN:'synthetic-scale-setup-token-measurement-fixture',SESSION_SECRET:'synthetic-scale-session-secret-long-enough',MAIL_PROVIDER:'development',MAIL_FROM:'scale@example.test'};
}

function run(args, env) {
 return new Promise((ok, bad) => {
  const child = spawn(process.execPath, [wrangler, ...args], {env, stdio:['ignore','pipe','pipe']});
  let output = '';
  child.stdout.on('data', chunk => output += chunk);
  child.stderr.on('data', chunk => output += chunk);
  child.once('error', bad);
  child.once('exit', code => code === 0 ? ok(output) : bad(Error(`wrangler ${args[0]} failed: ${output.slice(-2000)}`)));
 });
}

export function measurementRuntime({state, origin}) {
 const port = Number(new URL(origin).port), env = {...process.env, WRANGLER_SEND_METRICS:'false', CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV:'true', CLOUDFLARE_INCLUDE_PROCESS_ENV:'false'};
 let worker, output = '';
 return {
  migrate: () => run(['d1','migrations','apply','DB','--local','--config',config,'--persist-to',state], env),
  async start() {
   const vars = resolve(state, 'measurement.vars');
   await writeFile(vars, Object.entries(measurementBindings(origin)).map(([key, value]) => `${key}=${value}\n`).join(''), {mode:0o600});
   output = '';
   worker = spawn(process.execPath, [wrangler,'dev','--env-file',vars,'--local','--config',config,'--persist-to',state,'--ip','127.0.0.1','--port',String(port),'--inspector-port',String(port + 1),'--show-interactive-dev-session=false'], {env, stdio:['ignore','pipe','pipe']});
   // The complete Worker log stays in the private state directory for diagnosis.
   const log = createWriteStream(resolve(state, 'worker.log'), {flags:'a', mode:0o600});
   for (const stream of [worker.stdout, worker.stderr]) stream.on('data', chunk => { log.write(chunk); output = (output + chunk).slice(-20000); });
   worker.once('exit', () => log.end());
   for (let i = 0; i < 240; i++) {
    if (worker.exitCode !== null) throw Error('Worker exited during startup: ' + output);
    try { if ((await fetch(origin + '/health')).ok) return; } catch {}
    await new Promise(ok => setTimeout(ok, 250));
   }
   throw Error('Worker did not become healthy: ' + output);
  },
  async stop() {
   if (!worker || worker.exitCode !== null || worker.signalCode) return;
   const exited = new Promise(ok => worker.once('exit', ok));
   worker.kill('SIGTERM');
   await Promise.race([exited, new Promise(ok => setTimeout(ok, 10000))]);
   if (worker.exitCode === null && !worker.signalCode) { worker.kill('SIGKILL'); await exited; }
  },
  log: () => output,
 };
}
