import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

await mkdir('.cache/report-snapshot-test', { recursive: true });
const entry = resolve('.cache/report-snapshot-test/snapshot.mjs');
await build({ entryPoints: ['src/utils/reportSnapshot.ts'], outfile: entry, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
const { fetchReportSnapshot, reportTimestamp } = await import(pathToFileURL(entry).href);

test('every export requests a new no-store snapshot; failures never reuse the last successful report', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/v1/reports/snapshot');
    assert.equal(options.cache, 'no-store');
    calls++;
    if (calls === 3) throw new Error('Synthetic network failure');
    return new Response(JSON.stringify({ data: { generatedAt: '2026-11-21T00:01:02.000Z', records: [{ status: calls === 1 ? 'ALPHA' : 'HADIR' }] } }), { status: 200 });
  };
  try {
    assert.equal((await fetchReportSnapshot()).records[0].status, 'ALPHA');
    assert.equal((await fetchReportSnapshot()).records[0].status, 'HADIR');
    await assert.rejects(fetchReportSnapshot(), /Synthetic network failure/);
    assert.equal(calls, 3);
    assert.equal(reportTimestamp('2026-11-21T00:01:02.000Z'), '21/11/2026, 07.01.02 WIB');
  } finally { globalThis.fetch = original; }
});
