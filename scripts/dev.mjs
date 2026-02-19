import { spawn } from 'node:child_process';

const commands = [
  { name: 'api', command: ['npm', 'run', 'dev:api'] },
  { name: 'web', command: ['npm', 'run', 'dev:web'] },
];

const children = commands.map(({ name, command }) => {
  const child = spawn(command[0], command.slice(1), {
    stdio: 'inherit',
    shell: true,
  });

  child.on('exit', (code) => {
    if (code && code !== 0) {
      process.exitCode = code;
      for (const sibling of children) {
        if (sibling.pid && sibling.pid !== child.pid) {
          sibling.kill('SIGTERM');
        }
      }
    }
  });

  return child;
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    for (const child of children) {
      if (child.pid) {
        child.kill(signal);
      }
    }
  });
}
