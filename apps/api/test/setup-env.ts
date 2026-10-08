import * as fs from 'node:fs';
import * as path from 'node:path';

// Minimal .env loader for e2e tests (avoids requiring dotenv in test deps).
// Mirrors dotenv's parsing closely enough for this repo: it skips comments,
// only fills vars that are not already set, and strips matching surrounding
// quotes — without that last step a `DATABASE_URL="postgres://…"` line is
// passed verbatim to Prisma, which then fails to resolve the host.
function loadEnv() {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnv();