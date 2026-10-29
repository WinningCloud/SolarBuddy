#!/usr/bin/env node
// Local development runner.
//   node scripts/dev.mjs            start sim, api and web together
//   node scripts/dev.mjs sim        start only the sim service
//   node scripts/dev.mjs setup-sim  create sim/.venv and install Python requirements
//   node scripts/dev.mjs test-sim   run the sim pytest suite
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const simDir = path.join(root, 'sim');
const isWin = process.platform === 'win32';
const venvPython = isWin
  ? path.join(simDir, '.venv', 'Scripts', 'python.exe')
  : path.join(simDir, '.venv', 'bin', 'python');

function works(cmd) {
  const r = spawnSync(cmd, ['--version'], { encoding: 'utf8' });
  return r.status === 0;
}

function findPython({ preferVenv = true } = {}) {
  const candidates = [
    process.env.PYTHON,
    preferVenv && existsSync(venvPython) ? venvPython : null,
    ...(isWin ? ['py', 'python'] : ['python3', 'python']),
  ].filter(Boolean);
  return candidates.find(works) ?? null;
}

const colours = { sim: '\x1b[33m', api: '\x1b[36m', web: '\x1b[35m' };
const reset = '\x1b[0m';
const children = [];

function run(name, command, args, cwd) {
  const child = spawn(command, args, { cwd, shell: false, env: process.env });
  const prefix = `${colours[name] ?? ''}[${name}]${reset} `;
  const pipe = (stream, out) => {
    let buffer = '';
    stream.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      for (const line of lines) out.write(prefix + line + '\n');
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on('exit', (code) => {
    process.stdout.write(`${prefix}exited with code ${code}\n`);
  });
  children.push(child);
  return child;
}

function runNpm(name, workspace) {
  // npm is a .cmd shim on Windows, so it has to go through the shell there.
  const child = spawn(`npm run dev -w ${workspace}`, { cwd: root, shell: true, env: process.env });
  const prefix = `${colours[name] ?? ''}[${name}]${reset} `;
  child.stdout.on('data', (c) => process.stdout.write(prefix + c.toString()));
  child.stderr.on('data', (c) => process.stderr.write(prefix + c.toString()));
  child.on('exit', (code) => process.stdout.write(`${prefix}exited with code ${code}\n`));
  children.push(child);
}

function startSim() {
  const python = findPython();
  if (!python) {
    console.error('No Python interpreter found. Install Python 3.11+ or set PYTHON=...');
    process.exit(1);
  }
  if (python !== venvPython && !process.env.PYTHON) {
    console.warn('[sim] sim/.venv not found, using system Python. Run `npm run setup:sim` first.');
  }
  run(
    'sim',
    python,
    ['-m', 'uvicorn', 'app.main:app', '--port', process.env.SIM_PORT ?? '8000', '--reload'],
    simDir,
  );
}

function shutdown() {
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

const mode = process.argv[2] ?? 'all';

if (mode === 'setup-sim') {
  const python = findPython({ preferVenv: false });
  if (!python) {
    console.error('No Python interpreter found. Install Python 3.11+.');
    process.exit(1);
  }
  const steps = [
    [python, ['-m', 'venv', '.venv']],
    [venvPython, ['-m', 'pip', 'install', '--upgrade', 'pip']],
    [venvPython, ['-m', 'pip', 'install', '-r', 'requirements.txt']],
  ];
  for (const [cmd, args] of steps) {
    const r = spawnSync(cmd, args, { cwd: simDir, stdio: 'inherit' });
    if (r.status !== 0) process.exit(r.status ?? 1);
  }
  console.log('sim environment ready.');
} else if (mode === 'test-sim') {
  const python = findPython();
  const r = spawnSync(python, ['-m', 'pytest', '-q'], { cwd: simDir, stdio: 'inherit' });
  process.exit(r.status ?? 1);
} else if (mode === 'sim') {
  startSim();
} else {
  startSim();
  runNpm('api', 'api');
  runNpm('web', 'web');
}
