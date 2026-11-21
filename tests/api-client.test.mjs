import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';

test('API sends explicit JSON for empty POST and DELETE while preserving GET and caller payloads', async () => {
  const original = globalThis.fetch, calls = [];
  globalThis.fetch = async (path, options) => {
    calls.push({ path, options });
    return Response.json({ data: path.endsWith('/csrf') ? { csrfToken: 'synthetic-csrf' } : { success: true } });
  };
  try {
    const source = await readFile(new URL('../src/utils/api.ts', import.meta.url), 'utf8');
    const built = await transform(source, { loader: 'ts', format: 'esm' });
    const client = await import(`data:text/javascript;base64,${Buffer.from(built.code).toString('base64')}`);
    await client.api('/attendance-sessions/synthetic', 'DELETE');
    await client.api('/attendance-sessions/synthetic/reopen', 'POST');
    await client.api('/users/own', 'PATCH', { name: 'Synthetic' });
    await client.api('/auth/me');
    const mutations = calls.filter(call => call.options.method && call.options.method !== 'GET');
    assert.deepEqual(mutations.map(call => call.options.body), ['{}', '{}', '{"name":"Synthetic"}']);
    assert(mutations.every(call => call.options.headers['X-CSRF-Token'] === 'synthetic-csrf'));
    assert.equal(calls.at(-1).options.body, undefined);
  } finally { globalThis.fetch = original; }
});
