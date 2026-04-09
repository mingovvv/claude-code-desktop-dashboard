import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const RELEASE_GIT_NAME = 'mingovvv';
const RELEASE_GIT_EMAIL = 'mingovvv@gmail.com';

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

function runGit(args) {
  const token = process.env.GITHUB_TOKEN?.trim() || readLocalToken();
  const gitArgs = [];

  if (token) {
    const basic = Buffer.from(`x-access-token:${token}`, 'ascii').toString('base64');
    gitArgs.push('-c', `http.https://github.com/.extraheader=AUTHORIZATION: basic ${basic}`);
  }

  gitArgs.push(...args);
  execFileSync(resolveCommand('git'), gitArgs, { stdio: 'inherit' });
}

function configureLocalGitIdentity() {
  execFileSync(resolveCommand('git'), ['config', '--local', 'user.name', RELEASE_GIT_NAME], { stdio: 'inherit' });
  execFileSync(resolveCommand('git'), ['config', '--local', 'user.email', RELEASE_GIT_EMAIL], { stdio: 'inherit' });
}

function readVersion() {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  return pkg.version;
}

function readLocalToken() {
  const tokenFile = new URL('../.release-token', import.meta.url);
  if (!existsSync(tokenFile)) {
    return '';
  }

  return readFileSync(tokenFile, 'utf8').trim();
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
  configureLocalGitIdentity();

  const version = readVersion();
  const message = `release: v${version}`;

  run('git', ['add', '.']);
  run('git', ['commit', '-m', message]);
  runGit(['push', 'origin', 'HEAD:main']);

  console.log(`Released ${version}. GitHub Actions will build and upload assets.`);
}

main();
