import {readdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';

// The measured portability file takes about 8.5 minutes by itself. Give it a
// runner, and avoid making the 120-second hosted export/restore test compete
// with three other files on one runner. Every other/new file stays in
// the second group; both groups keep the existing file concurrency of two.
export function unitGroups(files) {
  const all = files.filter(name => name.endsWith('.test.mjs')).sort();
  const portability = 'team-portability.test.mjs';
  if (!all.includes(portability)) throw new Error('Missing portability unit file');
  return {
    portability: all.filter(name => name === portability),
    remaining: all.filter(name => name !== portability),
  };
}

const group = process.argv[2];
if (!['portability', 'remaining'].includes(group) || process.argv.slice(3).some(arg => arg !== '--list')) {
  throw new Error('Usage: node scripts/ci-unit.mjs portability|remaining [--list]');
}
const files = unitGroups(await readdir('tests'))[group].map(name => `tests/${name}`);
if (!files.length) throw new Error('Empty unit group');
if (process.argv.includes('--list')) {
  console.log(JSON.stringify(files));
} else {
  const child = spawn(process.execPath, ['--test', '--test-concurrency=2', ...files], {
    detached: true, stdio: 'inherit',
  });
  const forward = signal => {
    try { process.kill(-child.pid, signal); } catch (error) {
      if (error.code !== 'ESRCH') throw error;
    }
  };
  process.on('SIGTERM', () => forward('SIGTERM'));
  process.on('SIGINT', () => forward('SIGINT'));
  child.once('error', error => { console.error(error); process.exitCode = 1; });
  child.once('close', code => { process.exitCode = code ?? 1; });
}
