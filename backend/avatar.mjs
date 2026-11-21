import { Router } from 'express';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { asyncRoute, requireValue } from './security.mjs';
import { rows, transaction, audit } from './database.mjs';

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) { value ^= byte; for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0); }
  return (value ^ 0xffffffff) >>> 0;
}

export async function validateAvatarReference(db, userId, value) {
  if (!value) return;
  requireValue(typeof value === 'string', 'AVATAR_FORMAT_INVALID');
  if (value.startsWith('https://')) { let url; try { url = new URL(value); } catch {} requireValue(url && !url.username && !url.password, 'AVATAR_FORMAT_INVALID'); return; }
  const prefix = `/api/v1/avatars/${encodeURIComponent(userId)}/`;
  requireValue(value.startsWith(prefix) && /^[a-f0-9]{64}\.(jpg|png)$/.test(value.slice(prefix.length)), 'AVATAR_REFERENCE_INVALID');
  const [user] = await rows(db, 'SELECT id FROM users WHERE id=? AND avatar_url=?', [userId, value]);
  requireValue(user, 'AVATAR_REFERENCE_INVALID');
}

export function decodeAvatar(value) {
  requireValue(typeof value === 'string' && value.length <= 1400000, 'AVATAR_TOO_LARGE', 413);
  const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  requireValue(match, 'AVATAR_FORMAT_INVALID');
  const bytes = Buffer.from(match[2], 'base64');
  requireValue(bytes.length > 20 && bytes.length <= 1000000 && bytes.toString('base64') === match[2], 'AVATAR_CONTENT_INVALID');
  let width = 0, height = 0;
  if (match[1] === 'png') {
    requireValue(bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])), 'AVATAR_CONTENT_INVALID');
    let at = 8, ended = false; const compressed = [];
    while (at + 12 <= bytes.length) {
      const size = bytes.readUInt32BE(at), type = bytes.toString('ascii', at + 4, at + 8);
      requireValue(size <= bytes.length - at - 12, 'AVATAR_CONTENT_INVALID');
      requireValue(crc32(bytes.subarray(at + 4, at + 8 + size)) === bytes.readUInt32BE(at + 8 + size), 'AVATAR_CONTENT_INVALID');
      if (at === 8) { requireValue(type === 'IHDR' && size === 13, 'AVATAR_CONTENT_INVALID'); width = bytes.readUInt32BE(at + 8); height = bytes.readUInt32BE(at + 12); }
      if (type === 'IDAT') compressed.push(bytes.subarray(at + 8, at + 8 + size));
      at += size + 12;
      if (type === 'IEND') { requireValue(size === 0 && at === bytes.length, 'AVATAR_CONTENT_INVALID'); ended = true; break; }
    }
    requireValue(ended && compressed.length && width > 0 && height > 0 && width <= 2048 && height <= 2048, 'AVATAR_CONTENT_INVALID');
    try { requireValue(inflateSync(Buffer.concat(compressed), { maxOutputLength: 40000000 }).length > height, 'AVATAR_CONTENT_INVALID'); } catch { requireValue(false, 'AVATAR_CONTENT_INVALID'); }
  } else {
    requireValue(bytes.readUInt16BE(0) === 0xffd8 && bytes.readUInt16BE(bytes.length - 2) === 0xffd9, 'AVATAR_CONTENT_INVALID');
    let at = 2, scan = false;
    while (at + 4 <= bytes.length) {
      requireValue(bytes[at] === 255, 'AVATAR_CONTENT_INVALID');
      const marker = bytes[at + 1], size = bytes.readUInt16BE(at + 2);
      requireValue(size >= 2 && at + size + 2 <= bytes.length, 'AVATAR_CONTENT_INVALID');
      if ([0xc0, 0xc1, 0xc2].includes(marker)) { requireValue(size >= 8, 'AVATAR_CONTENT_INVALID'); height = bytes.readUInt16BE(at + 5); width = bytes.readUInt16BE(at + 7); }
      if (marker === 0xda) { scan = true; break; }
      at += size + 2;
    }
    requireValue(scan && width > 0 && height > 0 && width <= 2048 && height <= 2048, 'AVATAR_CONTENT_INVALID');
  }
  return { bytes, extension: match[1] === 'jpeg' ? 'jpg' : 'png', mime: `image/${match[1]}` };
}

export function avatarStorage() {
  const path = process.env.HADIR_AVATAR_DIR || (process.env.HADIR_CONFIG_PATH ? resolve(dirname(process.env.HADIR_CONFIG_PATH), 'avatars') : null);
  requireValue(path, 'AVATAR_STORAGE_NOT_CONFIGURED', 503);
  return resolve(path);
}

export function avatars(pool, auth) {
  const router = Router(); router.use(auth.required);
  router.post('/', asyncRoute(async (req, res) => {
    requireValue(Object.keys(req.body).every(key => key === 'dataUrl'), 'PROFILE_FIELD_FORBIDDEN', 403);
    await auth.limit(`avatar:${req.user.id}`, 20);
    const image = decodeAvatar(req.body.dataUrl), hash = createHash('sha256').update(image.bytes).digest('hex');
    const owner = createHash('sha256').update(req.user.id).digest('hex');
    const directory = resolve(avatarStorage(), owner); await mkdir(directory, { recursive: true, mode: 0o700 });
    const filename = `${hash}.${image.extension}`, url = `/api/v1/avatars/${encodeURIComponent(req.user.id)}/${filename}`;
    await writeFile(resolve(directory, filename), image.bytes, { mode: 0o600, flag: 'wx' }).catch(error => { if (error.code !== 'EEXIST') throw error; });
    const version = await transaction(pool, async db => {
      const [user] = await rows(db, 'SELECT id FROM users WHERE id=? AND is_active=1 FOR UPDATE', [req.user.id]); requireValue(user, 'AUTH_REQUIRED', 401);
      await rows(db, 'UPDATE users SET avatar_url=?,version=version+1 WHERE id=?', [url, req.user.id]);
      await audit(db, req.user.id, 'AVATAR_UPDATED', 'user', req.user.id);
      const [updated] = await rows(db, 'SELECT version FROM users WHERE id=?', [req.user.id]); return updated.version;
    });
    res.json({ data: { avatarUrl: url, version } });
  }));
  router.get('/:userId/:filename', asyncRoute(async (req, res) => {
    requireValue(req.user.id === req.params.userId || req.user.role === 'admin', 'FORBIDDEN', 403);
    requireValue(/^[a-f0-9]{64}\.(jpg|png)$/.test(req.params.filename), 'NOT_FOUND', 404);
    const url = `/api/v1/avatars/${encodeURIComponent(req.params.userId)}/${req.params.filename}`;
    const [user] = await rows(pool, 'SELECT id FROM users WHERE id=? AND avatar_url=? AND is_active=1 AND is_demo=?', [req.params.userId, url,Number(req.user.demoScope)]); requireValue(user, 'NOT_FOUND', 404);
    const owner = createHash('sha256').update(user.id).digest('hex');
    let bytes; try { bytes = await readFile(resolve(avatarStorage(), owner, req.params.filename)); } catch { requireValue(false, 'NOT_FOUND', 404); }
    res.set('Content-Type', req.params.filename.endsWith('.png') ? 'image/png' : 'image/jpeg').set('Content-Security-Policy', "default-src 'none'; sandbox").send(bytes);
  }));
  return router;
}
