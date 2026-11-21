import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeAvatar, avatarStorage } from '../backend/avatar.mjs';

export const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
test('avatar accepts raster PNG and rejects executable, forged, oversized and trailing input', () => {
  assert.equal(decodeAvatar(tinyPng).extension, 'png');
  for (const data of ['data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64,UEsDBA==', tinyPng + 'A', `data:image/png;base64,${'A'.repeat(1400001)}`]) assert.throws(() => decodeAvatar(data));
  const value = Buffer.from(tinyPng.split(',')[1], 'base64');
  assert.throws(() => decodeAvatar(`data:image/png;base64,${Buffer.concat([value, Buffer.from('<script>')]).toString('base64')}`));
  value.writeUInt32BE(100000, 16); assert.throws(() => decodeAvatar(`data:image/png;base64,${value.toString('base64')}`));
});
test('avatar storage fails closed without explicit persistent private configuration', () => {
  const previous = { directory: process.env.HADIR_AVATAR_DIR, config: process.env.HADIR_CONFIG_PATH };
  delete process.env.HADIR_AVATAR_DIR; delete process.env.HADIR_CONFIG_PATH;
  try { assert.throws(() => avatarStorage(), { code: 'AVATAR_STORAGE_NOT_CONFIGURED' }); }
  finally { if (previous.directory !== undefined) process.env.HADIR_AVATAR_DIR = previous.directory; if (previous.config !== undefined) process.env.HADIR_CONFIG_PATH = previous.config; }
});
