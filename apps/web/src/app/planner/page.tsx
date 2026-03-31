import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PlannerClient from './planner-client';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

function readEnvValue(name: string) {
  const repoRoot = path.resolve(currentDir, '../../../../..');
  const envFiles = ['.env.local', '.env'];

  for (const filename of envFiles) {
    const fullPath = path.join(repoRoot, filename);
    if (!fs.existsSync(fullPath)) continue;

    const content = fs.readFileSync(fullPath, 'utf8');
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#') || !line.startsWith(`${name}=`)) continue;
      return line.slice(name.length + 1).trim().replace(/^['"]|['"]$/g, '');
    }
  }

  return '';
}

export default function PlannerPage() {
  const googleMapsKey =
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    readEnvValue('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY') ||
    readEnvValue('GOOGLE_MAPS_API_KEY') ||
    '';

  return <PlannerClient googleMapsKey={googleMapsKey} />;
}
