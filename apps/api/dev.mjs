import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const entryFile = path.resolve('dist/apps/api/src/main.js');
let runtime = null;

function stopRuntime() {
  if (runtime?.pid) {
    runtime.kill('SIGTERM');
  }
  runtime = null;
}

function startRuntime() {
  if (!fs.existsSync(entryFile)) return;
  stopRuntime();

  runtime = spawn('node', [entryFile], {
    stdio: 'inherit',
    shell: true,
  });
}

const builder = spawn('npx', ['nest', 'build', '--watch'], {
  stdio: 'inherit',
  shell: true,
});

const watchDir = path.dirname(entryFile);
fs.mkdirSync(watchDir, { recursive: true });

const watcher = fs.watch(watchDir, { recursive: true }, (_eventType, filename) => {
  if (!filename?.endsWith('main.js')) return;
  setTimeout(startRuntime, 150);
});

builder.on('exit', (code) => {
  watcher.close();
  stopRuntime();
  process.exit(code ?? 0);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    watcher.close();
    stopRuntime();
    if (builder.pid) builder.kill(signal);
  });
}
