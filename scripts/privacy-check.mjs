import { readdir, readFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

async function files(root) {
  try { return (await Promise.all((await readdir(root, { withFileTypes: true })).map(e => e.isDirectory() ? files(resolve(root, e.name)) : resolve(root, e.name)))).flat(); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}
export async function privacyCheck(root = '.', { artifacts = false } = {}) {
  root = resolve(root); const issues = [];
  for (const file of [...await files(resolve(root, 'public')), ...await files(resolve(root, 'src')), ...await files(resolve(root,'shared'))]) {
    const name = relative(root, file), content = await readFile(file, 'utf8');
    if (/backup.*\.json$/i.test(name) || (name.endsWith('.json') && /"(?:password|studentNim|sessionToken|students|users)"\s*:/.test(content))) issues.push({ file: name, code: 'PRIVATE_DATA_SOURCE' });
    if (/\b(?:import|export)\s[\s\S]*?\bfrom\s*['"][^'"\n]*(?:private\/|master_database|raw_backup)/.test(content) || /import\s*\(\s*['"][^'"]*private\//.test(content)) issues.push({ file: name, code: 'PRIVATE_IMPORT' });
    if (file.endsWith('initialData.ts') && /export const INITIAL_\w+[^=]*=\s*\[\s*\{/.test(content)) issues.push({ file: name, code: 'BUNDLED_PERSONAL_SEED' });
  }
  if (artifacts) {
    const built = await files(resolve(root, 'dist'));
    if (!built.length) issues.push({ file: 'dist', code: 'BUILD_MISSING' });
    for (const file of built) {
      if (/\.(json|map|sql)$/.test(file) || /backup|private|\.env/i.test(relative(resolve(root, 'dist'), file))) issues.push({ file: relative(root, file), code: 'PRIVATE_ARTIFACT' });
    }
    const markers = new Set();
    for (const file of await files(resolve(root, 'private/legacy'))) {
      if (!file.endsWith('.json')) continue;
      const backup = JSON.parse(await readFile(file, 'utf8')), data = backup.data || backup;
      for (const group of [data.users, data.students]) for (const row of group || []) for (const key of ['email','phone','password']) if (typeof row[key] === 'string' && row[key].length >= 6) markers.add(row[key]);
    }
    for (const file of built.filter(f => /\.(js|html|css)$/.test(f))) {
      const content = await readFile(file, 'utf8');
      if ([...markers].some(marker => content.includes(marker))) issues.push({ file: relative(root, file), code: 'PRIVATE_VALUE_IN_BUILD' });
    }
  }
  return issues;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const issues = await privacyCheck('.', { artifacts: process.argv.includes('--artifacts') });
  for (const issue of issues) console.error(`${issue.code}: ${issue.file}`);
  console.log(`Privacy check: ${issues.length ? 'FAIL' : 'PASS'}`); if (issues.length) process.exitCode = 1;
}
