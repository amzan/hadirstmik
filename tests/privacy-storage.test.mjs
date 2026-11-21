import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readLegacy, inspectLegacy } from '../src/utils/legacyStorage.mjs';
import { privacyCheck } from '../scripts/privacy-check.mjs';

test('seed upgrades and malformed legacy storage never write or delete browser data', () => {
  const values = new Map([['stmik_users_v1', '[{"id":"synthetic"}]'], ['stmik_db_seed_version', 'old-version'], ['stmik_db_snapshots_v1', '[{"id":"snapshot-test"}]']]);
  const storage = { getItem: key => values.get(key) ?? null, setItem: () => assert.fail('write'), removeItem: () => assert.fail('remove'), clear: () => assert.fail('clear') };
  const before = [...values]; inspectLegacy(storage); readLegacy(storage, 'stmik_users_v1'); assert.deepEqual([...values], before);
  assert.equal(readLegacy({ getItem: () => 'invalid JSON' }, 'test'), null);
});
test('privacy gate detects public backup, private imports and bundled populated seed', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hadir-privacy-'));
  try {
    await mkdir(join(root, 'public')); await mkdir(join(root, 'src'));
    await writeFile(join(root, 'public', 'data.json'), '{"users":[{"email":"synthetic@example.test"}]}');
    await writeFile(join(root, 'src', 'initialData.ts'), "import backup from '../private/data.json'; export const INITIAL_USERS = [{ id:'synthetic' }];");
    const codes = (await privacyCheck(root)).map(i => i.code); assert(codes.includes('PRIVATE_DATA_SOURCE')); assert(codes.includes('PRIVATE_IMPORT')); assert(codes.includes('BUNDLED_PERSONAL_SEED'));
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('current source has no sensitive public files or personal seed import', async () => assert.deepEqual(await privacyCheck(), []));
test('application bootstrap and context do not mutate legacy storage', async () => {
  for (const file of ['src/App.tsx', 'src/context/AttendanceContext.tsx']) {
    const source = await readFile(file, 'utf8'); assert(!/localStorage\.(clear|setItem|removeItem)/.test(source)); assert(!/ensureLatestDatabaseSeed/.test(source));
  }
});
