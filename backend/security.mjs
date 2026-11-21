import { randomBytes, randomInt, createHash, createHmac, timingSafeEqual, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
import { validatePassword } from '../shared/password-policy.mjs';

const scrypt = promisify(scryptCallback);
export const roles = ['admin', 'dosen', 'mahasiswa'];
export const statuses = ['HADIR', 'IZIN', 'SAKIT', 'ALPHA'];
export const token = () => randomBytes(32).toString('base64url');
export const digest = value => createHash('sha256').update(String(value)).digest('hex');
export const otp = () => String(randomInt(100000, 1000000));
export const keyedDigest = (secret, value) => createHmac('sha256', secret).update(value).digest('hex');
export const equal = (a, b) => typeof a === 'string' && typeof b === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export class HttpError extends Error {
  constructor(status, code, message = code) { super(message); this.status = status; this.code = code; }
}
export function requireValue(condition, code = 'VALIDATION_ERROR', status = 422) {
  if (!condition) throw new HttpError(status, code);
}
export function text(value, max = 255, optional = false) {
  if (optional && (value === undefined || value === null || value === '')) return null;
  requireValue(typeof value === 'string' && value.trim().length > 0 && value.length <= max);
  return value.trim();
}
export function integer(value, min, max) { requireValue(Number.isInteger(value) && value >= min && value <= max); return value; }
export function date(value) {
  requireValue(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value);
  return value;
}
export function time(value) { requireValue(typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)); return value; }
export function password(value) {
  try { return validatePassword(value); }
  catch (error) { throw new HttpError(422, error.code || 'PASSWORD_MIN_6'); }
}
export async function hashPassword(value) {
  password(value);
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(value, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$v1$${salt}$${hash.toString('hex')}`;
}
export async function verifyPassword(value, encoded) {
  if (typeof value !== 'string' || Buffer.byteLength(value) > 1024 || !/^scrypt\$v1\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(encoded || '')) return false;
  const [, , salt, hash] = encoded.split('$');
  const result = await scrypt(value, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return equal(result.toString('hex'), hash);
}
export function localDatabase(config) {
  requireValue(['localhost', '127.0.0.1', '::1'].includes(config.host) && /^[a-zA-Z0-9_]+_(dev|test)$/.test(config.database || ''), 'LOCAL_DATABASE_REQUIRED', 503);
  return config;
}
export function validateQr(session, value, now = Date.now()) {
  requireValue(session && session.is_open && equal(session.qr_token, value) && session.qr_expires_at && new Date(session.qr_expires_at).getTime() > now, 'QR_INVALID_OR_EXPIRED', 409);
}
export function safeUser(row) {
  const user = Object.fromEntries(['id', 'username', 'login_alias', 'name', 'email', 'role', 'avatar_url', 'title', 'nidn', 'academic_rank', 'office_room', 'prodi', 'phone', 'version'].filter(k => row[k] !== undefined).map(k => [k.replace(/_([a-z])/g, (_, x) => x.toUpperCase()), row[k]]));
  if (row.must_change_password !== undefined) user.mustChangePassword = Boolean(row.must_change_password);
  user.isDemo = Boolean(row.is_demo);
  if (row.email_verified_at !== undefined) user.emailVerified = Boolean(row.email_verified_at);
  return user;
}
export function asyncRoute(handler) { return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next); }
export function cookies(header = '') {
  const result = {};
  for (const part of header.split(';')) { const i = part.indexOf('='); if (i > 0) { try { result[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1)); } catch {} } }
  return result;
}
