import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function findRepoRoot(startDir: string): string {
  let currentDir = startDir;

  while (true) {
    if (existsSync(resolve(currentDir, '.git'))) {
      return currentDir;
    }

    const parentDir = resolve(currentDir, '..');
    if (parentDir === currentDir) {
      return startDir;
    }

    currentDir = parentDir;
  }
}

function parseEnvLine(line: string): [string, string] | null {
  const trimmed = line.replace(/^\uFEFF/u, '').trim();
  if (!trimmed || trimmed.startsWith('#')) {
    return null;
  }

  const withoutExport = trimmed.startsWith('export ') ? trimmed.slice('export '.length).trim() : trimmed;
  const equalsIndex = withoutExport.indexOf('=');
  if (equalsIndex <= 0) {
    return null;
  }

  const key = withoutExport.slice(0, equalsIndex).trim();
  if (!key) {
    return null;
  }

  let value = withoutExport.slice(equalsIndex + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }

  return [key, value];
}

function loadEnvFile(filePath: string): void {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/u)) {
    const parsed = parseEnvLine(line);
    if (!parsed) {
      continue;
    }

    const [key, value] = parsed;
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export function loadApiEnvironment(): void {
  const cwd = process.cwd();

  for (const envPath of [resolve(cwd, '.env'), resolve(cwd, '.env.local')]) {
    loadEnvFile(envPath);
  }
}
