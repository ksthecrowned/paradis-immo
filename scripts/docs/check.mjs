import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const skillsDir = path.join(root, '.skills');
const errors = [];
const today = new Date();
const maxAgeDays = 90;
const requiredFields = ['status', 'last-verified', 'owner', 'scope', 'audience'];

async function markdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await markdownFiles(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }
  return files;
}

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return null;
  const fields = new Map();
  for (const line of match[1].split(/\r?\n/)) {
    const field = line.match(/^([a-z][a-z-]*):\s*(.+)$/);
    if (field) fields.set(field[1], field[2].trim());
  }
  return fields;
}

async function checkSkill(file) {
  const content = await readFile(file, 'utf8');
  const relative = path.relative(root, file);
  const frontmatter = parseFrontmatter(content);

  if (!frontmatter) {
    errors.push(`${relative}: missing YAML frontmatter`);
    return;
  }

  for (const field of requiredFields) {
    if (!frontmatter.has(field)) errors.push(`${relative}: missing "${field}"`);
  }

  const status = frontmatter.get('status');
  if (!['stable', 'draft', 'deprecated'].includes(status)) {
    errors.push(`${relative}: invalid status "${status ?? ''}"`);
  }

  const verified = frontmatter.get('last-verified');
  if (!verified || !/^\d{4}-\d{2}-\d{2}$/.test(verified)) {
    errors.push(`${relative}: last-verified must use YYYY-MM-DD`);
  } else {
    const verifiedDate = new Date(`${verified}T00:00:00Z`);
    if (Number.isNaN(verifiedDate.valueOf())) {
      errors.push(`${relative}: invalid last-verified date "${verified}"`);
    } else if (status === 'stable') {
      const ageDays = Math.floor((today - verifiedDate) / 86_400_000);
      if (ageDays < 0) errors.push(`${relative}: last-verified is in the future`);
      else if (ageDays > maxAgeDays) {
        errors.push(`${relative}: stable skill is ${ageDays} days old (max ${maxAgeDays})`);
      }
    }
  }

  const withoutCode = content.replace(/```[\s\S]*?```/g, '');
  for (const match of withoutCode.matchAll(/\]\(([^)]+)\)/g)) {
    const target = match[1].trim().replace(/^<|>$/g, '');
    if (/^(?:https?:\/\/|mailto:|#)/i.test(target)) continue;
    const localTarget = decodeURIComponent(target.split(/[?#]/, 1)[0]);
    if (!localTarget) continue;
    const resolved = path.resolve(path.dirname(file), localTarget);
    try {
      await stat(resolved);
    } catch {
      errors.push(`${relative}: broken link "${target}"`);
    }
  }
}

const skills = (await markdownFiles(skillsDir)).filter(
  (file) => path.basename(file) !== 'template.md',
);

for (const skill of skills) await checkSkill(skill);

if (errors.length > 0) {
  console.error(`Documentation check failed (${errors.length} issue${errors.length === 1 ? '' : 's'}):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Documentation check passed: ${skills.length} skills checked (frontmatter, freshness, links).`);
}
