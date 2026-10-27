import {spawn} from 'node:child_process';
import {createWriteStream} from 'node:fs';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {finished} from 'node:stream/promises';

// Each command owns its runtime/temporary database. Run at most two independent
// journeys together so real-clock waits overlap without adding hosted runners.
const commands = process.argv.slice(2);
if (!commands.length || commands.length > 2 || commands.some(command => !command.trim())) {
  throw new Error('Usage: node scripts/ci-stage.mjs <command> [independent-command]');
}
const directory = await mkdtemp(join(tmpdir(), 'nook-ci-stage-'));
const children = new Set();
let interrupted;
const forward = signal => {
  interrupted = signal;
  for (const child of children) {
    try { process.kill(-child.pid, signal); } catch (error) {
      if (error.code !== 'ESRCH') throw error;
    }
  }
};
const term = () => forward('SIGTERM'), int = () => forward('SIGINT');
process.on('SIGTERM', term);
process.on('SIGINT', int);
try {
  const results = await Promise.all(commands.map(async (command, index) => {
    const start = performance.now(), path = join(directory, `${index}.log`);
    const output = createWriteStream(path);
    const child = spawn('bash', ['-euo', 'pipefail', '-c', command], {
      detached: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    children.add(child);
    child.stdout.pipe(output, {end: false});
    child.stderr.pipe(output, {end: false});
    const result = await new Promise(resolve => {
      child.once('error', error => resolve({code: 1, error}));
      child.once('close', (code, signal) => resolve({code: code ?? 1, signal}));
    });
    children.delete(child);
    output.end();
    await finished(output);
    // Keep each journey's output intact, including every failure. A failed
    // peer never prevents the other journey from completing its assertions.
    console.log(`::group::${command}`);
    process.stdout.write(await readFile(path));
    if (result.error) console.error(result.error);
    console.log(`\nCI journey ${index + 1}: exit=${result.code} signal=${result.signal ?? 'none'} seconds=${((performance.now() - start) / 1000).toFixed(2)}`);
    console.log('::endgroup::');
    return result.code;
  }));
  process.exitCode = interrupted ? 1 : results.some(code => code !== 0) ? 1 : 0;
} finally {
  process.off('SIGTERM', term);
  process.off('SIGINT', int);
  await rm(directory, {recursive: true, force: true});
}
