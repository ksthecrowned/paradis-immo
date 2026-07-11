/**
 * Copies Paradis Immo logo into mobile assets (and resources/) if found locally.
 * Run from repo root or apps/mobile: pnpm --filter mobile setup:logo
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(scriptDir, '..');
const repoRoot = join(mobileRoot, '..', '..');
const mobileAssets = join(mobileRoot, 'assets');
const resourcesDir = join(repoRoot, 'resources');
const destMobile = join(mobileAssets, 'logo-paradis-immo.png');
const destResources = join(resourcesDir, 'logo-paradis-immo.png');

const sources = [
  join(resourcesDir, 'logo-paradis-immo.png'),
  'C:\\Users\\pc\\Downloads\\logo-paradis-immo.png',
  join(process.env.USERPROFILE ?? '', 'Downloads', 'logo-paradis-immo.png'),
  join(process.env.HOME ?? '', 'Downloads', 'logo-paradis-immo.png'),
];

mkdirSync(mobileAssets, { recursive: true });

let copied = false;
for (const src of sources) {
  if (!src || !existsSync(src)) continue;
  copyFileSync(src, destMobile);
  copyFileSync(src, destResources);
  console.log(`✓ Logo copied from ${src}`);
  console.log(`  → ${destMobile}`);
  copied = true;
  break;
}

if (!copied) {
  console.warn(
    'Logo not found. Place logo-paradis-immo.png in Downloads or resources/, then re-run.',
  );
  process.exit(1);
}
