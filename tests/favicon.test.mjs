import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('favicon variants preserve PNG dimensions and are linked across SPA routes', async () => {
  const html = await readFile('index.html', 'utf8');
  for (const size of [32, 48, 180, 192, 512]) {
    const png = await readFile(`public/favicon-${size}.png`);
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(png.readUInt32BE(16), size); assert.equal(png.readUInt32BE(20), size);
  }
  assert(html.includes('/favicon-32.png?v=')); assert(html.includes('/favicon-48.png?v='));
  assert(html.includes('apple-touch-icon')); assert(html.includes('site.webmanifest'));
  assert(!html.includes('vite.svg')); assert(!html.includes('react.svg'));
  const manifest = JSON.parse(await readFile('public/site.webmanifest', 'utf8'));
  assert.deepEqual(manifest.icons.map(icon => icon.sizes), ['192x192', '512x512']);
});
