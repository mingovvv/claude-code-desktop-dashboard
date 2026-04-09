import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

function resolveCommand(command) {
  if (process.platform === 'win32' && command === 'npm') {
    return 'cmd.exe';
  }
  return command;
}

function run(command, args) {
  if (process.platform === 'win32' && command === 'npm') {
    execFileSync(resolveCommand(command), ['/d', '/s', '/c', 'npm', ...args], { stdio: 'inherit' });
    return;
  }
  execFileSync(resolveCommand(command), args, { stdio: 'inherit' });
}

function readVersion() {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  return pkg.version;
}

function main() {
  const bump = process.argv[2] ?? 'patch';
  const allowedBumps = new Set(['patch', 'minor', 'major']);
  if (!allowedBumps.has(bump)) {
    console.error(`Invalid release type: ${bump}`);
    process.exit(1);
  }

  const status = execFileSync(resolveCommand('git'), ['status', '--porcelain'], { encoding: 'utf8' }).trim();

  if (!status) {
    console.error('No changes to release.');
    process.exit(1);
  }

  run('npm', ['version', bump, '--no-git-tag-version']);

  const version = readVersion();
  const message = `release: v${version}`;

  run('git', ['add', '.']);
  run('git', ['commit', '-m', message]);
  run('git', ['push', 'origin', 'HEAD:main']);

  console.log(`Released ${version}. GitHub Actions will build and upload assets.`);
}

main();
